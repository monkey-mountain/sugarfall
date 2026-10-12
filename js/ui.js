/*
 * Screens, rendering and input for もちもちリンク / Mochi Mingle.
 *
 * The engine owns the board state; this module diffs that state against the
 * DOM after every phase, so pieces slide, pop and drop with plain CSS.
 */

import { Engine, SP, FLAVOURS } from './engine.js';
import { LEVELS } from './levels.js';
import { sfx } from './audio.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const $ = (s) => document.querySelector(s);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const STORE = 'mochi-mingle/v1';
const MAX_STARS = LEVELS.length * 3;

/* ---------------------------------------------------------------- saves */

const blankSave = () => ({ unlocked: 1, stars: {}, best: {}, sound: true });

function loadSave() {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return blankSave();
    const data = JSON.parse(raw) || {};
    return { ...blankSave(), ...data, stars: data.stars || {}, best: data.best || {} };
  } catch {
    return blankSave();
  }
}

let save = loadSave();

function persist() {
  try { localStorage.setItem(STORE, JSON.stringify(save)); } catch { /* private mode */ }
}

function totalStars() {
  return Object.values(save.stars).reduce((a, b) => a + b, 0);
}

/* ----------------------------------------------------------- board view */

class BoardView {
  constructor() {
    this.root = $('#board');
    this.wrap = this.root.parentElement;
    this.cellsLayer = $('#layerCells');
    this.tilesLayer = $('#layerTiles');
    this.fxLayer = $('#layerFx');
    this.tiles = new Map();
    this.ices = new Map();
    this.cells = [];
    this.cs = 0;
    this.engine = null;
    const ro = new ResizeObserver(() => this.fit());
    ro.observe(this.wrap);
    window.addEventListener('orientationchange', () => setTimeout(() => this.fit(), 120));
  }

  mount(engine) {
    this.engine = engine;
    this.tiles.clear();
    this.ices.clear();
    this.cells = [];
    this.cellsLayer.textContent = '';
    this.tilesLayer.textContent = '';
    this.fxLayer.textContent = '';
    this.root.style.setProperty('--cols', engine.cols);
    this.root.style.setProperty('--rows', engine.rows);

    for (let i = 0; i < engine.cells.length; i++) {
      if (engine.cells[i].wall) { this.cells.push(null); continue; }
      const el = document.createElement('div');
      el.className = 'cell';
      el.style.setProperty('--r', engine.row(i));
      el.style.setProperty('--c', engine.col(i));
      this.cellsLayer.appendChild(el);
      this.cells.push(el);
    }
    this.fit();
  }

  /** Size the board to the space available, in whole pixels per cell. */
  fit() {
    if (!this.engine) return;
    const pad = 4;
    const w = this.wrap.clientWidth - pad;
    const h = this.wrap.clientHeight - pad;
    if (w <= 0 || h <= 0) return;
    const cs = Math.max(26, Math.floor(Math.min(w / this.engine.cols, h / this.engine.rows)));
    if (cs === this.cs) return;
    this.cs = cs;
    this.root.style.setProperty('--cs', cs + 'px');
    this.root.style.width = cs * this.engine.cols + 'px';
    this.root.style.height = cs * this.engine.rows + 'px';
  }

  cellAt(clientX, clientY) {
    const rect = this.root.getBoundingClientRect();
    const cs = rect.width / this.engine.cols;
    const c = Math.floor((clientX - rect.left) / cs);
    const r = Math.floor((clientY - rect.top) / cs);
    if (!this.engine.inBoard(r, c)) return -1;
    return this.engine.idx(r, c);
  }

  _makeTile() {
    const el = document.createElement('div');
    el.className = 'tile';
    const m = document.createElement('div');
    m.className = 'm';
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    const use = document.createElementNS(SVGNS, 'use');
    svg.appendChild(use);
    const mk = document.createElement('i');
    mk.className = 'mk';
    m.append(svg, mk);
    el.appendChild(m);
    el._use = use;
    el._sym = '';
    return el;
  }

  render(phase) {
    const e = this.engine;
    const alive = new Set();

    for (let i = 0; i < e.cells.length; i++) {
      const cell = e.cells[i];
      const cellEl = this.cells[i];

      if (cellEl) {
        cellEl.classList.toggle('d1', cell.dust === 1);
        cellEl.classList.toggle('d2', cell.dust >= 2);
      }

      // ice overlay
      const ice = this.ices.get(i);
      if (cell.ice > 0 && !ice) {
        const el = document.createElement('div');
        el.className = 'ice';
        el.style.setProperty('--r', e.row(i));
        el.style.setProperty('--c', e.col(i));
        const svg = document.createElementNS(SVGNS, 'svg');
        svg.setAttribute('viewBox', '0 0 100 100');
        const use = document.createElementNS(SVGNS, 'use');
        use.setAttribute('href', '#icecrack');
        svg.appendChild(use);
        el.appendChild(svg);
        this.fxLayer.appendChild(el);
        this.ices.set(i, el);
      } else if (cell.ice === 0 && ice) {
        ice.classList.add('cracked', 'hit');
        this.ices.delete(i);
        const dead = ice;
        setTimeout(() => dead.remove(), 260);
      }

      if (!cell.tile) continue;
      const tile = cell.tile;
      alive.add(tile.id);
      let el = this.tiles.get(tile.id);
      if (!el) {
        el = this._makeTile();
        this.tiles.set(tile.id, el);
        el.style.setProperty('--r', e.row(i));
        el.style.setProperty('--c', e.col(i));
        this.tilesLayer.appendChild(el);
        const anim = tile.fresh === 'special' ? 'born' : 'drop';
        el.classList.add(anim);
        setTimeout(() => el.classList.remove(anim), 320);
      } else {
        el.style.setProperty('--r', e.row(i));
        el.style.setProperty('--c', e.col(i));
      }
      const sym = tile.special === SP.STAR ? '#pstar' : '#p' + tile.type;
      if (el._sym !== sym) {
        el._use.setAttribute('href', sym);
        el._sym = sym;
      }
      el.className = 'tile f' + Math.max(0, tile.type) + (tile.special ? ' sp' + tile.special : '');
      tile.fresh = false;
    }

    for (const [id, el] of [...this.tiles]) {
      if (alive.has(id)) continue;
      this.tiles.delete(id);
      el.classList.add('pop');
      setTimeout(() => el.remove(), 260);
    }

    if (phase && phase.kind === 'shuffle') {
      this.root.animate(
        [{ transform: 'rotate(0deg) scale(1)' }, { transform: 'rotate(-2deg) scale(.96)' },
         { transform: 'rotate(2deg) scale(.96)' }, { transform: 'rotate(0deg) scale(1)' }],
        { duration: 420, easing: 'ease-in-out' },
      );
    }
  }

  mark(i, cls, ms) {
    const cell = this.engine.cells[i];
    if (!cell || !cell.tile) return;
    const el = this.tiles.get(cell.tile.id);
    if (!el) return;
    el.classList.add(cls);
    if (ms) setTimeout(() => el.classList.remove(cls), ms);
  }

  clearMarks(cls) {
    for (const el of this.tiles.values()) el.classList.remove(cls);
  }
}

/* -------------------------------------------------------------- dialogs */

function dialog({ title, body, actions, dismissable = false }) {
  return new Promise((resolve) => {
    const overlay = $('#overlay');
    $('#dlgTitle').textContent = title;
    const bodyEl = $('#dlgBody');
    bodyEl.textContent = '';
    if (typeof body === 'string') bodyEl.innerHTML = body;
    else if (body) bodyEl.appendChild(body);

    const box = $('#dlgActions');
    box.textContent = '';
    for (const a of actions) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn' + (a.ghost ? ' ghost' : '');
      b.textContent = a.label;
      b.addEventListener('click', () => { close(); resolve(a.value); });
      box.appendChild(b);
    }
    function onBackdrop(ev) {
      if (dismissable && ev.target === overlay) { close(); resolve(null); }
    }
    function close() {
      overlay.hidden = true;
      overlay.removeEventListener('click', onBackdrop);
    }
    overlay.hidden = false;
    overlay.addEventListener('click', onBackdrop);
    const first = box.querySelector('button');
    if (first) first.focus({ preventScroll: true });
  });
}

const flavourSwatch = (type) =>
  `<svg class="ic" viewBox="0 0 100 100" style="--pc:var(--f-${FLAVOURS[type].key});--pd:var(--d-${FLAVOURS[type].key})"><use href="#p${type}"/></svg>`;

function howToPlay() {
  return dialog({
    title: 'あそびかた',
    dismissable: true,
    body: `<div class="how">
      <p>となりどうしの和菓子を入れかえて、たて・よこに<b>3つ以上</b>そろえて消します。手数がなくなる前に目標を達成しましょう。</p>
      <h3>特殊な和菓子</h3>
      <div class="row">${flavourSwatch(0)}<span><b>よこに4つ</b>そろえる →「ながし」が <b>よこ一列</b> を一掃</span></div>
      <div class="row">${flavourSwatch(1)}<span><b>たてに4つ</b>そろえる →「たきつぼ」が <b>たて一列</b> を一掃</span></div>
      <div class="row">${flavourSwatch(2)}<span><b>L字・T字</b>にそろえる →「ぽんっ」が <b>まわり3×3</b> を爆発</span></div>
      <div class="row"><svg class="ic" viewBox="0 0 100 100"><use href="#pstar"/></svg><span><b>5つ</b>そろえる →「ほしだいふく」。入れかえた相手と <b>同じ味を全部</b> 消します</span></div>
      <p>特殊な和菓子どうしを入れかえると、さらに大きく消えます。</p>
      <h3>さまたげるもの</h3>
      <div class="row"><i class="ic chip dust"></i><span><b>きなこ</b>：その上で和菓子を消すと払えます（二重のものは2回）</span></div>
      <div class="row"><i class="ic chip ice"></i><span><b>こおり</b>：中の和菓子は動かせません。巻きこんで消すと割れます</span></div>
      <h3>操作</h3>
      <ul>
        <li>スワイプ、または2回タップで入れかえ</li>
        <li>れんさ（連鎖）するほど高得点</li>
      </ul>
    </div>`,
    actions: [{ label: 'とじる', value: 'close' }],
  });
}

/* ----------------------------------------------------------------- game */

const view = new BoardView();

const game = {
  engine: null,
  level: 0,
  busy: false,
  selected: -1,
  drag: null,
  idleTimer: 0,
};

function showScreen(id) {
  for (const s of document.querySelectorAll('.screen')) s.classList.toggle('is-active', s.id === id);
}

function buildLevelGrid() {
  const grid = $('#levelGrid');
  grid.textContent = '';
  LEVELS.forEach((lv, i) => {
    const n = i + 1;
    const stars = save.stars[n] || 0;
    const locked = n > save.unlocked;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'lv' + (locked ? ' locked' : '') + (stars ? ' cleared' : '');
    b.innerHTML = `<span class="n">${n}</span><span class="t">${lv.name}</span>
      <span class="st">${[1, 2, 3].map((k) => `<i class="${k <= stars ? 'on' : ''}">★</i>`).join('')}</span>`;
    if (locked) {
      b.setAttribute('aria-disabled', 'true');
      b.title = 'まえのステージをクリアするとひらきます';
    }
    b.addEventListener('click', () => {
      sfx.unlock();
      if (locked) { sfx.bad(); return; }
      sfx.tap();
      startLevel(i);
    });
    grid.appendChild(b);
  });
  $('#totalStars').textContent = totalStars();
  $('#maxStars').textContent = MAX_STARS;
}

function startLevel(index) {
  game.level = index;
  game.engine = new Engine(LEVELS[index]);
  game.selected = -1;
  game.busy = false;
  $('#stageNo').textContent = index + 1;
  $('#stageName').textContent = LEVELS[index].name;
  $('#stageHint').textContent = LEVELS[index].hint || '';
  // the screen must be visible before the board can be measured
  showScreen('game');
  view.mount(game.engine);
  view.render();
  updateHud();
  armIdleHint();
}

function goalChip(state) {
  const { goal, have, need, done } = state;
  let icon = '';
  let label = '';
  if (goal.kind === 'score') { icon = '<i class="ic chip pt"></i>'; label = `${have}/${need}`; }
  else if (goal.kind === 'collect') { icon = flavourSwatch(goal.type); label = `${have}/${need}`; }
  else if (goal.kind === 'dust') { icon = '<i class="ic chip dust"></i>'; label = `${have}/${need}`; }
  else if (goal.kind === 'ice') { icon = '<i class="ic chip ice"></i>'; label = `${have}/${need}`; }
  return `<div class="goal${done ? ' done' : ''}">${icon}<span class="num">${label}</span></div>`;
}

function updateHud() {
  const e = game.engine;
  $('#movesLeft').textContent = Math.max(0, e.movesLeft);
  $('#score').textContent = e.score;
  $('.hud-box.moves').classList.toggle('low', e.movesLeft <= 5 && e.status === 'playing');
  $('#goalList').innerHTML = e.goalState().map(goalChip).join('');
}

function showCombo(text) {
  const el = $('#combo');
  el.textContent = text;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
}

function armIdleHint() {
  clearTimeout(game.idleTimer);
  game.idleTimer = setTimeout(() => {
    if (game.busy || !game.engine || game.engine.status !== 'playing') return;
    const hint = game.engine.findHint();
    if (!hint) return;
    view.mark(hint[0], 'hint', 2800);
    view.mark(hint[1], 'hint', 2800);
    armIdleHint();
  }, 11000);
}

async function attemptSwap(a, b) {
  if (game.busy || !game.engine || game.engine.status !== 'playing') return;
  const e = game.engine;
  if (!e.areNeighbours(a, b)) return;
  game.busy = true;
  clearTimeout(game.idleTimer);
  setSelected(-1);
  view.clearMarks('hint');

  const res = e.beginSwap(a, b);
  view.render();
  if (!res.ok) {
    sfx.bad();
    await wait(170);
    e.revert();
    view.render();
    await wait(170);
    game.busy = false;
    armIdleHint();
    return;
  }

  sfx.swap();
  await wait(170);
  updateHud();
  await runCascade();
}

async function runCascade() {
  const e = game.engine;
  for (const phase of e.resolve()) {
    view.render(phase);
    if (phase.kind === 'clear') {
      sfx.pop(phase.cascade, phase.count);
      if (phase.brokeIce && phase.brokeIce.length) sfx.ice();
      if (phase.created) sfx.special(3);
      if (phase.cascade === 2) showCombo('れんさ！');
      else if (phase.cascade === 3) showCombo('いい感じ！');
      else if (phase.cascade >= 4) showCombo(`れんさ ×${phase.cascade}！`);
      if (navigator.vibrate && phase.count >= 8) navigator.vibrate(12);
    } else if (phase.kind === 'shuffle') {
      sfx.shuffle();
      showCombo('手がないのでまぜました');
    }
    updateHud();
    await wait(phase.ms);
  }
  updateHud();
  game.busy = false;

  if (e.status === 'won') await finish(true);
  else if (e.status === 'lost') await finish(false);
  else armIdleHint();
}

async function finish(won) {
  const e = game.engine;
  const n = game.level + 1;
  await wait(380);

  if (won) {
    const stars = e.stars();
    save.stars[n] = Math.max(save.stars[n] || 0, stars);
    save.best[n] = Math.max(save.best[n] || 0, e.score);
    if (n === save.unlocked && n < LEVELS.length) save.unlocked = n + 1;
    persist();
    buildLevelGrid();
    sfx.win();
    const hasNext = game.level + 1 < LEVELS.length;
    const body = `
      <div class="star-row">${[1, 2, 3].map((k) => `<i class="${k <= stars ? 'on' : ''}">★</i>`).join('')}</div>
      <p class="big">${e.score}</p>
      <p>のこり手数 ${e.movesLeft}${stars < 3 ? `<br><small>★3まで あと ${Math.max(0, LEVELS[game.level].stars[2] - e.score)} 点</small>` : ''}</p>`;
    const actions = [];
    if (hasNext) actions.push({ label: 'つぎのステージへ', value: 'next' });
    actions.push({ label: 'もう一度', value: 'retry', ghost: true });
    actions.push({ label: 'ステージ選択', value: 'home', ghost: true });
    const pick = await dialog({ title: won ? 'クリア！' : '', body, actions });
    if (pick === 'next') startLevel(game.level + 1);
    else if (pick === 'retry') startLevel(game.level);
    else goHome();
  } else {
    sfx.lose();
    const remaining = e.goalState().filter((g) => !g.done).length;
    const body = `<p>手数がなくなりました。</p>
      <p><small>のこりの目標 ${remaining} 個 / スコア ${e.score}</small></p>`;
    const pick = await dialog({
      title: 'あと少し…',
      body,
      actions: [
        { label: 'もう一度', value: 'retry' },
        { label: 'ステージ選択', value: 'home', ghost: true },
      ],
    });
    if (pick === 'retry') startLevel(game.level);
    else goHome();
  }
}

function goHome() {
  clearTimeout(game.idleTimer);
  buildLevelGrid();
  showScreen('home');
}

function setSelected(i) {
  if (game.selected === i) return;
  if (game.selected >= 0) {
    const prev = game.engine.cells[game.selected];
    if (prev && prev.tile) {
      const el = view.tiles.get(prev.tile.id);
      if (el) el.classList.remove('sel');
    }
  }
  game.selected = i;
  if (i >= 0) view.mark(i, 'sel');
}

/* ---------------------------------------------------------------- input */

function bindInput() {
  const board = $('#board');

  board.addEventListener('pointerdown', (ev) => {
    if (game.busy || !game.engine || game.engine.status !== 'playing') return;
    const i = view.cellAt(ev.clientX, ev.clientY);
    if (i < 0) return;
    sfx.unlock();
    ev.preventDefault();
    board.setPointerCapture?.(ev.pointerId);
    game.drag = { from: i, x: ev.clientX, y: ev.clientY, moved: false };
    if (game.engine.canSwap(i)) {
      if (game.selected >= 0 && game.engine.areNeighbours(game.selected, i)) {
        const a = game.selected;
        game.drag = null;
        attemptSwap(a, i);
        return;
      }
      setSelected(i);
      sfx.tap();
    } else {
      setSelected(-1);
    }
  });

  board.addEventListener('pointermove', (ev) => {
    const d = game.drag;
    if (!d || game.busy) return;
    const dx = ev.clientX - d.x;
    const dy = ev.clientY - d.y;
    const threshold = Math.max(12, view.cs * 0.34);
    if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return;
    const e = game.engine;
    const r = e.row(d.from);
    const c = e.col(d.from);
    let nr = r, nc = c;
    if (Math.abs(dx) > Math.abs(dy)) nc += dx > 0 ? 1 : -1;
    else nr += dy > 0 ? 1 : -1;
    game.drag = null;
    if (!e.inBoard(nr, nc)) return;
    attemptSwap(d.from, e.idx(nr, nc));
  });

  const end = () => { game.drag = null; };
  board.addEventListener('pointerup', end);
  board.addEventListener('pointercancel', end);
  board.addEventListener('contextmenu', (ev) => ev.preventDefault());
}

/* ------------------------------------------------------------- controls */

function bindControls() {
  $('#btnBack').addEventListener('click', () => { sfx.tap(); goHome(); });
  $('#btnRestart').addEventListener('click', async () => {
    sfx.tap();
    const pick = await dialog({
      title: 'やりなおす？',
      body: '<p>このステージを最初からやりなおします。</p>',
      actions: [
        { label: 'やりなおす', value: 'yes' },
        { label: 'つづける', value: 'no', ghost: true },
      ],
      dismissable: true,
    });
    if (pick === 'yes') startLevel(game.level);
  });
  $('#btnHint').addEventListener('click', () => {
    if (game.busy || !game.engine || game.engine.status !== 'playing') return;
    sfx.tap();
    const hint = game.engine.findHint();
    if (!hint) { sfx.bad(); return; }
    view.clearMarks('hint');
    view.mark(hint[0], 'hint', 2800);
    view.mark(hint[1], 'hint', 2800);
  });
  $('#btnHow').addEventListener('click', () => { sfx.unlock(); sfx.tap(); howToPlay(); });

  const soundBtn = $('#btnSound');
  const syncSound = () => {
    soundBtn.textContent = save.sound ? '♪ 音 ON' : '♪ 音 OFF';
    soundBtn.setAttribute('aria-pressed', String(!!save.sound));
    sfx.setEnabled(save.sound);
  };
  soundBtn.addEventListener('click', () => {
    save.sound = !save.sound;
    persist();
    syncSound();
    if (save.sound) sfx.tap();
  });
  syncSound();

  $('#btnReset').addEventListener('click', async () => {
    const pick = await dialog({
      title: '記録を消す',
      body: '<p>クリア状況と★をすべて消します。もとに戻せません。</p>',
      actions: [
        { label: '消す', value: 'yes' },
        { label: 'やめる', value: 'no', ghost: true },
      ],
      dismissable: true,
    });
    if (pick !== 'yes') return;
    const sound = save.sound;
    save = blankSave();
    save.sound = sound;
    persist();
    buildLevelGrid();
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && !$('#overlay').hidden) return;
    if (ev.key === 'Escape' && $('#game').classList.contains('is-active')) goHome();
  });

  // keep the board sized correctly when the mobile browser chrome slides away
  window.addEventListener('resize', () => view.fit(), { passive: true });
}

export function boot() {
  buildLevelGrid();
  bindInput();
  bindControls();
  showScreen('home');
  if (!localStorage.getItem(STORE + '/seen')) {
    try { localStorage.setItem(STORE + '/seen', '1'); } catch {}
    setTimeout(howToPlay, 400);
  }
}
