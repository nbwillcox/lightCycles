(function (G) {
  'use strict';

  G.C = {
    W: 960,
    H: 540,
    REPO: 'https://github.com/nbwillcox/lightCycles',
    COLS: 64,
    ROWS: 34,
    CELL: 15,
    OX: 0,
    OY: 30,
    START_LIVES: 3,
    ELITE_EVERY: 5,
    EXTRA_LIFE_AT: [10000, 30000],
    EXTRA_LIFE_EVERY: 40000,
    BASE_SPEED: 11,
    BOOST_MUL: 1.65,
    BOOST_DRAIN: 38,
    BOOST_REGEN: 12,
    DISC_SPEED: 34,
    TWALL_REACH: 13,
  };

  const KEY = 'lightcycles.settings.v1';
  const defaults = { master: 0.8, music: 0.6, sfx: 0.9, bloom: true, shake: true, reduced: false };

  const S = Object.assign({}, defaults);
  let hadSaved = false;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { Object.assign(S, JSON.parse(raw)); hadSaved = true; }
  } catch (e) { /* storage unavailable */ }
  S.save = function () {
    try {
      const o = {};
      for (const k in defaults) o[k] = S[k];
      localStorage.setItem(KEY, JSON.stringify(o));
    } catch (e) { /* ignore */ }
  };
  if (!hadSaved && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    S.reduced = true;
  }
  G.settings = S;
})((window.SGS = window.SGS || {}));
