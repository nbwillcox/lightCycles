/* Light cycles: grid movement with buffered turns, permanent light walls, derezzing, discs and T-walls. */
(function (G) {
  'use strict';
  const U = G.U, C = G.C, FX = G.fx, A = G.audio, Ar = G.arena, TAU = U.TAU;
  const COLS = C.COLS;
  const Cy = {};
  G.cycles = Cy;
  const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
  Cy.DX = DX; Cy.DY = DY;
  let uid = 0;

  Cy.byId = (g, id) => g.cycles.find((q) => q.id === id);

  Cy.create = function (g, o) {
    const sp = Ar.spawn(o.slot);
    uid = uid >= 100 ? 1 : uid + 1;
    const cy = {
      id: uid, name: o.name, color: o.color, hue: o.hue, human: !!o.human, ai: o.ai || null, skill: o.skill || 0.6, elite: !!o.elite,
      c: sp[0], r: sp[1], dir: sp[2], alive: true, speed: o.speed, acc: 0, queue: [], energy: 100, boost: false, shield: 0, ghost: 0, over: 0, discs: 0, twall: 0,
      trail: [], maxLen: o.maxLen || 0, dissolveAcc: 0, gone: false, flash: 0, px: Ar.cx(sp[0]), py: Ar.cy(sp[1]), kills: 0, thinkT: 0, state: {},
    };
    const idx = Ar.idx(cy.c, cy.r);
    Ar.grid[idx] = cy.id; Ar.segX[idx] = Ar.cx(cy.c); Ar.segY[idx] = Ar.cy(cy.r);
    cy.trail.push(idx);
    return cy;
  };

  function freeAhead(cy, d) {
    const idx = Ar.norm(cy.c + DX[d], cy.r + DY[d]);
    return idx >= 0 && Ar.grid[idx] === 0 && !Ar.gateHit(idx % COLS, (idx / COLS) | 0);
  }

  /* one grid step */
  Cy.step = function (g, cy) {
    while (cy.queue.length) {
      const d = cy.queue.shift();
      if (d !== cy.dir && d !== (cy.dir + 2) % 4) { cy.dir = d; A.sfx.turn(cy.human); break; }
    }
    const nc = cy.c + DX[cy.dir], nr = cy.r + DY[cy.dir], idx = Ar.norm(nc, nr);
    let hit = null;
    if (idx < 0) hit = { kind: 'border' };
    else if (Ar.grid[idx] === -1) hit = { kind: 'obstacle' };
    else if (Ar.grid[idx] > 0 && cy.ghost <= 0) hit = { kind: 'wall', owner: Ar.grid[idx] };
    else if (Ar.gateHit(idx % COLS, (idx / COLS) | 0)) hit = { kind: 'gate' };
    if (hit) {
      if (cy.shield > 0) {
        cy.shield = 0; cy.flash = 0.4; A.sfx.shieldBreak(); FX.ring(cy.px, cy.py, 6, 40, 'hsla(' + cy.hue + ',100%,70%,1)', 0.4, 3);
        if (!(hit.kind === 'wall' && idx >= 0)) {
          for (const d of [(cy.dir + 1) % 4, (cy.dir + 3) % 4]) if (freeAhead(cy, d)) { cy.dir = d; break; }
          return;
        }
      } else { Cy.derez(g, cy, hit.owner || 0); return; }
    }
    const ox = Ar.cx(cy.c), oy = Ar.cy(cy.r);
    const wrapped = Ar.wrap && (nc < 0 || nc >= COLS || nr < 0 || nr >= C.ROWS);
    cy.c = idx % COLS; cy.r = (idx / COLS) | 0;
    if (wrapped) { FX.ring(Ar.cx(cy.c), Ar.cy(cy.r), 4, 26, 'hsla(270,100%,75%,1)', 0.3, 2); A.sfx.portal(); }
    cy.px = ox; cy.py = oy;
    if (Ar.grid[idx] === 0) {
      Ar.grid[idx] = cy.id;
      Ar.segX[idx] = wrapped ? Ar.cx(cy.c) : ox; Ar.segY[idx] = wrapped ? Ar.cy(cy.r) : oy;
      Ar.born[idx] = g.time;
      cy.trail.push(idx);
      if (cy.maxLen && cy.trail.length > cy.maxLen) { const old = cy.trail.shift(); if (Ar.grid[old] === cy.id) Ar.grid[old] = 0; }
    }
    for (let i = g.pk.length - 1; i >= 0; i--) {
      const p = g.pk[i];
      if (p.c === cy.c && p.r === cy.r) { g.pk.splice(i, 1); Cy.collect(g, cy, p); }
    }
  };

  Cy.derez = function (g, cy, killerId) {
    if (!cy.alive) return;
    cy.alive = false; cy.dissolveAcc = 0;
    const x = Ar.cx(cy.c), y = Ar.cy(cy.r), col = 'hsla(' + cy.hue + ',100%,65%,1)';
    FX.explosion(x, y, 2.4, cy.hue); FX.ring(x, y, 6, 90, col, 0.6, 4); FX.debris(x, y, 14, col, 260); FX.addShake(cy.human ? 9 : 4);
    A.sfx.derez(cy.human);
    if (g.onDerez) g.onDerez(cy, killerId);
  };

  /* ---------- disc: flies forward, cutting walls and derezzing cycles ---------- */
  Cy.fireDisc = function (g, cy) {
    if (cy.discs <= 0 || !cy.alive) return false;
    cy.discs--;
    g.discs.push({ x: cy.c, y: cy.r, dir: cy.dir, owner: cy.id, cuts: 0, dist: 0, hue: cy.hue, t: 0, last: -1, dead: false });
    A.sfx.disc();
    return true;
  };
  Cy.cutCell = function (g, idx) {
    const o = Ar.grid[idx];
    if (o <= 0) return;
    const v = Cy.byId(g, o);
    if (v) { const i = v.trail.indexOf(idx); if (i >= 0) v.trail.splice(i, 1); }
    Ar.grid[idx] = 0;
    FX.sparks(Ar.cx(idx % COLS), Ar.cy((idx / COLS) | 0), 6, 160, v ? 'hsla(' + v.hue + ',100%,70%,1)' : '#fff', 0.35);
  };
  Cy.updateDiscs = function (g, dt) {
    for (const d of g.discs) {
      let move = C.DISC_SPEED * dt;
      while (move > 0 && !d.dead) {
        const s = Math.min(1, move); move -= s;
        d.x += DX[d.dir] * s; d.y += DY[d.dir] * s; d.dist += s; d.t += dt;
        const idx = Ar.norm(Math.round(d.x), Math.round(d.y));
        if (idx < 0 || Ar.grid[idx] === -1 || d.dist > 30) { d.dead = true; break; }
        if (idx === d.last) continue;
        d.last = idx;
        if (Ar.wrap) { d.x = idx % COLS; d.y = (idx / COLS) | 0; }
        const o = Ar.grid[idx];
        if (o > 0 && o !== d.owner) {
          const victim = Cy.byId(g, o);
          if (victim && victim.alive && victim.c === idx % COLS && victim.r === ((idx / COLS) | 0)) { Cy.derez(g, victim, d.owner); d.dead = true; break; }
          Cy.cutCell(g, idx); d.cuts++;
          if (d.cuts >= 10) d.dead = true;
        }
      }
    }
    g.discs = g.discs.filter((d) => !d.dead);
  };

  /* ---------- T-wall: a bar across the heading that cuts through every rival wall it meets ---------- */
  Cy.fireTWall = function (g, cy) {
    if (cy.twall <= 0 || !cy.alive) return false;
    cy.twall--;
    const px = -DY[cy.dir], py = DX[cy.dir];
    for (const side of [-1, 1]) {
      let prevX = Ar.cx(cy.c), prevY = Ar.cy(cy.r);
      for (let k = 1; k <= C.TWALL_REACH; k++) {
        const idx = Ar.norm(cy.c + px * side * k, cy.r + py * side * k);
        if (idx < 0 || Ar.grid[idx] === -1) break;
        const o = Ar.grid[idx];
        if (o > 0 && o !== cy.id) {
          const victim = Cy.byId(g, o);
          if (victim && victim.alive && victim.c === idx % COLS && victim.r === ((idx / COLS) | 0)) Cy.derez(g, victim, cy.id);
          Cy.cutCell(g, idx);
        }
        if (Ar.grid[idx] === 0) { Ar.grid[idx] = cy.id; Ar.segX[idx] = prevX; Ar.segY[idx] = prevY; Ar.born[idx] = g.time; cy.trail.push(idx); }
        prevX = Ar.cx(idx % COLS); prevY = Ar.cy((idx / COLS) | 0);
        if (k % 2 === 0) FX.sparks(prevX, prevY, 3, 120, 'hsla(' + cy.hue + ',100%,75%,1)', 0.4);
      }
    }
    FX.ring(Ar.cx(cy.c), Ar.cy(cy.r), 6, 70, 'hsla(' + cy.hue + ',100%,75%,1)', 0.5, 4); FX.doFlash(0.3, '220,250,255'); FX.addShake(7);
    A.sfx.twall();
    return true;
  };

  /* ---------- pickups: E energy cell, S shield, D discs, G ghost, O overdrive, T T-wall (rare) ---------- */
  const KINDS = [['E', 36], ['S', 14], ['D', 14], ['G', 10], ['O', 12], ['T', 3]];
  Cy.spawnPickup = function (g) {
    let tot = 0; for (const k of KINDS) tot += k[1];
    let r = Math.random() * tot, kind = 'E';
    for (const k of KINDS) { r -= k[1]; if (r <= 0) { kind = k[0]; break; } }
    for (let tries = 0; tries < 60; tries++) {
      const c = U.randInt(3, C.COLS - 4), rr = U.randInt(3, C.ROWS - 4), idx = Ar.idx(c, rr);
      if (Ar.grid[idx] !== 0 || Ar.gateHit(c, rr) || g.pk.some((p) => p.c === c && p.r === rr)) continue;
      if (g.cycles.some((q) => q.alive && Math.abs(q.c - c) + Math.abs(q.r - rr) < 6)) continue;
      g.pk.push({ c, r: rr, kind, t: 0 });
      FX.ring(Ar.cx(c), Ar.cy(rr), 4, 26, 'hsla(50,100%,70%,1)', 0.35, 2);
      return;
    }
  };
  Cy.collect = function (g, cy, p) {
    const x = Ar.cx(p.c), y = Ar.cy(p.r), col = 'hsla(' + cy.hue + ',100%,70%,1)';
    FX.sparks(x, y, 12, 180, col, 0.45); FX.ring(x, y, 4, 34, col, 0.35, 2);
    let label = '';
    if (p.kind === 'E') { cy.energy = Math.min(100, cy.energy + 45); label = 'ENERGY'; if (cy.maxLen) cy.maxLen += 10; }
    else if (p.kind === 'S') { cy.shield = 1; label = 'SHIELD'; }
    else if (p.kind === 'D') { cy.discs = Math.min(3, cy.discs + 2); label = 'DISCS'; }
    else if (p.kind === 'G') { cy.ghost = 3; label = 'GHOST'; }
    else if (p.kind === 'O') { cy.over = 4; cy.energy = 100; label = 'OVERDRIVE'; }
    else { cy.twall = Math.min(1, cy.twall + 1); label = 'T-WALL'; }
    if (cy.human) { A.sfx.pickup(); FX.text(x, y - 14, label, '#ffe27a', 15); if (g.addScore) g.addScore(50); }
  };

  /* ---------- per-frame update ---------- */
  Cy.update = function (g, dt) {
    const I = G.input;
    Ar.updateGates(dt);
    for (const p of g.pk) p.t += dt;
    if (g.state === 'play') { g.pkT -= dt; if (g.pkT <= 0) { g.pkT = U.rand(3.2, 5.5); if (g.pk.length < 4) Cy.spawnPickup(g); } }
    Cy.updateDiscs(g, dt);
    for (const cy of g.cycles) {
      if (!cy.alive) {
        cy.dissolveAcc += dt * 80;
        while (cy.dissolveAcc >= 1 && cy.trail.length) {
          cy.dissolveAcc--;
          const idx = cy.trail.shift();
          if (Ar.grid[idx] === cy.id) { Ar.grid[idx] = 0; if (Math.random() < 0.25) FX.sparks(Ar.segX[idx], Ar.segY[idx], 1, 70, 'hsla(' + cy.hue + ',100%,65%,1)', 0.3, 1.2); }
        }
        if (!cy.trail.length) cy.gone = true;
        continue;
      }
      if (g.state !== 'play') continue;
      if (cy.flash > 0) cy.flash -= dt;
      if (cy.over > 0) cy.over -= dt;
      if (cy.ghost > 0) {
        cy.ghost -= dt;
        if (cy.ghost <= 0) { const o = Ar.grid[Ar.idx(cy.c, cy.r)]; if (o !== cy.id && o !== 0) Cy.derez(g, cy, o > 0 ? o : 0); }
      }
      if (cy.human) {
        for (const d of I.takeTurns()) if (cy.queue.length < 3) cy.queue.push(d);
        cy.boost = I.boost && (cy.energy > 0 || cy.over > 0);
        if (I.takeDisc()) Cy.fireDisc(g, cy);
        if (I.takeTWall()) Cy.fireTWall(g, cy);
      }
      let mul = 1;
      if (cy.boost) {
        mul = C.BOOST_MUL;
        if (cy.over <= 0) { cy.energy -= C.BOOST_DRAIN * dt; if (cy.energy <= 0) { cy.energy = 0; cy.boost = false; } }
      } else cy.energy = Math.min(100, cy.energy + C.BOOST_REGEN * dt);
      cy.acc += cy.speed * mul * dt;
      let steps = 0;
      while (cy.acc >= 1 && cy.alive && steps < 3) {
        cy.acc -= 1; steps++;
        if (!cy.human && G.ai) G.ai.decide(g, cy);
        Cy.step(g, cy);
      }
      if (cy.alive && cy.shield <= 0 && Ar.gateHit(cy.c, cy.r)) Cy.derez(g, cy, 0);
      if (cy.alive && Math.random() < (cy.boost ? 0.7 : 0.15)) {
        const ang = cy.dir * Math.PI / 2 - Math.PI / 2, x = Ar.cx(cy.c) - Math.cos(ang) * 8, y = Ar.cy(cy.r) - Math.sin(ang) * 8;
        FX.trail(x, y, 'hsla(' + cy.hue + ',100%,65%,1)', cy.boost ? 9 : 5, 0.2);
      }
    }
    g.cycles = g.cycles.filter((q) => !q.gone || q.human);
  };

  /* ---------- drawing ---------- */
  function trailPath(ctx, cy) {
    ctx.beginPath();
    for (const idx of cy.trail) { ctx.moveTo(Ar.segX[idx], Ar.segY[idx]); ctx.lineTo(Ar.cx(idx % COLS), Ar.cy((idx / COLS) | 0)); }
  }
  Cy.headPos = function (cy) {
    const k = Math.min(1, cy.acc) * C.CELL * 0.9;
    return { x: Ar.cx(cy.c) + DX[cy.dir] * k, y: Ar.cy(cy.r) + DY[cy.dir] * k };
  };

  function drawPickup(ctx, p, t) {
    const x = Ar.cx(p.c), y = Ar.cy(p.r), hue = { E: 50, S: 205, D: 28, G: 280, O: 330, T: 10 }[p.kind];
    const pulse = 1 + Math.sin(t * 6 + p.c) * 0.12;
    ctx.globalCompositeOperation = 'lighter'; G.gfx.drawGlow(ctx, 'hsla(' + hue + ',100%,60%,1)', x, y, 22 * pulse, p.kind === 'T' ? 1 : 0.7); ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(4,8,20,0.92)'; ctx.beginPath();
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + t * (p.kind === 'T' ? 2 : 0.6); ctx.lineTo(x + Math.cos(a) * 8 * pulse, y + Math.sin(a) * 8 * pulse); }
    ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'hsl(' + hue + ',100%,70%)'; ctx.lineWidth = 1.8; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = '800 9px "Segoe UI", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.kind, x, y + 0.5);
  }

  function drawBike(ctx, cy, t) {
    const h = Cy.headPos(cy), ang = cy.dir * Math.PI / 2 - Math.PI / 2, hue = cy.hue;
    ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(ang);
    if (cy.ghost > 0) ctx.globalAlpha = 0.45 + 0.2 * Math.sin(t * 30);
    ctx.globalCompositeOperation = 'lighter';
    G.gfx.drawGlow(ctx, 'hsla(' + hue + ',100%,60%,1)', 0, 0, cy.boost ? 24 : 17, 0.75);
    if (cy.boost) { ctx.fillStyle = 'hsla(' + hue + ',100%,70%,0.55)'; ctx.beginPath(); ctx.moveTo(-9, -3); ctx.lineTo(-24 - Math.random() * 8, 0); ctx.lineTo(-9, 3); ctx.closePath(); ctx.fill(); }
    ctx.globalCompositeOperation = 'source-over';
    ctx.shadowColor = 'hsla(' + hue + ',100%,65%,1)'; ctx.shadowBlur = 10;
    ctx.fillStyle = '#05091a'; ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(4, -4.6); ctx.lineTo(-8, -4.2); ctx.lineTo(-10, 0); ctx.lineTo(-8, 4.2); ctx.lineTo(4, 4.6); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'hsl(' + hue + ',100%,68%)'; ctx.lineWidth = 1.8; ctx.stroke(); ctx.shadowBlur = 0;
    ctx.fillStyle = 'hsl(' + hue + ',100%,78%)'; ctx.beginPath(); ctx.ellipse(1, 0, 4.2, 2.4, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(6, -0.8, 5, 1.6);
    if (cy.elite) { ctx.strokeStyle = 'rgba(255,230,120,' + (0.6 + 0.3 * Math.sin(t * 8)) + ')'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, 12, 0, TAU); ctx.stroke(); }
    if (cy.shield > 0) { ctx.strokeStyle = 'rgba(150,225,255,0.9)'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(0, 0, 13, 0, TAU); ctx.stroke(); }
    ctx.restore();
  }

  Cy.draw = function (ctx, g) {
    const t = g.time;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const cy of g.cycles) {
      if (!cy.trail.length) continue;
      const a = cy.alive ? 1 : 0.65;
      ctx.globalCompositeOperation = 'lighter';
      trailPath(ctx, cy);
      ctx.strokeStyle = 'hsla(' + cy.hue + ',100%,55%,' + 0.32 * a + ')'; ctx.lineWidth = 9; ctx.stroke();
      ctx.strokeStyle = 'hsla(' + cy.hue + ',100%,68%,' + 0.9 * a + ')'; ctx.lineWidth = 4; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,' + 0.85 * a + ')'; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
    for (const d of g.discs) {
      const x = C.OX + (d.x + 0.5) * C.CELL, y = C.OY + (d.y + 0.5) * C.CELL;
      ctx.globalCompositeOperation = 'lighter';
      G.gfx.drawGlow(ctx, 'hsla(' + d.hue + ',100%,65%,1)', x, y, 18, 0.8);
      ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(x, y, 7, d.t * 18, d.t * 18 + Math.PI * 1.5); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
    for (const p of g.pk) drawPickup(ctx, p, t);
    for (const cy of g.cycles) if (cy.alive) drawBike(ctx, cy, t);
  };
})((window.SGS = window.SGS || {}));
