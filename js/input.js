/* WASD / arrow keys steer (buffered turns), Shift boosts, Space throws a disc, E / Enter fires the T-wall. */
(function (G) {
  'use strict';
  const I = { boost: false, queue: [], _disc: false, _twall: false, _pause: false, _any: false };
  // directions: 0 up, 1 right, 2 down, 3 left
  const DIRS = { KeyW: 0, ArrowUp: 0, KeyD: 1, ArrowRight: 1, KeyS: 2, ArrowDown: 2, KeyA: 3, ArrowLeft: 3 };
  const GAME_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'Enter', 'ShiftLeft', 'ShiftRight']);

  I.takeDisc = () => { const b = I._disc; I._disc = false; return b; };
  I.takeTWall = () => { const b = I._twall; I._twall = false; return b; };
  I.takePause = () => { const b = I._pause; I._pause = false; return b; };
  I.takeAny = () => { const b = I._any; I._any = false; return b; };
  I.takeTurns = () => { const q = I.queue; I.queue = []; return q; };
  I.clear = () => { I.boost = false; I.queue = []; I._disc = I._twall = I._pause = I._any = false; };

  function typing(t) { const n = t && t.tagName; return n === 'INPUT' || n === 'TEXTAREA' || n === 'SELECT'; }

  window.addEventListener('keydown', (e) => {
    if (typing(e.target)) return;
    const c = e.code;
    if (DIRS[c] !== undefined && !e.repeat) { if (I.queue.length < 3) I.queue.push(DIRS[c]); }
    else if (c === 'ShiftLeft' || c === 'ShiftRight') I.boost = true;
    else if (c === 'Space' && !e.repeat) I._disc = true;
    else if ((c === 'KeyE' || c === 'Enter') && !e.repeat && !(c === 'Enter' && e.target.tagName === 'BUTTON')) I._twall = true;
    else if ((c === 'KeyP' || c === 'Escape') && !e.repeat) I._pause = true;
    if (!e.repeat) I._any = true;
    if (GAME_KEYS.has(c) && e.target.tagName !== 'BUTTON') e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') I.boost = false; });
  window.addEventListener('blur', () => I.clear());

  I.bind = function () { /* keyboard only */ };

  G.input = I;
})((window.SGS = window.SGS || {}));
