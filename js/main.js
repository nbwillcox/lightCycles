/* Boot, render pipeline (backdrop -> scene -> bloom -> HUD), fixed-step loop and app modes. */
(function (G) {
  'use strict';
  const U = G.U, C = G.C, S = G.settings, FX = G.fx, GFX = G.gfx, A = G.audio, I = G.input, Game = G.game, UI = G.ui, HUD = G.hud;
  const W = C.W, H = C.H, STEP = 1 / 60;
  const mk = () => document.createElement('canvas');
  const canvas = document.getElementById('game'), ctx = canvas.getContext('2d');
  const scene = mk(), sctx = scene.getContext('2d');
  const b1 = mk(), b2 = mk(), b3 = mk();
  const bctx = [b1.getContext('2d'), b2.getContext('2d'), b3.getContext('2d')];
  const view = (G.view = { ox: 0, oy: 0, s: 1, w: 0, h: 0, dpr: 1, ps: 1, rs: 1 });
  const params = new URLSearchParams(location.search);
  G.debug = { stage: parseInt(params.get('stage'), 10) || 0, god: params.get('god') === '1' };
  const WORLD_HUE = [195, 28, 310, 140, 215];
  const bg = { stars: [], hue: -1, pat: null, pat2: null, scroll: 0 };
  const M = { mode: 'title' };
  G.main = M;

  /* adaptive resolution: if frames run long (busy GPU/CPU), shrink the scene canvas; grow it back when there's headroom */
  let qual = 1, ema = 1 / 60, qT = 0;
  function sizeScene() {
    // the whole canvas (not just the scene layer) renders at a reduced internal resolution when we're struggling
    const rs = view.dpr * Math.max(0.6, qual);
    if (Math.abs(rs - view.rs) > 0.001 || canvas.width !== Math.round(view.w * rs)) { view.rs = rs; canvas.width = Math.round(view.w * rs); canvas.height = Math.round(view.h * rs); }
    view.ps = Math.min(view.s * view.rs, 1.25);
    G.arena.setScale(view.s * view.rs); G.cycles.setScale(view.ps);
    scene.width = Math.max(16, Math.round(W * view.ps)); scene.height = Math.max(16, Math.round(H * view.ps));
    b1.width = Math.max(8, scene.width >> 1); b1.height = Math.max(8, scene.height >> 1);
    b2.width = Math.max(8, scene.width >> 2); b2.height = Math.max(8, scene.height >> 2);
    b3.width = Math.max(8, scene.width >> 3); b3.height = Math.max(8, scene.height >> 3);
  }
  function adapt(dt) {
    if (dt >= 0.09) return;
    ema += (dt - ema) * 0.04; qT += dt;
    if (qT < 1.2) return;
    qT = 0;
    if (ema > 0.027 && qual > 0.55) { qual = Math.max(0.55, qual - 0.15); sizeScene(); }
    else if (ema < 0.019 && qual < 1) { qual = Math.min(1, qual + 0.05); sizeScene(); }
    M.bloomOn = !(qual <= 0.6 && ema > 0.03);
  }
  M.quality = () => ({ qual: +qual.toFixed(2), ema: +ema.toFixed(4), rs: +view.rs.toFixed(2), ps: +view.ps.toFixed(2), canvas: canvas.width + 'x' + canvas.height, scene: scene.width + 'x' + scene.height, bloom: M.bloomOn !== false });
  M._adapt = adapt;
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5), w = Math.max(64, window.innerWidth), h = Math.max(64, window.innerHeight);
    const s = Math.min(w / W, h / H);
    view.w = w; view.h = h; view.dpr = dpr; view.s = s; view.rs = 0;
    view.ox = (w - W * s) / 2; view.oy = (h - H * s) / 2;
    sizeScene();
    bg.cache = null;
  }
  window.addEventListener('resize', resize);

  /* the nebula/star backdrop is painted once into a half-size canvas and only blitted; skipped when the playfield covers the window */
  function buildBg() {
    const hue = WORLD_HUE[Game.world || 0];
    const c = mk(); c.width = Math.ceil(view.w / 2); c.height = Math.ceil(view.h / 2);
    const x = c.getContext('2d');
    x.scale(0.5, 0.5);
    x.fillStyle = '#03040d'; x.fillRect(0, 0, view.w, view.h);
    x.fillStyle = x.createPattern(GFX.nebula(hue), 'repeat'); x.fillRect(0, 0, view.w, view.h);
    x.save(); x.globalCompositeOperation = 'lighter'; x.globalAlpha = 0.55; x.scale(1.7, 1.7);
    x.fillStyle = x.createPattern(GFX.nebula(hue + 40), 'repeat'); x.fillRect(0, 0, view.w / 1.7, view.h / 1.7); x.restore();
    const n = U.clamp(Math.round(view.w * view.h / 9000), 60, 260);
    for (let i = 0; i < n; i++) { const z = Math.random(); x.globalAlpha = 0.25 + z * 0.75; x.fillStyle = z > 0.85 ? '#bfe6ff' : z > 0.5 ? '#ffffff' : '#9db4e6'; const sz = 0.8 + z * 1.8; x.fillRect(Math.random() * view.w, Math.random() * view.h, sz, sz); }
    bg.cache = c; bg.hue = hue;
  }
  function drawBackground() {
    if (Game.hasBackdrop && view.ox < 1 && view.oy < 1) return;
    if (!bg.cache || bg.hue !== WORLD_HUE[Game.world || 0]) buildBg();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(bg.cache, 0, 0, canvas.width, canvas.height);
  }

  function render() {
    drawBackground();
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.clearRect(0, 0, scene.width, scene.height);
    sctx.setTransform(view.ps, 0, 0, view.ps, 0, 0);
    if (FX.shake > 0) sctx.translate(U.rand(-FX.shake, FX.shake), U.rand(-FX.shake, FX.shake));
    Game.render(sctx);
    ctx.setTransform(view.rs, 0, 0, view.rs, 0, 0);
    HUD.sides(ctx, view, Game);
    ctx.save();
    ctx.translate(view.ox, view.oy); ctx.scale(view.s, view.s);
    if (Game.hasBackdrop) Game.drawBackdrop(ctx); else { ctx.fillStyle = 'rgba(2,4,16,0.42)'; ctx.fillRect(0, 0, W, H); }
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'low';
    ctx.drawImage(scene, 0, 0, W, H);
    if (S.bloom && M.bloomOn !== false) {
      bctx[0].clearRect(0, 0, b1.width, b1.height); bctx[0].drawImage(scene, 0, 0, b1.width, b1.height);
      bctx[1].clearRect(0, 0, b2.width, b2.height); bctx[1].drawImage(b1, 0, 0, b2.width, b2.height);
      bctx[2].clearRect(0, 0, b3.width, b3.height); bctx[2].drawImage(b2, 0, 0, b3.width, b3.height);
      // fold the widest blur back into the mid blur (cheap, tiny canvases) so only ONE full-screen additive blit is needed
      bctx[1].globalCompositeOperation = 'lighter'; bctx[1].globalAlpha = 0.85; bctx[1].drawImage(b3, 0, 0, b2.width, b2.height);
      bctx[1].globalAlpha = 1; bctx[1].globalCompositeOperation = 'source-over';
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.4; ctx.drawImage(b2, 0, 0, W, H);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    (HUD.drawAll || HUD.draw)(ctx, Game);
    if (FX.flash > 0) { ctx.fillStyle = 'rgba(' + FX.flashColor + ',' + Math.min(0.75, FX.flash * 0.7) + ')'; ctx.fillRect(0, 0, W, H); }
    ctx.restore();
    ctx.strokeStyle = 'rgba(55,230,255,0.45)'; ctx.lineWidth = 1.5;
    ctx.strokeRect(view.ox, view.oy, W * view.s, H * view.s);
  }

  /* ---------- app modes ---------- */
  M.lastMode = 'campaign';
  M.startGame = function (mode) {
    A.resume();
    I.clear();
    M.lastMode = mode || M.lastMode;
    Game.reset(M.lastMode, G.debug.stage || 1);
    Game.onOver = () => { M.mode = 'over'; UI.showGameOver(Game.score, Game.round, M.lastMode === 'survival' ? 'SURVIVED ' + Math.floor(Game.elapsed / 60) + ':' + U.pad(Game.elapsed % 60, 2) : ''); };
    M.mode = 'play';
    UI.hideAll();
    A.sfx.start();
  };
  M.toTitle = function () {
    Game.onOver = null;
    Game.reset('attract', 1);
    M.mode = 'title';
    UI.lastIdx = -1;
    UI.show('title');
    if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume();
    A.music('title');
  };
  M.pause = function () {
    if (M.mode !== 'play') return;
    M.mode = 'pause';
    I.clear();
    if (A.ctx) A.ctx.suspend();
    UI.show('pause');
  };
  M.resume = function () {
    if (M.mode !== 'pause') return;
    M.mode = 'play';
    I.clear();
    UI.hideAll();
    if (A.ctx) A.ctx.resume();
  };

  let last = 0, acc = 0, musicKicked = false;
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (!(dt > 0)) dt = 1 / 60;
    if (dt > 0.1) dt = 0.1;
    if (!musicKicked && A.ready && M.mode === 'title') { musicKicked = true; A.music('title'); }
    if (M.mode === 'pause') { if (I.takePause()) M.resume(); }
    else {
      acc += dt;
      while (acc >= STEP) {
        if (M.mode === 'play' && I.takePause()) { M.pause(); acc = 0; break; }
        if (M.mode !== 'play') { I.takePause(); I.takeDisc(); I.takeTWall(); }
        Game.update(STEP);
        acc -= STEP;
      }
    }
    adapt(dt);
    render();
  }

  document.addEventListener('visibilitychange', () => { if (document.hidden) M.pause(); });
  window.addEventListener('blur', () => M.pause());
  I.bind(canvas);

  function boot() {
    GFX.init();
    resize();
    Game.reset('attract', 1);
    UI.show('title');
    requestAnimationFrame((t) => { last = t; frame(t); });
  }
  boot();
})((window.SGS = window.SGS || {}));
