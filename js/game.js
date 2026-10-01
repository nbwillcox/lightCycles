/* Core game state: modes (campaign, survival, attract), rounds, scoring and flow. */
(function (G) {
  'use strict';
  const U = G.U, C = G.C, FX = G.fx, A = G.audio, I = G.input, Ar = G.arena, Cy = G.cycles;
  const Game = { state: 'title', demo: true, mode: 'attract', time: 0 };
  G.game = Game;

  const SPECS = [
    { layout: 'open', wrap: false, gates: 0 }, { layout: 'blocks', wrap: false, gates: 0 }, { layout: 'open', wrap: true, gates: 0 },
    { layout: 'pillars', wrap: false, gates: 1 }, { layout: 'blocks', wrap: true, gates: 0 }, { layout: 'maze', wrap: false, gates: 0 },
    { layout: 'blocks', wrap: true, gates: 1 }, { layout: 'pillars', wrap: true, gates: 0 }, { layout: 'maze', wrap: false, gates: 2 }, { layout: 'open', wrap: true, gates: 2 },
  ];
  const RIVAL_HUES = [28, 310, 95, 52, 0, 270];
  const PERSONALITIES = ['cutter', 'hoarder', 'tracker', 'gambler'];
  const NAMES = { cutter: 'CUTTER', hoarder: 'HOARDER', tracker: 'TRACKER', gambler: 'GAMBLER', elite: 'ELITE' };
  Game.NAMES = NAMES;

  Game.reset = function (mode, startRound) {
    this.mode = mode; this.demo = mode === 'attract';
    this.score = 0; this.lives = mode === 'campaign' ? C.START_LIVES : 1; this.round = 0;
    this.lifeIdx = 0; this.nextLifeAt = C.EXTRA_LIFE_AT[0];
    this.cycles = []; this.pk = []; this.discs = []; this.pkT = 3; this.banner = null; this.timer = 0; this.over = false; this.overDone = false;
    this.player = null; this.surv = { t: 0, respawn: 0, scoreT: 0 }; this.kills = 0; this.elapsed = 0;
    this.hi = G.scores.best();
    FX.reset();
    this.startRound(startRound || 1);
  };

  /* ---------- scoring ---------- */
  Game.addScore = function (v) {
    if (this.demo) return;
    this.score += v;
    if (this.mode !== 'campaign') return;
    while (this.score >= this.nextLifeAt) {
      this.lives = Math.min(9, this.lives + 1);
      this.lifeIdx++;
      this.nextLifeAt = this.lifeIdx < C.EXTRA_LIFE_AT.length ? C.EXTRA_LIFE_AT[this.lifeIdx] : this.nextLifeAt + C.EXTRA_LIFE_EVERY;
      A.sfx.extraLife();
      this.banner = { text: 'EXTRA LIFE', sub: '', t: 0, life: 1.6, small: true };
    }
  };

  /* ---------- rounds ---------- */
  Game.makeSpec = function (n) {
    if (this.mode === 'survival') return { layout: U.pick(['blocks', 'pillars', 'open']), wrap: Math.random() < 0.6, gates: Math.random() < 0.5 ? 1 : 0 };
    if (this.mode === 'attract') return { layout: U.pick(['blocks', 'open', 'pillars']), wrap: Math.random() < 0.5, gates: 0 };
    return SPECS[(n - 1) % SPECS.length];
  };

  Game.speedFor = function (n) { return Math.min(20, C.BASE_SPEED + 0.6 * (n - 1)); };

  Game.startRound = function (n) {
    this.round = n;
    Ar.reset(this.makeSpec(n), Math.floor((n - 1) / C.ELITE_EVERY));
    this.world = Ar.themeIdx;
    Cy.initLayer();
    this.cycles = []; this.pk = []; this.discs = []; this.pkT = 3;
    const sp = this.speedFor(n), surv = this.mode === 'survival', cap = surv ? 90 : 0;
    if (this.mode === 'attract') {
      ['cutter', 'hoarder', 'tracker', 'gambler'].slice(0, 3 + (Math.random() < 0.5 ? 1 : 0)).forEach((ai, i) => {
        this.cycles.push(Cy.create(this, { slot: i, name: NAMES[ai], hue: [195, 28, 310, 95][i], ai, skill: 0.85, speed: 12 }));
      });
    } else {
      this.player = Cy.create(this, { slot: 0, name: 'YOU', hue: 192, human: true, speed: sp, maxLen: cap });
      this.cycles.push(this.player);
      if (surv) this.surv = { t: 0, respawn: 0, scoreT: 0, hueI: 0 };
      else this.spawnRivals(n, sp);
    }
    this.state = 'intro'; this.timer = 3.2;
    const elite = !surv && n % C.ELITE_EVERY === 0 && this.mode === 'campaign';
    this.banner = { text: surv ? 'SURVIVAL' : elite ? 'ELITE DUEL' : 'ROUND ' + n, sub: Ar.theme.name.toUpperCase() + (Ar.wrap ? '  -  PORTAL EDGES' : ''), t: 0, life: 2.6 };
    if (!this.demo) { A.music(elite ? 'boss' : 'play', n >= 3 ? 2 : 1, [0, 2, -2, 3, 5][Math.floor((n - 1) / C.ELITE_EVERY) % 5]); }
    G.onStage && G.onStage(n);
  };

  Game.spawnRivals = function (n, sp) {
    const elite = n % C.ELITE_EVERY === 0;
    if (elite) {
      this.cycles.push(Cy.create(this, { slot: 1, name: 'ELITE', hue: 48, ai: 'elite', skill: 0.97, elite: true, speed: sp * 1.06 }));
      return;
    }
    const count = Math.min(1 + Math.floor((n - 1) / 2), 5);
    for (let i = 0; i < count; i++) {
      const ai = PERSONALITIES[(n + i) % PERSONALITIES.length];
      this.cycles.push(Cy.create(this, { slot: 1 + i, name: NAMES[ai], hue: RIVAL_HUES[i % RIVAL_HUES.length], ai, skill: Math.min(0.94, 0.55 + 0.04 * n), speed: sp * (0.93 + 0.015 * i) }));
    }
  };

  /* survival: keep a growing swarm of rivals on the grid */
  Game.survivalSpawn = function (dt) {
    const s = this.surv;
    s.t += dt; s.scoreT += dt;
    if (s.scoreT >= 1) { s.scoreT -= 1; this.addScore(10); }
    const alive = this.cycles.filter((c) => !c.human && c.alive).length, want = Math.min(2 + Math.floor(s.t / 25), 6);
    s.respawn -= dt;
    if (alive < want && s.respawn <= 0) {
      s.respawn = 1.4;
      for (let slot = 1; slot < 8; slot++) {
        const sp = Ar.spawn(slot);
        if (this.cycles.some((c) => c.alive && Math.abs(c.c - sp[0]) + Math.abs(c.r - sp[1]) < 14)) continue;
        if (Ar.grid[Ar.idx(sp[0], sp[1])] !== 0) continue;
        const ai = PERSONALITIES[Math.floor(Math.random() * 4)];
        s.hueI = (s.hueI + 1) % RIVAL_HUES.length;
        this.cycles.push(Cy.create(this, { slot, name: NAMES[ai], hue: RIVAL_HUES[s.hueI], ai, skill: Math.min(0.94, 0.6 + s.t / 400), speed: Math.min(20, 12 + s.t * 0.05), maxLen: 90 }));
        FX.ring(Ar.cx(sp[0]), Ar.cy(sp[1]), 4, 40, 'hsla(' + RIVAL_HUES[s.hueI] + ',100%,70%,1)', 0.4, 3);
        break;
      }
    }
  };

  /* ---------- derez events ---------- */
  Game.onDerez = function (cy, killerId) {
    const killer = Cy.byId(this, killerId);
    if (killer && killer !== cy) {
      killer.kills++;
      if (killer.human && !cy.human) {
        const v = cy.elite ? 2500 : 500;
        this.addScore(v); this.kills++;
        FX.text(Ar.cx(cy.c), Ar.cy(cy.r) - 16, '+' + v, '#ffd24a', cy.elite ? 24 : 18);
        A.sfx.combo(2);
      }
    }
    if (cy.human && this.mode === 'campaign') this.lives = Math.max(0, this.lives - 1);
  };

  Game.beginOver = function () {
    this.over = true; this.overT = 2.4; this.state = 'over';
    this.banner = { text: 'DEREZZED', sub: '', t: 0, life: 2.2 };
    A.music('off'); setTimeout(() => A.sfx.gameOver(), 600);
  };

  Game.update = function (dt) {
    this.time += dt;
    if (this.banner) { this.banner.t += dt; if (this.banner.t > this.banner.life) this.banner = null; }
    Cy.update(this, dt);
    FX.update(dt);
    const rivals = this.cycles.filter((c) => !c.human && c.alive);
    switch (this.state) {
      case 'intro':
        this.timer -= dt;
        if (this.timer <= 0) { this.state = 'play'; this.banner = { text: 'GO!', sub: '', t: 0, life: 0.7, small: true }; A.sfx.start(); }
        else if (Math.ceil(this.timer) !== this.lastTick && this.timer < 3) { this.lastTick = Math.ceil(this.timer); A.sfx.blip(); }
        break;
      case 'play':
        this.elapsed += dt;
        if (this.mode === 'survival') this.survivalSpawn(dt);
        if (this.mode === 'attract') {
          if (this.cycles.filter((c) => c.alive).length <= 1) { this.attractT = (this.attractT || 0) + dt; if (this.attractT > 2.2) { this.attractT = 0; this.startRound(U.randInt(1, 12)); } }
        } else if (this.player && !this.player.alive) {
          this.state = 'lose'; this.timer = 2.4;
          this.banner = { text: this.mode === 'campaign' && this.lives > 0 ? 'DEREZZED' : 'GAME OVER', sub: this.mode === 'campaign' && this.lives > 0 ? this.lives + ' ' + (this.lives === 1 ? 'LIFE' : 'LIVES') + ' LEFT' : '', t: 0, life: 2.2 };
        } else if (this.mode === 'campaign' && rivals.length === 0) {
          const bonus = 1000 + this.round * 200 + Math.round(this.player.energy) * 3;
          this.addScore(bonus); this.state = 'win'; this.timer = 2.8;
          this.banner = { text: this.round % C.ELITE_EVERY === 0 ? 'ELITE DEREZZED' : 'ROUND ' + this.round + ' CLEARED', sub: '+' + U.fmt(bonus), t: 0, life: 2.6 };
          A.sfx.stageClear();
        }
        break;
      case 'lose':
        this.timer -= dt;
        if (this.timer <= 0) { if (this.mode === 'campaign' && this.lives > 0) this.startRound(this.round); else this.beginOver(); }
        break;
      case 'win':
        this.timer -= dt;
        if (this.timer <= 0) this.startRound(this.round + 1);
        break;
      default:
    }
    if (this.over) {
      this.overT -= dt;
      if (this.overT <= 0 && !this.overDone) { this.overDone = true; if (this.onOver) this.onOver(); }
    }
  };

  /* ---------- rendering (logical 960x540 space) ---------- */
  Game.hasBackdrop = true;
  Game.drawBackdrop = function (ctx) { Ar.drawFloor(ctx, this.time); };
  Game.render = function (ctx) {
    Ar.drawGates(ctx, this.time);
    Cy.draw(ctx, this);
    FX.drawNorm(ctx);
    ctx.globalCompositeOperation = 'lighter'; FX.drawAdd(ctx); ctx.globalCompositeOperation = 'source-over';
    FX.drawText(ctx);
  };
})((window.SGS = window.SGS || {}));
