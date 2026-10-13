/* Touch controls for lightCycles: swipe anywhere to turn, BOOST (hold), DISC, T-WALL, pause. Read by js/mobile.js. */
window.TOUCH_CFG = {
  id: 'lightcycles', title: 'lightCycles', orient: 'landscape', accent: '#3ad8ff',
  hint: '<b>Swipe</b> anywhere to turn &nbsp; hold <b>BOOST</b> &nbsp; <b>DISC</b> throws a disc &nbsp; <b>T-WALL</b> fires the wall',
  unlock: () => window.SGS && window.SGS.audio && window.SGS.audio.resume(),
  controls: [
    { t: 'swipe', id: 'turn', zone: [0, 0, 1, 1], mirror: false, min: 22, keys: { l: 'ArrowLeft', r: 'ArrowRight', u: 'ArrowUp', d: 'ArrowDown' } },
    { t: 'btn', id: 'boost', label: 'BOOST', key: 'ShiftLeft', hold: true, size: 80, pos: { r: 18, b: 24 } },
    { t: 'btn', id: 'disc', label: 'DISC', key: 'Space', hold: false, size: 58, pos: { r: 112, b: 30 } },
    { t: 'btn', id: 'twall', label: 'T-WALL', key: 'KeyE', hold: false, size: 58, pos: { r: 30, b: 112 } },
  ],
};
