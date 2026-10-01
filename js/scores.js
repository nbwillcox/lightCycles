/* Local top-10 high score table (browser localStorage). */
(function (G) {
  'use strict';
  const KEY = 'lightcycles.scores.v1';
  const NAME_KEY = 'lightcycles.lastname';
  const Sc = { list: [] };

  const seed = [
    ['NBW', 30000, 9], ['ACE', 20000, 7], ['CLU', 14000, 6], ['GRD', 9000, 4], ['BIT', 5500, 3],
    ['NOVA', 3000, 2], ['ZAP', 2000, 2], ['BIT', 1200, 1], ['PIX', 800, 1], ['OWL', 400, 1],
  ].map((a) => ({ name: a[0].slice(0, 3), score: a[1], stage: a[2] }));

  Sc.load = function () {
    try {
      const raw = localStorage.getItem(KEY);
      const arr = raw ? JSON.parse(raw) : null;
      Sc.list = Array.isArray(arr) && arr.length ? arr.filter((r) => r && typeof r.score === 'number').slice(0, 10) : seed.slice();
    } catch (e) { Sc.list = seed.slice(); }
    return Sc.list;
  };
  Sc.save = function () { try { localStorage.setItem(KEY, JSON.stringify(Sc.list)); } catch (e) { /* ignore */ } };
  Sc.best = function () { return Sc.list.length ? Sc.list[0].score : 0; };
  Sc.qualifies = function (score) {
    return score > 0 && (Sc.list.length < 10 || score > Sc.list[Sc.list.length - 1].score);
  };
  Sc.add = function (name, score, stage, tag) {
    name = String(name || 'AAA').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3) || 'AAA';
    Sc.list.push({ name, score: Math.floor(score), stage, tag: tag || '', date: Date.now() });
    Sc.list.sort((a, b) => b.score - a.score);
    Sc.list.length = Math.min(10, Sc.list.length);
    Sc.save();
    Sc.lastName = name;
    try { localStorage.setItem(NAME_KEY, name); } catch (e) { /* ignore */ }
    return Sc.list.findIndex((r) => r.name === name && r.score === Math.floor(score));
  };
  Sc.lastName = (function () { try { return localStorage.getItem(NAME_KEY) || ''; } catch (e) { return ''; } })();
  Sc.load();
  G.scores = Sc;
})((window.SGS = window.SGS || {}));
