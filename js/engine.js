/*
 * もちもちリンク / Mochi Mingle - game engine
 *
 * Pure logic, no DOM. The engine owns the board state and exposes a
 * generator (`resolve`) that mutates the board one phase at a time so the
 * view can animate between phases.
 */

/** Special piece kinds. */
export const SP = Object.freeze({
  NONE: 0,
  ROW: 1,    // ながし - clears its row
  COL: 2,    // たきつぼ - clears its column
  BLAST: 3,  // ぽんっ - clears a 3x3 area
  STAR: 4,   // ほしだいふく - clears every piece of one flavour
});

/** Piece flavours. Index matches the sprite ids in index.html. */
export const FLAVOURS = Object.freeze([
  { key: 'sakura', label: 'さくら' },
  { key: 'matcha', label: 'まっちゃ' },
  { key: 'kinako', label: 'きなこ' },
  { key: 'ramune', label: 'ラムネ' },
  { key: 'yuzu',   label: 'ゆず' },
  { key: 'budo',   label: 'ぶどう' },
]);

let _tid = 1;
function makeTile(type, special = SP.NONE) {
  return { id: _tid++, type, special, fresh: false };
}

/** Small deterministic PRNG so a level can be replayed from a seed. */
function makeRng(seed) {
  let a = (seed >>> 0) || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BASE_SCORE = 60;
const DUST_SCORE = 40;
const ICE_SCORE = 30;
const SPECIAL_SCORE = 120;

export class Engine {
  constructor(level, seed = (Math.random() * 1e9) | 0) {
    this.level = level;
    this.rows = level.layout.length;
    this.cols = level.layout[0].length;
    this.flavours = level.flavours ?? 6;
    this.rand = makeRng(seed);
    this.seed = seed;

    this.movesLeft = level.moves;
    this.score = 0;
    this.collected = Object.create(null);
    this.cascade = 0;
    this.status = 'playing';

    this.pending = [];
    this.consumed = null;
    this.swapInfo = null;
    this.lastSwap = null;

    this._build();
  }

  // ---------------------------------------------------------------- helpers

  idx(r, c) { return r * this.cols + c; }
  row(i) { return (i / this.cols) | 0; }
  col(i) { return i % this.cols; }
  inBoard(r, c) { return r >= 0 && r < this.rows && c >= 0 && c < this.cols; }
  at(i) { return this.cells[i]; }

  /** Flavour used for matching; -1 means "never matches". */
  matchType(i) {
    const cell = this.cells[i];
    if (!cell || cell.wall || !cell.tile) return -1;
    if (cell.tile.special === SP.STAR) return -1;
    return cell.tile.type;
  }

  canSwap(i) {
    const cell = this.cells[i];
    return !!cell && !cell.wall && !!cell.tile && cell.ice === 0;
  }

  areNeighbours(a, b) {
    const dr = Math.abs(this.row(a) - this.row(b));
    const dc = Math.abs(this.col(a) - this.col(b));
    return dr + dc === 1;
  }

  randFlavour() { return (this.rand() * this.flavours) | 0; }

  // ------------------------------------------------------------------ build

  _build() {
    const { rows, cols } = this;
    this.cells = new Array(rows * cols);
    this.dustTotal = 0;
    this.iceTotal = 0;

    for (let r = 0; r < rows; r++) {
      const line = this.level.layout[r];
      for (let c = 0; c < cols; c++) {
        const ch = line[c] ?? '.';
        const cell = { wall: false, dust: 0, ice: 0, tile: null };
        if (ch === '#') cell.wall = true;
        else if (ch === '1') cell.dust = 1;
        else if (ch === '2') cell.dust = 2;
        else if (ch === 'i') cell.ice = 1;
        else if (ch === 'j') { cell.ice = 1; cell.dust = 1; }
        this.dustTotal += cell.dust;
        if (cell.ice > 0) this.iceTotal += 1;
        this.cells[this.idx(r, c)] = cell;
      }
    }
    this.dustLeft = this.dustTotal;
    this.iceLeft = this.iceTotal;

    this._fillEmpty();
    let guard = 0;
    while (!this._hasMove() && guard++ < 60) this.shuffle();
  }

  _fillEmpty() {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const i = this.idx(r, c);
        const cell = this.cells[i];
        if (cell.wall || cell.tile) continue;
        cell.tile = makeTile(this._safeFlavour(r, c));
      }
    }
  }

  /** Pick a flavour that does not immediately complete a line of three. */
  _safeFlavour(r, c) {
    const tries = [];
    for (let t = 0; t < this.flavours; t++) tries.push(t);
    // shuffle candidates
    for (let k = tries.length - 1; k > 0; k--) {
      const j = (this.rand() * (k + 1)) | 0;
      [tries[k], tries[j]] = [tries[j], tries[k]];
    }
    for (const t of tries) {
      const left2 = this.inBoard(r, c - 2) && this.matchType(this.idx(r, c - 1)) === t && this.matchType(this.idx(r, c - 2)) === t;
      const up2 = this.inBoard(r - 2, c) && this.matchType(this.idx(r - 1, c)) === t && this.matchType(this.idx(r - 2, c)) === t;
      if (!left2 && !up2) return t;
    }
    return tries[0];
  }

  // ---------------------------------------------------------------- matching

  /**
   * Find every group of three or more. Overlapping horizontal/vertical runs
   * are merged into one group so that L and T shapes can be detected.
   */
  findGroups() {
    const runs = [];
    for (let r = 0; r < this.rows; r++) {
      let c = 0;
      while (c < this.cols) {
        const t = this.matchType(this.idx(r, c));
        if (t < 0) { c++; continue; }
        let e = c + 1;
        while (e < this.cols && this.matchType(this.idx(r, e)) === t) e++;
        if (e - c >= 3) {
          const cells = [];
          for (let k = c; k < e; k++) cells.push(this.idx(r, k));
          runs.push({ dir: 'h', len: e - c, type: t, cells });
        }
        c = e;
      }
    }
    for (let c = 0; c < this.cols; c++) {
      let r = 0;
      while (r < this.rows) {
        const t = this.matchType(this.idx(r, c));
        if (t < 0) { r++; continue; }
        let e = r + 1;
        while (e < this.rows && this.matchType(this.idx(e, c)) === t) e++;
        if (e - r >= 3) {
          const cells = [];
          for (let k = r; k < e; k++) cells.push(this.idx(k, c));
          runs.push({ dir: 'v', len: e - r, type: t, cells });
        }
        r = e;
      }
    }
    if (!runs.length) return [];

    // union-find over runs that share a cell
    const parent = runs.map((_, i) => i);
    const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
    const union = (x, y) => { const a = find(x), b = find(y); if (a !== b) parent[a] = b; };
    const owner = new Map();
    runs.forEach((run, ri) => {
      for (const i of run.cells) {
        if (owner.has(i)) union(owner.get(i), ri);
        else owner.set(i, ri);
      }
    });

    const buckets = new Map();
    runs.forEach((run, ri) => {
      const root = find(ri);
      let g = buckets.get(root);
      if (!g) {
        g = { cells: new Set(), maxH: 0, maxV: 0, type: run.type, longest: run };
        buckets.set(root, g);
      }
      for (const i of run.cells) g.cells.add(i);
      if (run.dir === 'h') g.maxH = Math.max(g.maxH, run.len);
      else g.maxV = Math.max(g.maxV, run.len);
      if (run.len > g.longest.len) g.longest = run;
    });
    return [...buckets.values()];
  }

  _chooseSpecial(g) {
    if (g.maxH >= 5 || g.maxV >= 5) return SP.STAR;
    if (g.maxH >= 3 && g.maxV >= 3) return SP.BLAST;
    if (g.maxH === 4) return SP.ROW;
    if (g.maxV === 4) return SP.COL;
    return SP.NONE;
  }

  // -------------------------------------------------------------------- swap

  /**
   * Swap two cells. The board is left swapped either way so the view can
   * animate it; call `revert()` when `ok` is false.
   */
  beginSwap(a, b) {
    if (this.status !== 'playing') return { ok: false, illegal: true };
    if (!this.areNeighbours(a, b)) return { ok: false, illegal: true };
    if (!this.canSwap(a) || !this.canSwap(b)) return { ok: false, illegal: true };

    const ta = this.cells[a].tile;
    const tb = this.cells[b].tile;
    this.cells[a].tile = tb;
    this.cells[b].tile = ta;
    this.lastSwap = { a, b };

    const A = this.cells[a].tile; // tile now sitting on a
    const B = this.cells[b].tile;
    let combo = null;

    if (A.special === SP.STAR || B.special === SP.STAR) {
      const starI = A.special === SP.STAR ? a : b;
      const otherI = starI === a ? b : a;
      const other = this.cells[otherI].tile;
      if (other.special === SP.STAR) {
        combo = [{ kind: 'board' }];
      } else if (other.special !== SP.NONE) {
        const type = other.type >= 0 ? other.type : this._someFlavour();
        combo = [
          { kind: 'flavourToSpecial', type, sp: other.special },
          { kind: 'cells', cells: [starI, otherI] },
        ];
      } else {
        combo = [
          { kind: 'flavour', type: other.type },
          { kind: 'cells', cells: [starI] },
        ];
      }
      this.consumed = new Set([starI, otherI]);
    } else if (A.special !== SP.NONE && B.special !== SP.NONE) {
      const lineA = A.special === SP.ROW || A.special === SP.COL;
      const lineB = B.special === SP.ROW || B.special === SP.COL;
      if (lineA && lineB) combo = [{ kind: 'cross', i: b }];
      else if (A.special === SP.BLAST && B.special === SP.BLAST) combo = [{ kind: 'mega', i: b }];
      else combo = [{ kind: 'bigCross', i: b }];
      combo.push({ kind: 'cells', cells: [a, b] });
      this.consumed = new Set([a, b]);
    }

    const groups = this.findGroups();
    if (!combo && groups.length === 0) {
      return { ok: false, illegal: false };
    }

    if (combo) this.pending.push(...combo);
    this.movesLeft -= 1;
    this.swapInfo = { a, b };
    return { ok: true, combo: !!combo };
  }

  revert() {
    if (!this.lastSwap) return;
    const { a, b } = this.lastSwap;
    const ta = this.cells[a].tile;
    this.cells[a].tile = this.cells[b].tile;
    this.cells[b].tile = ta;
    this.lastSwap = null;
    this.pending.length = 0;
    this.consumed = null;
  }

  /** Spend a booster: blow up a single cell (3x3). */
  useHammer(i) {
    if (this.status !== 'playing') return false;
    const cell = this.cells[i];
    if (!cell || cell.wall) return false;
    this.pending.push({ kind: 'cells', cells: [i] });
    this.movesLeft -= 1;
    return true;
  }

  _someFlavour() {
    const present = new Set();
    for (const cell of this.cells) {
      if (cell.tile && cell.tile.type >= 0) present.add(cell.tile.type);
    }
    const list = [...present];
    if (!list.length) return 0;
    return list[(this.rand() * list.length) | 0];
  }

  // --------------------------------------------------------------- resolving

  _add(set, i) {
    const cell = this.cells[i];
    if (!cell || cell.wall || !cell.tile) return;
    set.add(i);
  }

  _effect(act, set) {
    const { rows, cols } = this;
    switch (act.kind) {
      case 'cells':
        for (const i of act.cells) this._add(set, i);
        break;
      case 'flavour':
        for (let i = 0; i < this.cells.length; i++) {
          const t = this.cells[i].tile;
          if (t && t.type === act.type) this._add(set, i);
        }
        break;
      case 'flavourToSpecial': {
        const hits = [];
        for (let i = 0; i < this.cells.length; i++) {
          const t = this.cells[i].tile;
          if (t && t.type === act.type) hits.push(i);
        }
        for (const i of hits) {
          this._add(set, i);
          this._effect({ kind: 'special', i, sp: act.sp, type: act.type }, set);
        }
        break;
      }
      case 'special': {
        const r = this.row(act.i), c = this.col(act.i);
        this._add(set, act.i);
        if (act.sp === SP.ROW) {
          for (let k = 0; k < cols; k++) this._add(set, this.idx(r, k));
        } else if (act.sp === SP.COL) {
          for (let k = 0; k < rows; k++) this._add(set, this.idx(k, c));
        } else if (act.sp === SP.BLAST) {
          for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
            if (this.inBoard(r + dr, c + dc)) this._add(set, this.idx(r + dr, c + dc));
          }
        } else if (act.sp === SP.STAR) {
          this._effect({ kind: 'flavour', type: this._someFlavour() }, set);
        }
        break;
      }
      case 'cross': {
        const r = this.row(act.i), c = this.col(act.i);
        for (let k = 0; k < cols; k++) this._add(set, this.idx(r, k));
        for (let k = 0; k < rows; k++) this._add(set, this.idx(k, c));
        break;
      }
      case 'bigCross': {
        const r = this.row(act.i), c = this.col(act.i);
        for (let d = -1; d <= 1; d++) {
          if (this.inBoard(r + d, 0)) for (let k = 0; k < cols; k++) this._add(set, this.idx(r + d, k));
          if (this.inBoard(0, c + d)) for (let k = 0; k < rows; k++) this._add(set, this.idx(k, c + d));
        }
        break;
      }
      case 'mega': {
        const r = this.row(act.i), c = this.col(act.i);
        for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
          if (this.inBoard(r + dr, c + dc)) this._add(set, this.idx(r + dr, c + dc));
        }
        break;
      }
      case 'board':
        for (let i = 0; i < this.cells.length; i++) this._add(set, i);
        break;
    }
  }

  _computeStep(swapInfo) {
    const groups = this.findGroups();
    const queue = this.pending;
    this.pending = [];
    if (!groups.length && !queue.length) return null;

    const toRemove = new Set();
    const create = [];
    const fired = new Set(this.consumed ?? []);
    this.consumed = null;

    for (const g of groups) {
      const sp = this._chooseSpecial(g);
      let anchor = -1;
      if (sp !== SP.NONE) {
        const order = [];
        if (swapInfo) {
          if (g.cells.has(swapInfo.a)) order.push(swapInfo.a);
          if (g.cells.has(swapInfo.b)) order.push(swapInfo.b);
        }
        order.push(...g.cells);
        anchor = order.find((i) => this.cells[i].ice === 0) ?? -1;
        if (anchor === undefined) anchor = -1;
      }
      for (const i of g.cells) if (i !== anchor) toRemove.add(i);
      if (anchor >= 0) {
        create.push({ i: anchor, sp, type: sp === SP.STAR ? -1 : g.type });
        fired.add(anchor);
      }
    }

    // Expand activations, chaining into any special caught in the blast.
    let guard = 0;
    while (guard++ < 200) {
      while (queue.length) this._effect(queue.shift(), toRemove);
      let found = false;
      for (const i of [...toRemove]) {
        const cell = this.cells[i];
        if (cell.tile && cell.tile.special !== SP.NONE && cell.ice === 0 && !fired.has(i)) {
          fired.add(i);
          found = true;
          this._effect({ kind: 'special', i, sp: cell.tile.special, type: cell.tile.type }, toRemove);
        }
      }
      if (!found && !queue.length) break;
    }

    return { toRemove, create };
  }

  _applyStep(step) {
    let gain = 0;
    const removed = [];
    const brokeIce = [];

    for (const i of step.toRemove) {
      const cell = this.cells[i];
      if (!cell.tile) continue;
      if (cell.ice > 0) {
        cell.ice -= 1;
        if (cell.ice === 0) this.iceLeft -= 1;
        brokeIce.push(i);
        gain += ICE_SCORE;
        continue;
      }
      const tile = cell.tile;
      if (tile.type >= 0) this.collected[tile.type] = (this.collected[tile.type] ?? 0) + 1;
      if (tile.special !== SP.NONE) this.collected.special = (this.collected.special ?? 0) + 1;
      removed.push(tile.id);
      cell.tile = null;
      if (cell.dust > 0) {
        cell.dust -= 1;
        this.dustLeft -= 1;
        gain += DUST_SCORE;
      }
      gain += BASE_SCORE;
    }

    for (const made of step.create) {
      this.cells[made.i].tile = makeTile(made.type, made.sp);
      this.cells[made.i].tile.fresh = 'special';
      gain += SPECIAL_SCORE;
    }

    const multiplier = 1 + 0.25 * Math.max(0, this.cascade - 1);
    this.score += Math.round(gain * multiplier);
    return { removed, brokeIce, created: step.create.length, count: removed.length };
  }

  _gravity() {
    for (let c = 0; c < this.cols; c++) {
      let bottom = this.rows - 1;
      for (let r = this.rows - 1; r >= -1; r--) {
        let fixed = r < 0;
        if (!fixed) {
          const cell = this.cells[this.idx(r, c)];
          fixed = cell.wall || (cell.ice > 0 && !!cell.tile);
        }
        if (!fixed) continue;
        this._compact(c, r + 1, bottom);
        bottom = r - 1;
      }
    }
  }

  _compact(c, top, bottom) {
    if (bottom < top) return;
    let write = bottom;
    for (let r = bottom; r >= top; r--) {
      const cell = this.cells[this.idx(r, c)];
      if (!cell.tile) continue;
      if (r !== write) {
        this.cells[this.idx(write, c)].tile = cell.tile;
        cell.tile = null;
      }
      write -= 1;
    }
    for (let r = write; r >= top; r--) {
      const tile = makeTile(this.randFlavour());
      tile.fresh = true;
      this.cells[this.idx(r, c)].tile = tile;
    }
  }

  /**
   * Run the full chain reaction. Yields a phase descriptor after each
   * mutation so a view can animate, then continue.
   */
  *resolve() {
    this.cascade = 0;
    let swapInfo = this.swapInfo;
    let guard = 0;

    while (guard++ < 200) {
      const step = this._computeStep(swapInfo);
      swapInfo = null;
      if (!step) break;
      this.cascade += 1;
      const info = this._applyStep(step);
      yield { kind: 'clear', cascade: this.cascade, ms: 230, ...info };
      this._gravity();
      yield { kind: 'fall', cascade: this.cascade, ms: 240 };
    }

    this.swapInfo = null;
    this.lastSwap = null;
    this._updateStatus();

    if (this.status === 'playing' && !this._hasMove()) {
      this.shuffle();
      yield { kind: 'shuffle', ms: 420 };
    }
  }

  // ------------------------------------------------------------------ states

  _hasMove() {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const a = this.idx(r, c);
        if (!this.canSwap(a)) continue;
        for (const [dr, dc] of [[0, 1], [1, 0]]) {
          if (!this.inBoard(r + dr, c + dc)) continue;
          const b = this.idx(r + dr, c + dc);
          if (!this.canSwap(b)) continue;
          const A = this.cells[a].tile, B = this.cells[b].tile;
          if (A.special === SP.STAR || B.special === SP.STAR) return true;
          if (A.special !== SP.NONE && B.special !== SP.NONE) return true;
          this.cells[a].tile = B; this.cells[b].tile = A;
          const hit = this.findGroups().length > 0;
          this.cells[a].tile = A; this.cells[b].tile = B;
          if (hit) return true;
        }
      }
    }
    return false;
  }

  /** Return one legal move as [a, b], or null. Used by the hint button. */
  findHint() {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const a = this.idx(r, c);
        if (!this.canSwap(a)) continue;
        for (const [dr, dc] of [[0, 1], [1, 0]]) {
          if (!this.inBoard(r + dr, c + dc)) continue;
          const b = this.idx(r + dr, c + dc);
          if (!this.canSwap(b)) continue;
          const A = this.cells[a].tile, B = this.cells[b].tile;
          if (A.special === SP.STAR || B.special === SP.STAR) return [a, b];
          if (A.special !== SP.NONE && B.special !== SP.NONE) return [a, b];
          this.cells[a].tile = B; this.cells[b].tile = A;
          const hit = this.findGroups().length > 0;
          this.cells[a].tile = A; this.cells[b].tile = B;
          if (hit) return [a, b];
        }
      }
    }
    return null;
  }

  /** Re-deal every movable tile until there is a move and no free match. */
  shuffle() {
    const movable = [];
    for (let i = 0; i < this.cells.length; i++) {
      const cell = this.cells[i];
      if (cell.wall || !cell.tile || cell.ice > 0) continue;
      if (cell.tile.special !== SP.NONE) continue;
      movable.push(i);
    }
    if (movable.length < 3) return;
    const types = movable.map((i) => this.cells[i].tile.type);

    for (let attempt = 0; attempt < 80; attempt++) {
      for (let k = types.length - 1; k > 0; k--) {
        const j = (this.rand() * (k + 1)) | 0;
        [types[k], types[j]] = [types[j], types[k]];
      }
      movable.forEach((i, k) => { this.cells[i].tile.type = types[k]; });
      if (this.findGroups().length === 0 && this._hasMove()) return;
    }
    // last resort: hand-place safe flavours
    for (const i of movable) {
      this.cells[i].tile.type = this._safeFlavour(this.row(i), this.col(i));
    }
  }

  goalState() {
    return this.level.goals.map((goal) => {
      let have = 0, need = 1;
      if (goal.kind === 'score') { have = this.score; need = goal.amount; }
      else if (goal.kind === 'collect') { have = this.collected[goal.type] ?? 0; need = goal.amount; }
      else if (goal.kind === 'dust') { have = this.dustTotal - this.dustLeft; need = goal.amount ?? this.dustTotal; }
      else if (goal.kind === 'ice') { have = this.iceTotal - this.iceLeft; need = goal.amount ?? this.iceTotal; }
      return { goal, have: Math.min(have, need), need, done: have >= need };
    });
  }

  _updateStatus() {
    const done = this.goalState().every((g) => g.done);
    if (done) this.status = 'won';
    else if (this.movesLeft <= 0) this.status = 'lost';
  }

  stars() {
    const t = this.level.stars ?? [0, 0, 0];
    if (this.status !== 'won') return 0;
    let n = 1;
    if (this.score >= t[1]) n = 2;
    if (this.score >= t[2]) n = 3;
    return n;
  }
}
