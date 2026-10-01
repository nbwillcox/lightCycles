/* All sound is synthesized live with the Web Audio API - no audio files. */
(function (G) {
  'use strict';
  const S = G.settings;
  const A = { ctx: null, ready: false, sfx: {} };
  let master, sfxBus, musicBus, noiseBuf, voices = 0;
  const last = {};

  function gate(name, ms) {
    const now = performance.now();
    if (now - (last[name] || 0) < ms) return false;
    last[name] = now;
    return true;
  }

  A.init = function () {
    if (A.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { A.ctx = new AC(); } catch (e) { return; }
    const ctx = A.ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 6; comp.attack.value = 0.004; comp.release.value = 0.18;
    master = ctx.createGain(); sfxBus = ctx.createGain(); musicBus = ctx.createGain();
    sfxBus.connect(master); musicBus.connect(master); master.connect(comp); comp.connect(ctx.destination);
    const len = ctx.sampleRate * 2;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    A.applyVolumes();
    A.ready = true;
    initMusic();
  };
  A.resume = function () {
    A.init();
    if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume();
  };
  A.applyVolumes = function () {
    if (!A.ctx) return;
    master.gain.value = S.master;
    sfxBus.gain.value = S.sfx;
    musicBus.gain.value = S.music * 0.5;
  };

  /* ---------- primitives ---------- */
  function tone(o) {
    if (!A.ready || voices > 48) return;
    const ctx = A.ctx, t = o.at !== undefined ? o.at : ctx.currentTime + (o.delay || 0);
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.f0, t);
    if (o.f1 && o.f1 !== o.f0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + o.dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(o.vol === undefined ? 0.2 : o.vol, t + (o.attack || 0.003));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    osc.connect(g); g.connect(o.bus || sfxBus);
    osc.start(t); osc.stop(t + o.dur + 0.03);
    voices++;
    osc.onended = () => { voices--; g.disconnect(); };
  }
  function noise(o) {
    if (!A.ready || voices > 48) return;
    const ctx = A.ctx, t = o.at !== undefined ? o.at : ctx.currentTime + (o.delay || 0);
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = o.type || 'lowpass';
    f.frequency.setValueAtTime(o.f0, t);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + o.dur);
    if (o.q) f.Q.value = o.q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(o.vol === undefined ? 0.3 : o.vol, t + (o.attack || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(f); f.connect(g); g.connect(o.bus || sfxBus);
    src.start(t, Math.random() * 1.5, o.dur + 0.05);
    voices++;
    src.onended = () => { voices--; g.disconnect(); };
  }

  /* ---------- sound effects ---------- */
  const X = A.sfx;
  X.shoot = (tier) => {
    if (!gate('shoot', 40)) return;
    if (tier >= 4) tone({ type: 'sawtooth', f0: 1500, f1: 380, dur: 0.09, vol: 0.06 });
    else tone({ type: 'square', f0: 900 - tier * 60, f1: 240, dur: 0.07, vol: 0.06 });
  };
  X.droneShot = () => { if (gate('drone', 90)) tone({ type: 'triangle', f0: 1300, f1: 700, dur: 0.04, vol: 0.035 }); };
  X.hit = () => {
    if (!gate('hit', 35)) return;
    tone({ type: 'square', f0: 340, f1: 190, dur: 0.035, vol: 0.06 });
  };
  X.armor = () => { if (gate('armor', 45)) tone({ type: 'square', f0: 150, f1: 110, dur: 0.04, vol: 0.05 }); };
  X.kill = (size) => {
    size = size || 0;
    noise({ f0: 3200, f1: 260, dur: 0.16 + size * 0.1, vol: 0.2 + size * 0.05 });
    tone({ type: 'square', f0: 420 - size * 80, f1: 55, dur: 0.18 + size * 0.1, vol: 0.12 });
  };
  X.boom = () => {
    noise({ f0: 1900, f1: 50, dur: 1.0, vol: 0.5 });
    tone({ type: 'sine', f0: 130, f1: 28, dur: 0.9, vol: 0.45 });
  };
  X.partBreak = () => {
    noise({ type: 'bandpass', f0: 2600, f1: 200, dur: 0.4, vol: 0.35, q: 1.2 });
    tone({ type: 'square', f0: 240, f1: 50, dur: 0.35, vol: 0.14 });
    tone({ type: 'sine', f0: 90, f1: 35, dur: 0.5, vol: 0.3 });
  };
  X.playerDie = () => {
    noise({ f0: 4200, f1: 70, dur: 1.3, vol: 0.5 });
    tone({ type: 'sawtooth', f0: 700, f1: 40, dur: 1.1, vol: 0.2 });
  };
  X.pickup = () => {
    [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'square', f0: f, dur: 0.09, vol: 0.09, delay: i * 0.05 }));
  };
  X.weaponUp = () => {
    tone({ type: 'triangle', f0: 260, f1: 1300, dur: 0.3, vol: 0.18 });
    [659, 880, 1175, 1568].forEach((f, i) => tone({ type: 'square', f0: f, dur: 0.1, vol: 0.08, delay: 0.12 + i * 0.05 }));
  };
  X.drone = () => {
    tone({ type: 'sine', f0: 300, f1: 900, dur: 0.18, vol: 0.2 });
    tone({ type: 'square', f0: 900, f1: 1200, dur: 0.12, vol: 0.07, delay: 0.15 });
  };
  X.shield = () => {
    tone({ type: 'sine', f0: 380, f1: 1000, dur: 0.3, vol: 0.22 });
    tone({ type: 'triangle', f0: 760, f1: 1500, dur: 0.3, vol: 0.1 });
  };
  X.shieldBreak = () => {
    noise({ type: 'highpass', f0: 3000, f1: 800, dur: 0.35, vol: 0.3 });
    tone({ type: 'sawtooth', f0: 900, f1: 120, dur: 0.3, vol: 0.12 });
  };
  X.bombPickup = () => {
    tone({ type: 'square', f0: 200, f1: 400, dur: 0.1, vol: 0.12 });
    tone({ type: 'square', f0: 400, f1: 800, dur: 0.12, vol: 0.12, delay: 0.1 });
    tone({ type: 'sine', f0: 100, f1: 60, dur: 0.3, vol: 0.2, delay: 0.1 });
  };
  X.bomb = () => {
    noise({ f0: 900, f1: 35, dur: 1.5, vol: 0.6 });
    tone({ type: 'sine', f0: 220, f1: 24, dur: 1.4, vol: 0.5 });
    tone({ type: 'sawtooth', f0: 1800, f1: 90, dur: 0.8, vol: 0.12 });
  };
  X.warning = () => {
    for (let i = 0; i < 6; i++) {
      tone({ type: 'sawtooth', f0: i % 2 ? 420 : 640, f1: i % 2 ? 420 : 640, dur: 0.46, vol: 0.12, delay: i * 0.5, attack: 0.02 });
      tone({ type: 'square', f0: i % 2 ? 210 : 320, dur: 0.46, vol: 0.08, delay: i * 0.5, attack: 0.02 });
    }
  };
  X.thief = () => {
    for (let i = 0; i < 6; i++) tone({ type: 'square', f0: i % 2 ? 560 : 840, dur: 0.07, vol: 0.09, delay: i * 0.075 });
  };
  X.stolen = () => {
    [880, 740, 622, 466, 311].forEach((f, i) => tone({ type: 'sawtooth', f0: f, f1: f * 0.9, dur: 0.12, vol: 0.12, delay: i * 0.07 }));
  };
  X.recovered = () => {
    [392, 523, 659, 784, 1047].forEach((f, i) => tone({ type: 'square', f0: f, dur: 0.1, vol: 0.09, delay: i * 0.055 }));
  };
  X.extraLife = () => {
    [659, 784, 988, 1319, 988, 1319, 1568].forEach((f, i) => tone({ type: 'square', f0: f, dur: 0.12, vol: 0.1, delay: i * 0.09 }));
  };
  X.stageClear = () => {
    [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone({ type: 'square', f0: f, dur: 0.13, vol: 0.1, delay: i * 0.1 }));
    tone({ type: 'triangle', f0: 262, dur: 0.9, vol: 0.14, delay: 0 });
  };
  X.gameOver = () => {
    [440, 392, 349, 330, 294, 262, 220].forEach((f, i) => tone({ type: 'sawtooth', f0: f, f1: f * 0.97, dur: 0.22, vol: 0.12, delay: i * 0.18 }));
  };
  X.blip = () => tone({ type: 'square', f0: 700, f1: 800, dur: 0.04, vol: 0.07 });
  X.select = () => {
    tone({ type: 'square', f0: 500, dur: 0.06, vol: 0.08 });
    tone({ type: 'square', f0: 900, dur: 0.1, vol: 0.08, delay: 0.06 });
  };
  X.start = () => {
    [262, 330, 392, 523, 659, 784, 1047].forEach((f, i) => tone({ type: 'square', f0: f, dur: 0.1, vol: 0.09, delay: i * 0.06 }));
  };
  X.combo = (m) => { if (gate('combo', 120)) tone({ type: 'triangle', f0: 600 + m * 120, f1: 900 + m * 150, dur: 0.08, vol: 0.07 }); };
  X.perfect = () => {
    [784, 988, 1175, 1568].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.18, vol: 0.12, delay: i * 0.08 }));
  };

  X.turn = (human) => { if (gate(human ? 'turnH' : 'turnA', human ? 25 : 90)) tone({ type: 'square', f0: human ? 880 : 520, f1: human ? 700 : 420, dur: 0.03, vol: human ? 0.045 : 0.018 }); };
  X.portal = () => { if (gate('portal', 80)) { tone({ type: 'sine', f0: 400, f1: 1300, dur: 0.12, vol: 0.08 }); tone({ type: 'triangle', f0: 1300, f1: 500, dur: 0.12, vol: 0.05, delay: 0.1 }); } };
  X.derez = (human) => { noise({ f0: 4200, f1: 120, dur: human ? 0.9 : 0.55, vol: human ? 0.45 : 0.3 }); tone({ type: 'sawtooth', f0: 900, f1: 60, dur: human ? 0.8 : 0.5, vol: 0.14 }); tone({ type: 'square', f0: 220, f1: 40, dur: 0.5, vol: 0.12 }); };
  X.disc = () => { tone({ type: 'triangle', f0: 1400, f1: 500, dur: 0.18, vol: 0.12 }); tone({ type: 'sawtooth', f0: 700, f1: 300, dur: 0.2, vol: 0.06 }); };
  X.twall = () => { noise({ f0: 3000, f1: 200, dur: 0.6, vol: 0.4 }); tone({ type: 'sawtooth', f0: 1800, f1: 90, dur: 0.6, vol: 0.14 }); tone({ type: 'sine', f0: 120, f1: 30, dur: 0.6, vol: 0.4 }); };

  /* ---------- music: layered 4-bar loop with intensity ---------- */
  const M = { on: false, step: 0, next: 0, tempo: 110, level: 0, key: 0, timer: 0, boss: false };
  const L = {}; // layer gain nodes
  const LAYER_GAINS = {
    pad: [1, 0.6, 0.5, 0.45],
    bass: [0, 1, 1, 1],
    arp: [0.6, 0, 0.8, 0.85],
    drums: [0, 0.75, 1, 1.1],
    lead: [0, 0, 0, 1],
  };
  const PROG = [0, -4, 3, -2];
  const PROG_BOSS = [0, 1, 0, -2];
  const BASS = [0, -1, 0, 12, -1, 0, 7, -1, 0, -1, 0, 12, -1, 0, 10, -1];
  const ARP = [0, 3, 7, 12, 7, 3, 0, 3, 7, 12, 15, 12, 7, 3, 7, 12];
  const LEAD = [12, -1, -1, 15, -1, 12, -1, 19, -1, -1, 15, -1, 17, -1, 15, 12];

  function initMusic() {
    for (const k in LAYER_GAINS) {
      L[k] = A.ctx.createGain();
      L[k].gain.value = 0;
      L[k].connect(musicBus);
    }
  }
  function freq(root, semis) { return root * Math.pow(2, semis / 12); }

  function schedStep(t, s) {
    const ctx = A.ctx, lv = M.level;
    const bar = (s >> 4) & 3, st = s & 15;
    const prog = M.boss ? PROG_BOSS : PROG;
    const root = freq(55, M.key + prog[bar]);
    const sixteenth = 60 / M.tempo / 4;
    if (st === 0) {
      for (const k in LAYER_GAINS) L[k].gain.setTargetAtTime(LAYER_GAINS[k][lv], t, 0.25);
      [1, 1.1892, 1.4983].forEach((m, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'triangle';
        o.frequency.value = root * 4 * m;
        o.detune.value = (i - 1) * 6;
        const dur = sixteenth * 16;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.05, t + dur * 0.35);
        g.gain.linearRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(L.pad);
        o.start(t); o.stop(t + dur + 0.05);
      });
    }
    const b = BASS[st];
    if (b >= 0 && lv >= 1) {
      tone({ type: M.boss ? 'sawtooth' : 'square', f0: freq(root, b), dur: sixteenth * 1.7, vol: 0.2, bus: L.bass, attack: 0.004, at: t });
    }
    if (lv === 0 ? st % 2 === 0 : lv >= 2) {
      tone({ type: 'square', f0: freq(root * 4, ARP[st]), dur: sixteenth * 0.9, vol: 0.055, bus: L.arp, at: t });
    }
    if (lv >= 3 && LEAD[st] >= 0) {
      const f = freq(root * 4, LEAD[st]);
      tone({ type: 'sawtooth', f0: f, dur: sixteenth * 2.2, vol: 0.075, bus: L.lead, attack: 0.01, at: t });
      tone({ type: 'sawtooth', f0: f * 1.006, dur: sixteenth * 2.2, vol: 0.055, bus: L.lead, attack: 0.01, at: t });
    }
    if (lv >= 1) {
      if (st % 4 === 0) tone({ type: 'sine', f0: 160, f1: 42, dur: 0.14, vol: 0.55, bus: L.drums, at: t });
      if (lv >= 2 && (st === 4 || st === 12)) {
        noise({ type: 'highpass', f0: 1800, dur: 0.13, vol: 0.22, bus: L.drums, at: t });
        tone({ type: 'triangle', f0: 210, f1: 120, dur: 0.09, vol: 0.18, bus: L.drums, at: t });
      }
      if (lv >= 3 && (st === 15 || st === 7)) noise({ type: 'highpass', f0: 2200, dur: 0.07, vol: 0.12, bus: L.drums, at: t });
      const hatEvery = lv >= 3 ? 1 : 2;
      if (st % hatEvery === 0) {
        const open = st % 4 === 2;
        noise({ type: 'highpass', f0: 7500, dur: open ? 0.09 : 0.035, vol: open ? 0.11 : 0.07, bus: L.drums, at: t });
      }
    }
  }

  function scheduler() {
    if (!M.on || !A.ready) return;
    const ctx = A.ctx;
    if (ctx.state !== 'running') return;
    if (M.next < ctx.currentTime - 0.25) M.next = ctx.currentTime + 0.05;
    while (M.next < ctx.currentTime + 0.14) {
      schedStep(M.next, M.step);
      M.next += 60 / M.tempo / 4;
      M.step = (M.step + 1) & 63;
    }
  }

  /** mode: 'off' | 'title' | 'play' | 'boss'; level 1..2 scales layers in 'play' */
  A.music = function (mode, level, key) {
    if (!A.ready) return;
    if (mode === 'off') {
      M.on = false;
      for (const k in L) L[k].gain.setTargetAtTime(0, A.ctx.currentTime, 0.2);
      return;
    }
    if (key !== undefined) M.key = key;
    M.boss = mode === 'boss';
    M.level = mode === 'title' ? 0 : mode === 'boss' ? 3 : Math.max(1, Math.min(2, level || 1));
    M.tempo = mode === 'title' ? 96 : mode === 'boss' ? 144 : 118;
    if (!M.on) {
      M.on = true;
      M.step = 0;
      M.next = A.ctx.currentTime + 0.08;
      if (!M.timer) M.timer = setInterval(scheduler, 30);
    }
  };

  G.audio = A;
})((window.SGS = window.SGS || {}));
