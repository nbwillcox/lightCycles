/* Rival cycles: flood-fill safety plus personality (Cutter, Hoarder, Tracker, Gambler, Elite). */
(function (G) {
  'use strict';
  const U = G.U, C = G.C, Ar = G.arena, Cy = G.cycles;
  const COLS = C.COLS, ROWS = C.ROWS, N = COLS * ROWS;
  const AI = {};
  G.ai = AI;
  const DX = Cy.DX, DY = Cy.DY;
  const stamp = new Int32Array(N), qu = new Int32Array(N), lab = new Int8Array(N);
  let cur = 0;

  function open(idx) { return idx >= 0 && Ar.grid[idx] === 0 && !Ar.gateHit(idx % COLS, (idx / COLS) | 0); }

  /* number of free cells reachable from idx (capped) */
  function area(idx, limit) {
    cur++;
    let h = 0, t = 0, n = 0;
    qu[t++] = idx; stamp[idx] = cur;
    while (h < t && n < limit) {
      const i = qu[h++]; n++;
      const c = i % COLS, r = (i / COLS) | 0;
      for (let d = 0; d < 4; d++) {
        const j = Ar.norm(c + DX[d], r + DY[d]);
        if (j >= 0 && stamp[j] !== cur && open(j)) { stamp[j] = cur; qu[t++] = j; }
      }
    }
    return n;
  }

  /* cells I reach before anyone else (multi-source BFS), starting from my candidate cell */
  function territory(g, me, startIdx) {
    cur++;
    let h = 0, t = 0, mine = 0, theirs = 0;
    qu[t++] = startIdx; stamp[startIdx] = cur; lab[startIdx] = 1;
    for (const o of g.cycles) {
      if (!o.alive || o === me) continue;
      const i = Ar.idx(o.c, o.r);
      if (stamp[i] !== cur) { stamp[i] = cur; lab[i] = 2; qu[t++] = i; }
    }
    while (h < t && h < 1400) {
      const i = qu[h++], c = i % COLS, r = (i / COLS) | 0, l = lab[i];
      if (l === 1) mine++; else theirs++;
      for (let d = 0; d < 4; d++) {
        const j = Ar.norm(c + DX[d], r + DY[d]);
        if (j >= 0 && stamp[j] !== cur && open(j)) { stamp[j] = cur; lab[j] = l; qu[t++] = j; }
      }
    }
    return mine - theirs;
  }

  function nearestEnemy(g, cy) {
    let best = null, bd = 1e9;
    for (const o of g.cycles) {
      if (!o.alive || o === cy) continue;
      const d = Math.abs(o.c - cy.c) + Math.abs(o.r - cy.r) - (o.human ? 6 : 0);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  AI.decide = function (g, cy) {
    const tgt = nearestEnemy(g, cy), type = cy.ai;
    const cands = [];
    for (const k of [0, 1, 3]) {
      const d = (cy.dir + k) % 4, idx = Ar.norm(cy.c + DX[d], cy.r + DY[d]);
      if (!open(idx)) continue;
      const nc = idx % COLS, nr = (idx / COLS) | 0;
      let s = Math.min(area(idx, 260), 260);
      const tight = s < 28;
      if (tight) s -= 400;
      if (k === 0) s += 4;
      if (tgt) {
        const ahead = { c: tgt.c + DX[tgt.dir] * 6, r: tgt.r + DY[tgt.dir] * 6 };
        const dist = Math.abs(nc - ahead.c) + Math.abs(nr - ahead.r), dHead = Math.abs(nc - tgt.c) + Math.abs(nr - tgt.r);
        if (dHead <= 1) s -= 300; // never kiss a head-on
        if (type === 'cutter') s += -dist * 5 + (g.cycles.length < 3 ? 0 : 0);
        else if (type === 'tracker') {
          let near = 0;
          for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) { const j = Ar.norm(nc + x, nr + y); if (j >= 0 && Ar.grid[j] === tgt.id) near++; }
          s += near * 14 - Math.abs(dHead - 5) * 3;
        } else if (type === 'elite') s += territory(g, cy, idx) * 0.9 - dist * 3;
        else if (type === 'gambler') s += Math.random() * 90 - dist * 1.5;
      }
      if (type === 'hoarder') s += Math.min(nc, COLS - 1 - nc, nr, ROWS - 1 - nr) * 2.2 + area(idx, 120) * 0.5;
      // gravitate toward pickups when it is safe
      if (!tight && g.pk.length) {
        let bd = 1e9, cd = 1e9;
        for (const p of g.pk) { const a = Math.abs(p.c - nc) + Math.abs(p.r - nr), b = Math.abs(p.c - cy.c) + Math.abs(p.r - cy.r); if (a < bd) { bd = a; cd = b; } }
        s += (cd - bd) * (type === 'gambler' ? 14 : 7);
      }
      cands.push({ d, s, tight });
    }
    if (!cands.length) return;
    cands.sort((a, b) => b.s - a.s);
    let pick = cands[0];
    if (cands.length > 1 && !pick.tight && Math.random() < (1 - cy.skill) * 0.22) pick = cands[1 + Math.floor(Math.random() * (cands.length - 1))];
    if (pick.d !== cy.dir) cy.queue = [pick.d];
    // tools: boost, discs, T-wall
    if (tgt) {
      const dx = tgt.c - cy.c, dy = tgt.r - cy.r, dist = Math.abs(dx) + Math.abs(dy);
      cy.boost = cy.energy > 30 && (type === 'cutter' || type === 'elite' || type === 'gambler') && dist < 16 && Math.random() < 0.35;
      if (cy.discs > 0) {
        const along = DX[cy.dir] * dx + DY[cy.dir] * dy, perp = DX[cy.dir] * dy - DY[cy.dir] * dx;
        if (along > 2 && along < 18 && Math.abs(perp) <= 1 && Math.random() < (cy.elite ? 0.7 : 0.3)) Cy.fireDisc(g, cy);
      }
      if (cy.twall > 0) {
        const along = DX[cy.dir] * dx + DY[cy.dir] * dy, perp = Math.abs(DX[cy.dir] * dy - DY[cy.dir] * dx);
        if (Math.abs(along) <= 3 && perp <= 11 && perp > 2) Cy.fireTWall(g, cy);
      }
    }
  };
})((window.SGS = window.SGS || {}));
