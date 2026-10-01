/* HUD strip, countdown, banners and the decorative side panels. */
(function (G) {
  'use strict';
  const U = G.U, C = G.C;
  const W = C.W, H = C.H;
  const HUD = {};
  const FONT = '"Segoe UI", system-ui, -apple-system, Roboto, sans-serif';

  function txt(ctx, s, x, y, size, color, align, weight, glow) {
    ctx.font = (weight || 800) + ' ' + size + 'px ' + FONT;
    ctx.textAlign = align || 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = color; ctx.fillText(s, x, y); // glow comes from the bloom pass; per-text shadow blur is far too costly to run every frame
    void glow;
  }
  HUD.txt = txt;

  function chip(ctx, x, label, color, on) {
    ctx.fillStyle = on ? 'rgba(20,40,70,0.8)' : 'rgba(6,12,30,0.5)';
    ctx.fillRect(x, 6, 66, 18);
    ctx.strokeStyle = on ? color : 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1.2; ctx.strokeRect(x, 6, 66, 18);
    txt(ctx, label, x + 33, 19, 10, on ? '#ffffff' : 'rgba(255,255,255,0.3)', 'center', 800);
    return x + 72;
  }

  HUD.draw = function (ctx, g) {
    if (g.demo) return;
    const p = g.player;
    const grad = ctx.createLinearGradient(0, 0, 0, 30);
    grad.addColorStop(0, 'rgba(2,6,16,0.92)'); grad.addColorStop(1, 'rgba(2,6,16,0.6)');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, 30);
    ctx.strokeStyle = 'rgba(80,200,255,0.4)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, 30); ctx.lineTo(W, 30); ctx.stroke();
    const label = g.mode === 'survival' ? 'SURVIVAL  ' + Math.floor(g.elapsed / 60) + ':' + U.pad(g.elapsed % 60, 2) : 'ROUND ' + g.round;
    txt(ctx, label, 14, 21, 14, '#9fe8ff', 'left', 800, 'rgba(90,200,255,0.8)');
    txt(ctx, U.fmt(g.score), W / 2, 22, 20, '#ffe9c0', 'center', 800, 'rgba(255,190,110,0.8)');
    if (g.mode === 'campaign') {
      for (let i = 0; i < g.lives; i++) { ctx.fillStyle = '#5ae6ff'; ctx.shadowColor = '#5ae6ff'; ctx.shadowBlur = 6; ctx.fillRect(W - 24 - i * 18, 11, 12, 8); ctx.shadowBlur = 0; }
      const left = g.cycles.filter((c) => !c.human && c.alive).length;
      txt(ctx, left + (left === 1 ? ' RIVAL' : ' RIVALS'), W - 24 - Math.max(0, g.lives) * 18 - 14, 21, 12, '#ff9a5d', 'right', 800);
    } else txt(ctx, 'DEREZ ' + g.kills, W - 14, 21, 14, '#ff9a5d', 'right', 800);
    if (!p) return;
    // boost meter + status chips
    let x = 150;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x, 10, 110, 10);
    ctx.fillStyle = p.over > 0 ? '#ff6af0' : p.energy < 20 ? '#ff6a6a' : '#5ae6ff'; ctx.fillRect(x, 10, 110 * p.energy / 100, 10);
    ctx.strokeStyle = 'rgba(160,230,255,0.6)'; ctx.strokeRect(x, 10, 110, 10);
    txt(ctx, p.over > 0 ? 'OVERDRIVE' : 'BOOST', x + 55, 8, 8, 'rgba(255,255,255,0.6)', 'center', 700);
    x += 124;
    x = chip(ctx, x, 'SHIELD', '#8fd4ff', p.shield > 0);
    x = chip(ctx, x, p.discs > 0 ? 'DISC x' + p.discs : 'DISC', '#ffb04a', p.discs > 0);
    x = chip(ctx, x, p.ghost > 0 ? 'GHOST ' + Math.ceil(p.ghost) : 'GHOST', '#c88aff', p.ghost > 0);
    x = chip(ctx, x, p.twall > 0 ? 'T-WALL [E]' : 'T-WALL', '#ff6a4a', p.twall > 0 && Math.floor(g.time * 4) % 2 === 0 || p.twall > 0);
  };

  HUD.countdown = function (ctx, g) {
    if (g.state !== 'intro' || g.timer > 3 || g.timer <= 0) return;
    const n = Math.ceil(g.timer), k = 1 - (g.timer % 1);
    ctx.save(); ctx.globalAlpha = 1 - k * 0.6; ctx.translate(W / 2, H / 2 + 24); ctx.scale(1 + k * 0.5, 1 + k * 0.5);
    txt(ctx, String(n), 0, 40, 120, '#ffffff', 'center', 900, 'rgba(90,220,255,1)');
    ctx.restore();
  };

  HUD.banner = function (ctx, g) {
    const b = g.banner;
    if (!b) return;
    const k = b.t / b.life;
    const a = k < 0.1 ? k / 0.1 : k > 0.82 ? Math.max(0, (1 - k) / 0.18) : 1;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(W / 2, H * 0.3);
    if (b.small) txt(ctx, b.text, 0, 0, 40, '#7dffb8', 'center', 900, 'rgba(60,255,160,0.9)');
    else {
      txt(ctx, b.text, 0, 0, 52, '#ffffff', 'center', 900, 'rgba(90,200,255,1)');
      if (b.sub) txt(ctx, b.sub, 0, 34, 18, '#ffd24a', 'center', 800, 'rgba(255,200,60,0.9)');
    }
    ctx.restore();
  };

  HUD.drawAll = function (ctx, g) { HUD.draw(ctx, g); if (!g.demo) { HUD.countdown(ctx, g); HUD.banner(ctx, g); } };

  /* side panels are painted once into an offscreen canvas and re-blitted; rebuilt only when the window or the top scores change */
  let sideCache = null, sideKey = '';
  function paintSides(ctx, v) {
    const sw = v.ox;
    const sc = Math.min(1.15, sw / 240), cx1 = sw / 2, cx2 = v.ox + W * v.s + sw / 2, top = v.oy + 70 * sc;
    const col = 'rgba(160,215,255,0.8)';
    txt(ctx, 'LIGHTCYCLES', cx1, top, 15 * sc, '#ffffff', 'center', 900);
    const help = ['STEER', 'W A S D  /  ARROWS', 'BOOST', 'SHIFT (HOLD)', 'DISC', 'SPACE', 'T-WALL', 'E  /  ENTER', 'PAUSE', 'P  /  ESC'];
    help.forEach((s, i) => txt(ctx, s, cx1, top + 44 * sc + i * 19 * sc, (i % 2 ? 12 : 10) * sc, i % 2 ? col : '#ff9a5d', 'center', i % 2 ? 700 : 800));
    txt(ctx, 'TOP PROGRAMS', cx2, top, 15 * sc, '#ffffff', 'center', 900);
    G.scores.list.slice(0, 7).forEach((r, i) => txt(ctx, (i + 1) + '. ' + r.name + '  ' + U.fmt(r.score), cx2, top + 34 * sc + i * 22 * sc, 13 * sc, i === 0 ? '#ffd24a' : col, 'center', 700));
    txt(ctx, 'FREE TO PLAY & SHARE', cx2, top + 230 * sc, 10 * sc, '#ff9a5d', 'center', 800);
    txt(ctx, 'github.com/nbwillcox', cx2, top + 248 * sc, 12 * sc, col, 'center', 700);
    txt(ctx, '/lightCycles', cx2, top + 264 * sc, 12 * sc, col, 'center', 700);
  }
  HUD.sides = function (ctx, v) {
    if (v.ox < 150) return;
    const key = [v.w, v.h, v.rs.toFixed(2), Math.round(v.ox), Math.round(v.oy), v.s.toFixed(3), G.scores.list.slice(0, 7).map((r) => r.name + r.score).join(',')].join('|');
    if (key !== sideKey || !sideCache) {
      sideKey = key;
      const sw = v.ox, pw = Math.round(sw * v.rs), ph = Math.round(v.h * v.rs);
      const full = document.createElement('canvas');
      full.width = Math.round(v.w * v.rs); full.height = ph;
      const x = full.getContext('2d');
      x.scale(v.rs, v.rs);
      paintSides(x, v);
      // split into two exact-size strips so each frame only blits what is visible
      const strip = (sx) => { const c = document.createElement('canvas'); c.width = pw; c.height = ph; c.getContext('2d').drawImage(full, sx, 0, pw, ph, 0, 0, pw, ph); return c; };
      sideCache = { l: strip(0), r: strip(full.width - pw) };
    }
    ctx.drawImage(sideCache.l, 0, 0, v.ox, v.h);
    ctx.drawImage(sideCache.r, v.w - v.ox, 0, v.ox, v.h);
  };

  G.hud = HUD;
})((window.SGS = window.SGS || {}));
