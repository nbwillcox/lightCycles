/* Controller map for lightCycles. Read by js/pad.js. */
window.PAD_CFG = {
  id: 'lightcycles', title: 'lightCycles',
  hint: '<b>Stick / D-pad</b> turn &nbsp; hold <b>A / RT</b> boost &nbsp; <b>X</b> disc &nbsp; <b>B / Y</b> T-wall &nbsp; <b>Start</b> pause',
  move: { keys: { l: 'ArrowLeft', r: 'ArrowRight', u: 'ArrowUp', d: 'ArrowDown' }, mode: '4' },
  actions: [
    { id: 'boost', label: 'Boost', btn: ['A', 'RT'], key: 'ShiftLeft' },
    { id: 'disc', label: 'Throw disc', btn: ['X', 'RB'], key: 'Space' },
    { id: 'twall', label: 'T-wall', btn: ['B', 'Y', 'LB'], key: 'KeyE' },
  ],
};
