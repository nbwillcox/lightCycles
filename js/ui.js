/* DOM menus: title, pause, settings, high scores, game over / initials entry. */
(function (G) {
  'use strict';
  const S = G.settings, A = G.audio, U = G.U;
  const $ = (id) => document.getElementById(id);
  const UI = { cur: 'title', back: 'title', lastIdx: -1 };
  const NAMES = ['title', 'pause', 'settings', 'scores', 'gameover'];

  UI.show = function (name) {
    NAMES.forEach((n) => $(n).classList.toggle('hidden', n !== name));
    UI.cur = name;
    document.body.classList.toggle('menu-open', !!name);
    if (name === 'scores') UI.renderScores();
    setTimeout(() => {
      const sec = $(name);
      if (!sec || sec.classList.contains('hidden')) return;
      const el = name === 'gameover' && !$('goEntry').classList.contains('hidden') ? $('goName') : sec.querySelector('button.primary') || sec.querySelector('button');
      if (el) { el.focus(); if (el.select) el.select(); }
    }, 0);
  };
  UI.hideAll = function () {
    NAMES.forEach((n) => $(n).classList.add('hidden'));
    UI.cur = null;
    document.body.classList.remove('menu-open');
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  };
  UI.isOpen = () => UI.cur !== null;

  UI.renderScores = function () {
    const ol = $('scoreList');
    ol.innerHTML = '';
    G.scores.list.forEach((r, i) => {
      const li = document.createElement('li');
      if (i === UI.lastIdx) li.className = 'me';
      const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = r.name;
      const sc = document.createElement('span'); sc.className = 'sc'; sc.textContent = U.fmt(r.score);
      const st = document.createElement('span'); st.className = 'st'; st.textContent = r.tag || 'ROUND ' + (r.stage || 1);
      li.append(nm, sc, st);
      ol.appendChild(li);
    });
  };

  UI.showGameOver = function (score, stage, tag) {
    $('goScore').textContent = U.fmt(score);
    $('goStage').textContent = stage;
    const q = G.scores.qualifies(score);
    $('goEntry').classList.toggle('hidden', !q);
    $('goButtons').classList.toggle('hidden', q);
    $('goName').value = G.scores.lastName || '';
    UI.pending = { score, stage, tag };
    UI.show('gameover');
  };

  function saveScore() {
    if (!UI.pending) return;
    const name = ($('goName').value || 'AAA').toUpperCase().replace(/[^A-Z0-9]/g, '') || 'AAA';
    UI.lastIdx = G.scores.add(name, UI.pending.score, UI.pending.stage, UI.pending.tag);
    UI.pending = null;
    A.sfx.select();
    UI.back = 'title';
    UI.show('scores');
  }

  function bind() {
    const on = (id, fn) => $(id).addEventListener('click', () => { A.resume(); A.sfx.select(); fn(); });
    on('btnStart', () => G.main.startGame('campaign'));
    on('btnSurvival', () => G.main.startGame('survival'));
    on('btnScores', () => { UI.back = 'title'; UI.lastIdx = -1; UI.show('scores'); });
    on('btnSettings', () => { UI.back = 'title'; UI.show('settings'); });
    on('btnResume', () => G.main.resume());
    on('btnPauseSettings', () => { UI.back = 'pause'; UI.show('settings'); });
    on('btnQuit', () => G.main.toTitle());
    on('btnSettingsBack', () => UI.show(UI.back));
    on('btnScoresPlay', () => G.main.startGame());
    on('btnScoresBack', () => G.main.toTitle());
    on('btnRetry', () => G.main.startGame());
    on('btnGoTitle', () => G.main.toTitle());
    on('btnSaveScore', saveScore);
    $('goName').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3); });
    $('goName').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveScore(); } });

    const sliders = { setMaster: 'master', setMusic: 'music', setSfx: 'sfx' };
    for (const id in sliders) {
      $(id).value = S[sliders[id]];
      $(id).addEventListener('input', (e) => { S[sliders[id]] = parseFloat(e.target.value); S.save(); A.applyVolumes(); });
      $(id).addEventListener('change', () => A.sfx.blip());
    }
    const checks = { setBloom: 'bloom', setShake: 'shake', setReduced: 'reduced' };
    for (const id in checks) {
      $(id).checked = !!S[checks[id]];
      $(id).addEventListener('change', (e) => { S[checks[id]] = e.target.checked; S.save(); A.sfx.blip(); });
    }
    window.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (UI.cur === 'settings') UI.show(UI.back);
      else if (UI.cur === 'scores') G.main.toTitle();
    });
    document.addEventListener('pointerdown', () => A.resume(), { passive: true });
    document.addEventListener('keydown', () => A.resume());
  }

  G.ui = UI;
  bind();
})((window.SGS = window.SGS || {}));
