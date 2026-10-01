/* Boot, render pipeline (backdrop -> scene -> bloom -> HUD), fixed-step loop and app modes. */
(function (G) {
  'use strict';
  const U = G.U, C = G.C, S = G.settings, FX = G.fx, GFX = G.gfx, A = G.audio, I = G.input, Game = G.game, UI = G.ui, HUD = G.hud;
  const W = C.W, H = C.H, STEP = 1 / 120;
  const mk = () => document.createElement('canvas');
  const canvas = document.getElementById('game'), ctx = canvas.getContext('2d');
  const scene = mk(), sctx = scene.getContext('2d');
  const b1 = mk(), b2 = mk(), b3 = mk();
  const bctx = [b1.getContext('2d'), b2.getContext('2d'), b3.getContext('2d')];
  const view = (G.view = { ox: 0, oy: 0, s: 1, w: 0, h: 0, dpr: 1, ps: 1 });
  const params = new URLSearchParams(location.search);
  G.debug = { stage: parseInt(params.get('stage'), 10) || 0, god: params.get('god') === '1' };
  const WORLD_HUE = [195, 28, 310, 140, 215];
  const bg = { stars: [], hue: -1, pat: null, pat2: null, scroll: 0 };
  const M = { mode: 'title' };
  G.main = M;

  function initStars() {
    const n = U.clamp(Math.round(view.w * view.h / 6500), 90, 420);
    bg.stars = [];
    for (let i = 0; i < n; i++) bg.stars.push({ x: Math.random() * view.w, y: Math.random() * view.h, z: Math.random(), tw: Math.random() * 6 });
  }
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2), w = Math.max(64, window.innerWidth), h = Math.max(64, window.innerHeight);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    const s = Math.min(w / W, h / H);
    view.w = w; view.h = h; view.dpr = dpr; view.s = s;
    view.ox = (w - W * s) / 2; view.oy = (h - H * s) / 2;
    view.ps = Math.min(s * dpr, 1.75);
    scene.width = Math.round(W * view.ps); scene.height = Math.round(H * view.ps);
    b1.width = scene.width >> 1; b1.height = scene.height >> 1;
    b2.width = scene.width >> 2; b2.height = scene.height >> 2;
    b3.width = Math.max(8, scene.width >> 3); b3.height = Math.max(8, scene.height >> 3);
    initStars();
  }
  window.addEventListener('resize', resize);

  function drawBackground(dt) {
    const w = view.w, h = view.h, slow = S.reduced ? 0.3 : 1;
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.fillStyle = '#03040d'; ctx.fillRect(0, 0, w, h);
    const hue = WORLD_HUE[Game.world || 0];
    if (hue !== bg.hue) { bg.hue = hue; bg.pat = ctx.createPattern(GFX.nebula(hue), 'repeat'); bg.pat2 = ctx.createPattern(GFX.nebula(hue + 40), 'repeat'); }
    bg.scroll += dt * 14 * slow;
    ctx.save();
    ctx.translate(0, bg.scroll % 1024);
    ctx.fillStyle = bg.pat; ctx.fillRect(0, -1024, w, h + 1024);
    ctx.restore();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.55;
    ctx.scale(1.7, 1.7); ctx.translate(0, (bg.scroll * 0.6) % 1024);
    ctx.fillStyle = bg.pat2; ctx.fillRect(0, -1024, w / 1.7, h / 1.7 + 1024);
    ctx.restore();
    for (const st of bg.stars) {
      const sp = 18 + st.z * st.z * 150;
      st.y += sp * dt * slow;
      if (st.y > h) { st.y = -4; st.x = Math.random() * w; }
      const tw = 0.65 + 0.35 * Math.sin(st.tw + bg.scroll * (1 + st.z));
      ctx.globalAlpha = (0.25 + st.z * 0.75) * tw;
      ctx.fillStyle = st.z > 0.85 ? '#bfe6ff' : st.z > 0.5 ? '#ffffff' : '#9db4e6';
      const sz = 0.7 + st.z * 1.8;
      ctx.fillRect(st.x, st.y, sz, sz * (1 + sp / 120));
    }
    ctx.globalAlpha = 1;
  }

  function render(dt) {
    if (scene.width < 16 || scene.height < 16) { resize(); return; }
    drawBackground(dt);
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.clearRect(0, 0, scene.width, scene.height);
    sctx.setTransform(view.ps, 0, 0, view.ps, 0, 0);
    if (FX.shake > 0) sctx.translate(U.rand(-FX.shake, FX.shake), U.rand(-FX.shake, FX.shake));
    Game.render(sctx);
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    HUD.sides(ctx, view, Game);
    ctx.save();
    ctx.translate(view.ox, view.oy); ctx.scale(view.s, view.s);
    if (Game.hasBackdrop) Game.drawBackdrop(ctx); else { ctx.fillStyle = 'rgba(2,4,16,0.42)'; ctx.fillRect(0, 0, W, H); }
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(scene, 0, 0, W, H);
    if (S.bloom) {
      bctx[0].clearRect(0, 0, b1.width, b1.height); bctx[0].drawImage(scene, 0, 0, b1.width, b1.height);
      bctx[1].clearRect(0, 0, b2.width, b2.height); bctx[1].drawImage(b1, 0, 0, b2.width, b2.height);
      bctx[2].clearRect(0, 0, b3.width, b3.height); bctx[2].drawImage(b2, 0, 0, b3.width, b3.height);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.36; ctx.drawImage(b2, 0, 0, W, H);
      ctx.globalAlpha = 0.3; ctx.drawImage(b3, 0, 0, W, H);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    (HUD.drawAll || HUD.draw)(ctx, Game);
    if (FX.flash > 0) { ctx.fillStyle = 'rgba(' + FX.flashColor + ',' + Math.min(0.75, FX.flash * 0.7) + ')'; ctx.fillRect(0, 0, W, H); }
    ctx.restore();
    ctx.strokeStyle = 'rgba(55,230,255,0.45)'; ctx.lineWidth = 1.5;
    ctx.shadowColor = 'rgba(55,230,255,0.9)'; ctx.shadowBlur = 12;
    ctx.strokeRect(view.ox, view.oy, W * view.s, H * view.s);
    ctx.shadowBlur = 0;
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
    render(dt);
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
