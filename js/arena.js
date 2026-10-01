/* The grid arena: occupancy, obstacle layouts, portal edges, sweeping laser gates and the glowing floor. */
(function (G) {
  'use strict';
  const U = G.U, C = G.C, TAU = U.TAU;
  const Ar = {};
  G.arena = Ar;
  const COLS = C.COLS, ROWS = C.ROWS, CELL = C.CELL, N = COLS * ROWS;

  const THEMES = [
    { name: 'The Grid', floor: '#020b17', line: '60,200,255', accent: 195, obs: '#06223a' },
    { name: 'Ember Circuit', floor: '#120804', line: '255,150,60', accent: 28, obs: '#2a1308' },
    { name: 'Neon District', floor: '#0e0418', line: '255,90,220', accent: 310, obs: '#260a3a' },
    { name: 'Data Forest', floor: '#03120a', line: '90,255,150', accent: 140, obs: '#07301a' },
    { name: 'Ice Core', floor: '#06101c', line: '170,210,255', accent: 215, obs: '#0f2440' },
  ];
  Ar.THEMES = THEMES;

  Ar.cols = COLS; Ar.rows = ROWS;
  Ar.idx = (c, r) => r * COLS + c;
  Ar.cx = (c) => C.OX + c * CELL + CELL / 2;
  Ar.cy = (r) => C.OY + r * CELL + CELL / 2;

  /* cell index for (c,r), wrapping on portal arenas; -1 if outside a walled arena */
  Ar.norm = function (c, r) {
    if (Ar.wrap) return Ar.idx(((c % COLS) + COLS) % COLS, ((r % ROWS) + ROWS) % ROWS);
    return c < 0 || r < 0 || c >= COLS || r >= ROWS ? -1 : Ar.idx(c, r);
  };

  const SPAWNS = [[5, 17, 1], [58, 17, 3], [32, 5, 2], [32, 28, 0], [5, 5, 1], [58, 28, 3], [58, 5, 3], [5, 28, 1]];
  Ar.spawn = (i) => SPAWNS[i % SPAWNS.length];

  function rect(c, r, w, h, mirror) {
    const put = (cc, rr) => { for (let y = rr; y < rr + h; y++) for (let x = cc; x < cc + w; x++) if (x >= 0 && y >= 0 && x < COLS && y < ROWS) Ar.grid[Ar.idx(x, y)] = -1; };
    put(c, r);
    if (mirror) { put(COLS - c - w, r); put(c, ROWS - r - h); put(COLS - c - w, ROWS - r - h); }
  }

  const LAYOUTS = {
    open() {},
    blocks() { for (let i = 0; i < 4; i++) rect(U.randInt(9, 26), U.randInt(4, 13), U.randInt(2, 5), U.randInt(2, 4), true); },
    pillars() { for (let c = 12; c < 32; c += 9) for (let r = 6; r < 17; r += 8) rect(c, r, 2, 2, true); },
    maze() { rect(14, 8, 14, 1, true); rect(20, 14, 1, 6, true); rect(30, 12, 1, 5, false); rect(33, 17, 1, 5, false); rect(10, 15, 5, 1, true); },
  };

  Ar.reset = function (spec, themeIdx) {
    Ar.spec = spec; Ar.wrap = !!spec.wrap; Ar.themeIdx = themeIdx % THEMES.length; Ar.theme = THEMES[Ar.themeIdx];
    Ar.grid = new Int8Array(N);
    Ar.segX = new Float32Array(N); Ar.segY = new Float32Array(N); Ar.born = new Float32Array(N);
    (LAYOUTS[spec.layout] || LAYOUTS.open)();
    for (const s of SPAWNS) {
      for (let y = s[1] - 4; y <= s[1] + 4; y++) for (let x = s[0] - 5; x <= s[0] + 5; x++) {
        if (x >= 0 && y >= 0 && x < COLS && y < ROWS && Ar.grid[Ar.idx(x, y)] === -1) Ar.grid[Ar.idx(x, y)] = 0;
      }
    }
    Ar.gates = [];
    for (let i = 0; i < (spec.gates || 0); i++) {
      const h = i % 2 === 0, lim = h ? ROWS : COLS;
      Ar.gates.push({ axis: h ? 'h' : 'v', pos: U.rand(8, lim - 8), dir: Math.random() < 0.5 ? 1 : -1, speed: 2.4 + 0.4 * i, gapLen: 8, gapStart: U.randInt(6, (h ? COLS : ROWS) - 16), t: 0 });
    }
    Ar.buildStatic();
  };

  Ar.updateGates = function (dt) {
    for (const g of Ar.gates) {
      const lim = g.axis === 'h' ? ROWS : COLS;
      g.pos += g.dir * g.speed * dt; g.t += dt;
      if (g.pos < 5) { g.pos = 5; g.dir = 1; } else if (g.pos > lim - 6) { g.pos = lim - 6; g.dir = -1; }
    }
  };
  Ar.gateHit = function (c, r) {
    for (const g of Ar.gates) {
      const line = Math.round(g.pos), along = g.axis === 'h' ? c : r, across = g.axis === 'h' ? r : c;
      if (across === line && !(along >= g.gapStart && along < g.gapStart + g.gapLen)) return true;
    }
    return false;
  };
  Ar._TAU = TAU;

  /* ---------- static layer: floor grid + obstacles ---------- */
  /* pre-rendered at the actual device scale so the per-frame blit is a 1:1 copy (scaled blits of big canvases are the costly part) */
  Ar.scale = 1.25;
  Ar.setScale = function (sc) {
    sc = U.clamp(sc, 0.5, 2.2);
    if (Math.abs(sc - Ar.scale) < 0.02) return;
    Ar.scale = sc;
    if (Ar.grid) Ar.buildStatic();
  };
  Ar.buildStatic = function () {
    const SC = Ar.scale, T = Ar.theme, c = document.createElement('canvas');
    c.width = Math.round(C.W * SC); c.height = Math.round(C.H * SC);
    const x = c.getContext('2d');
    x.scale(c.width / C.W, c.height / C.H);
    const bg = x.createRadialGradient(C.W / 2, C.H / 2, 60, C.W / 2, C.H / 2, C.W * 0.65);
    bg.addColorStop(0, T.floor); bg.addColorStop(1, '#010308');
    x.fillStyle = bg; x.fillRect(0, 0, C.W, C.H);
    x.lineWidth = 1;
    for (let i = 0; i <= COLS; i++) { x.strokeStyle = 'rgba(' + T.line + ',' + (i % 8 === 0 ? 0.2 : 0.07) + ')'; x.beginPath(); x.moveTo(C.OX + i * CELL, C.OY); x.lineTo(C.OX + i * CELL, C.OY + ROWS * CELL); x.stroke(); }
    for (let j = 0; j <= ROWS; j++) { x.strokeStyle = 'rgba(' + T.line + ',' + (j % 8 === 0 ? 0.2 : 0.07) + ')'; x.beginPath(); x.moveTo(C.OX, C.OY + j * CELL); x.lineTo(C.OX + COLS * CELL, C.OY + j * CELL); x.stroke(); }
    x.shadowColor = 'rgba(' + T.line + ',0.9)'; x.shadowBlur = 8;
    const solid = (a, b) => a >= 0 && b >= 0 && a < COLS && b < ROWS && Ar.grid[Ar.idx(a, b)] === -1;
    for (let r = 0; r < ROWS; r++) {
      for (let q = 0; q < COLS; q++) {
        if (!solid(q, r)) continue;
        const px = C.OX + q * CELL, py = C.OY + r * CELL;
        x.fillStyle = T.obs; x.fillRect(px, py, CELL, CELL);
        x.strokeStyle = 'rgba(' + T.line + ',0.95)'; x.lineWidth = 1.6;
        x.beginPath();
        if (!solid(q, r - 1)) { x.moveTo(px, py); x.lineTo(px + CELL, py); }
        if (!solid(q, r + 1)) { x.moveTo(px, py + CELL); x.lineTo(px + CELL, py + CELL); }
        if (!solid(q - 1, r)) { x.moveTo(px, py); x.lineTo(px, py + CELL); }
        if (!solid(q + 1, r)) { x.moveTo(px + CELL, py); x.lineTo(px + CELL, py + CELL); }
        x.stroke();
      }
    }
    x.shadowBlur = 0;
    x.save();
    if (Ar.wrap) { x.strokeStyle = 'rgba(190,140,255,0.85)'; x.shadowColor = '#b478ff'; } else { x.strokeStyle = 'rgba(' + T.line + ',0.95)'; x.shadowColor = 'rgba(' + T.line + ',1)'; }
    x.lineWidth = 3; x.shadowBlur = 14;
    x.strokeRect(C.OX + 1.5, C.OY + 1.5, COLS * CELL - 3, ROWS * CELL - 3); x.restore();
    Ar.staticCanvas = c;
  };

  Ar.drawFloor = function (ctx, t) {
    if (Ar.staticCanvas) ctx.drawImage(Ar.staticCanvas, 0, 0, C.W, C.H);
    const T = Ar.theme, w = COLS * CELL, h = ROWS * CELL;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 14; i++) {
      const horiz = i % 2 === 0, k = (i * 7 + 3) % (horiz ? ROWS : COLS), p = (t * (60 + i * 9) + i * 211) % (horiz ? w : h);
      ctx.fillStyle = 'rgba(' + T.line + ',0.5)';
      if (horiz) ctx.fillRect(C.OX + p, C.OY + k * CELL - 1, 22, 2); else ctx.fillRect(C.OX + k * CELL - 1, C.OY + p, 2, 22);
    }
    ctx.restore();
    if (Ar.wrap) {
      // portal shimmer: bright dashes circling the perimeter (cheap fills instead of an animated dashed stroke)
      const per = 2 * (w + h);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(225,190,255,0.9)';
      for (let i = 0; i < 22; i++) {
        let d = ((t * 90 + i * per / 22) % per), x, y;
        if (d < w) { x = C.OX + d; y = C.OY + 1.5; } else if (d < w + h) { x = C.OX + w - 1.5; y = C.OY + d - w; } else if (d < 2 * w + h) { x = C.OX + w - (d - w - h); y = C.OY + h - 1.5; } else { x = C.OX + 1.5; y = C.OY + h - (d - 2 * w - h); }
        ctx.fillRect(x - 5, y - 2.2, 10, 4.4);
      }
      ctx.restore();
    }
  };

  Ar.drawGates = function (ctx, t) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'butt';
    for (const g of Ar.gates) {
      const h = g.axis === 'h', len = h ? COLS : ROWS;
      const base = h ? C.OY + Math.round(g.pos) * CELL + CELL / 2 : C.OX + Math.round(g.pos) * CELL + CELL / 2;
      const seg = (a, b) => {
        ctx.beginPath();
        if (h) { ctx.moveTo(C.OX + a * CELL, base); ctx.lineTo(C.OX + b * CELL, base); } else { ctx.moveTo(base, C.OY + a * CELL); ctx.lineTo(base, C.OY + b * CELL); }
        ctx.stroke();
      };
      ctx.strokeStyle = 'rgba(255,70,50,0.45)'; ctx.lineWidth = 11; seg(0, g.gapStart); seg(g.gapStart + g.gapLen, len);
      ctx.strokeStyle = 'rgba(255,230,210,' + (0.75 + 0.2 * Math.sin(t * 40)) + ')'; ctx.lineWidth = 3; seg(0, g.gapStart); seg(g.gapStart + g.gapLen, len);
      const mid = g.gapStart + g.gapLen / 2, gx = h ? C.OX + mid * CELL : base, gy = h ? base : C.OY + mid * CELL;
      ctx.fillStyle = 'rgba(120,255,190,0.6)'; ctx.beginPath(); ctx.arc(gx, gy, 5 + Math.sin(t * 6) * 1.5, 0, TAU); ctx.fill();
    }
    ctx.restore();
  };
})((window.SGS = window.SGS || {}));
