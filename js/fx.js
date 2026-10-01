/* Particles, shockwaves, screen shake and floating text. */
(function (G) {
  'use strict';
  const U = G.U, S = G.settings, TAU = U.TAU;
  const FX = { add: [], norm: [], texts: [], shake: 0, flash: 0, flashColor: '255,255,255' };
  const pool = [];
  const MAX = 900;

  const col = (h, l) => `hsla(${Math.round(h / 10) * 10},100%,${l || 60}%,1)`;
  FX.col = col;

  function np(o) {
    const p = pool.pop() || {};
    p.t = 0; p.life = 1; p.x = 0; p.y = 0; p.vx = 0; p.vy = 0; p.drag = 0; p.size = 2; p.grow = 0;
    p.rot = 0; p.vr = 0; p.color = '#fff'; p.lw = 2; p.kind = 'spark'; p.r1 = 0; p.g = 0;
    return Object.assign(p, o);
  }
  const lim = () => (S.reduced ? 0.4 : 1);

  FX.reset = function () {
    while (FX.add.length) pool.push(FX.add.pop());
    while (FX.norm.length) pool.push(FX.norm.pop());
    FX.texts.length = 0; FX.shake = 0; FX.flash = 0;
  };

  FX.addShake = function (a) { if (S.shake && !S.reduced) FX.shake = Math.min(18, FX.shake + a); };
  FX.doFlash = function (a, c) { if (!S.reduced) { FX.flash = Math.max(FX.flash, a); FX.flashColor = c || '255,255,255'; } };

  FX.sparks = function (x, y, n, speed, color, life, size) {
    n = Math.ceil(n * lim());
    if (FX.add.length > MAX) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, v = speed * (0.35 + Math.random() * 0.75);
      FX.add.push(np({ kind: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: (life || 0.5) * (0.6 + Math.random() * 0.6), drag: 2.2, color, size: size || 1.6 }));
    }
  };
  FX.glowPop = function (x, y, r, color, dur) {
    FX.add.push(np({ kind: 'glow', x, y, size: r, grow: 0.8, life: dur || 0.35, color }));
  };
  FX.ring = function (x, y, r0, r1, color, dur, lw) {
    FX.add.push(np({ kind: 'ring', x, y, size: r0, r1, life: dur || 0.5, color, lw: lw || 3 }));
  };
  FX.trail = function (x, y, color, size, life) {
    if (FX.add.length > MAX) return;
    FX.add.push(np({ kind: 'glow', x, y, size: size || 6, grow: -0.7, life: life || 0.2, color }));
  };
  FX.smoke = function (x, y, n, size) {
    n = Math.ceil(n * lim());
    for (let i = 0; i < n; i++) {
      if (FX.norm.length > MAX) return;
      FX.norm.push(np({ kind: 'smoke', x: x + U.rand(-6, 6), y: y + U.rand(-6, 6), vx: U.rand(-25, 25), vy: U.rand(-25, 25), size: (size || 10) * U.rand(0.6, 1.2), grow: 1.4, life: U.rand(0.7, 1.3), drag: 1.5 }));
    }
  };
  FX.debris = function (x, y, n, color, speed) {
    n = Math.ceil(n * lim());
    for (let i = 0; i < n; i++) {
      if (FX.norm.length > MAX) return;
      const a = Math.random() * TAU, v = (speed || 160) * U.rand(0.3, 1);
      FX.norm.push(np({ kind: 'debris', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, rot: Math.random() * TAU, vr: U.rand(-9, 9), size: U.rand(2.5, 6), life: U.rand(0.6, 1.4), drag: 0.8, color, g: 30 }));
    }
  };
  /* size 1 = small enemy, 2 = medium, 3+ = big; hue = fire tint */
  FX.explosion = function (x, y, size, hue) {
    hue = hue === undefined ? 28 : hue;
    FX.glowPop(x, y, 22 * size, col(hue, 65), 0.35);
    FX.glowPop(x, y, 12 * size, 'rgba(255,255,255,1)', 0.2);
    FX.ring(x, y, 4 * size, 34 * size, col(hue, 70), 0.42, 2.5);
    FX.sparks(x, y, 10 * size, 150 + 40 * size, col(hue, 65), 0.55);
    FX.sparks(x, y, 5 * size, 100 + 30 * size, 'rgba(255,255,255,1)', 0.35, 1.2);
    if (size >= 2) { FX.smoke(x, y, 2 + size, 8 * size); FX.debris(x, y, 3 * size, col(hue, 45), 120 + 30 * size); }
    FX.addShake(size * 1.2);
  };
  FX.text = function (x, y, str, color, size) {
    if (FX.texts.length > 40) FX.texts.shift();
    FX.texts.push({ x, y, str, color: color || '#fff', size: size || 16, t: 0, life: 0.9 });
  };

  FX.update = function (dt) {
    const rm = (arr, i) => { pool.push(arr[i]); arr[i] = arr[arr.length - 1]; arr.pop(); };
    for (const arr of [FX.add, FX.norm]) {
      for (let i = arr.length - 1; i >= 0; i--) {
        const p = arr[i];
        p.t += dt;
        if (p.t >= p.life) { rm(arr, i); continue; }
        if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; }
        p.x += p.vx * dt; p.y += (p.vy + p.g) * dt; p.rot += p.vr * dt;
      }
    }
    for (let i = FX.texts.length - 1; i >= 0; i--) {
      const t = FX.texts[i];
      t.t += dt; t.y -= 34 * dt;
      if (t.t >= t.life) FX.texts.splice(i, 1);
    }
    FX.shake *= Math.max(0, 1 - 7 * dt);
    if (FX.shake < 0.05) FX.shake = 0;
    FX.flash = Math.max(0, FX.flash - dt * 2.2);
  };

  /* additive layer (call with globalCompositeOperation 'lighter') */
  FX.drawAdd = function (ctx) {
    for (let i = 0; i < FX.add.length; i++) {
      const p = FX.add[i], k = p.t / p.life;
      if (p.kind === 'spark') {
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = p.color; ctx.lineWidth = p.size;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.045, p.y - p.vy * 0.045); ctx.stroke();
      } else if (p.kind === 'glow') {
        const r = Math.max(1, p.size * (1 + p.grow * k));
        ctx.globalAlpha = (1 - k) * (1 - k * 0.5);
        ctx.drawImage(G.gfx.glow(p.color), p.x - r, p.y - r, r * 2, r * 2);
      } else if (p.kind === 'ring') {
        const r = p.size + (p.r1 - p.size) * U.easeOutCubic(k);
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = p.color; ctx.lineWidth = p.lw * (1 - k * 0.6);
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  };
  /* normal layer: smoke and debris */
  FX.drawNorm = function (ctx) {
    for (let i = 0; i < FX.norm.length; i++) {
      const p = FX.norm[i], k = p.t / p.life;
      if (p.kind === 'smoke') {
        ctx.globalAlpha = 0.32 * (1 - k);
        ctx.fillStyle = '#2b2f40';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 + p.grow * k), 0, TAU); ctx.fill();
      } else {
        ctx.globalAlpha = Math.min(1, (1 - k) * 2);
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = '#1a2036'; ctx.strokeStyle = p.color; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(p.size, 0); ctx.lineTo(-p.size * 0.6, p.size * 0.7); ctx.lineTo(-p.size * 0.4, -p.size * 0.8); ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  };
  FX.drawText = function (ctx) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const t of FX.texts) {
      const k = t.t / t.life;
      ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      ctx.font = `800 ${t.size}px "Segoe UI", system-ui, sans-serif`;
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,20,0.8)'; ctx.strokeText(t.str, t.x, t.y);
      ctx.fillStyle = t.color; ctx.fillText(t.str, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  };

  G.fx = FX;
})((window.SGS = window.SGS || {}));
