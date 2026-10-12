/*
 * Headless play-through test.
 *
 *   node tools/simulate.mjs [runsPerLevel]
 *
 * Plays every level with a random legal move each turn and checks the board
 * invariants after each animation phase. Exits non-zero on the first problem.
 */

import { Engine, SP } from '../js/engine.js';
import { LEVELS } from '../js/levels.js';

const RUNS = Number(process.argv[2] || 40);

function invariants(e, tag, settled) {
  for (let i = 0; i < e.cells.length; i++) {
    const c = e.cells[i];
    if (c.wall && c.tile) throw new Error(`${tag}: piece sitting on a wall at ${i}`);
    if (settled && !c.wall && !c.tile) throw new Error(`${tag}: hole left at ${i}`);
    if (c.tile && c.tile.special === SP.STAR && c.tile.type !== -1) throw new Error(`${tag}: star kept a flavour`);
    if (c.tile && c.tile.type !== -1 && c.tile.type >= e.flavours) throw new Error(`${tag}: flavour out of range`);
    if (c.dust < 0 || c.ice < 0) throw new Error(`${tag}: negative blocker`);
  }
  if (e.dustLeft < 0 || e.iceLeft < 0) throw new Error(`${tag}: negative counter`);
}

function allPairs(e) {
  const out = [];
  for (let r = 0; r < e.rows; r++) {
    for (let c = 0; c < e.cols; c++) {
      const a = e.idx(r, c);
      if (!e.canSwap(a)) continue;
      for (const [dr, dc] of [[0, 1], [1, 0]]) {
        if (!e.inBoard(r + dr, c + dc)) continue;
        const b = e.idx(r + dr, c + dc);
        if (e.canSwap(b)) out.push([a, b]);
      }
    }
  }
  return out;
}

let phases = 0, wins = 0, losses = 0, shuffles = 0;
const started = Date.now();

for (let li = 0; li < LEVELS.length; li++) {
  for (let run = 0; run < RUNS; run++) {
    const e = new Engine(LEVELS[li], li * 1000 + run);
    const tag = `L${li + 1}`;
    invariants(e, `${tag} init`, true);
    if (e.findGroups().length) throw new Error(`${tag}: board starts with a free match`);
    if (!e.findHint()) throw new Error(`${tag}: board starts with no legal move`);

    let guard = 0;
    while (e.status === 'playing' && guard++ < 500) {
      const pairs = allPairs(e);
      for (let k = pairs.length - 1; k > 0; k--) {
        const j = (Math.random() * (k + 1)) | 0;
        [pairs[k], pairs[j]] = [pairs[j], pairs[k]];
      }
      let played = false;
      for (const [a, b] of pairs) {
        if (e.beginSwap(a, b).ok) { played = true; break; }
        e.revert();
      }
      if (!played) break;
      for (const phase of e.resolve()) {
        phases++;
        if (phase.kind === 'shuffle') shuffles++;
        invariants(e, `${tag} ${phase.kind}`, phase.kind !== 'clear');
      }
      for (const cell of e.cells) if (cell.tile) cell.tile.fresh = false;
    }
    if (guard >= 500) throw new Error(`${tag}: run did not terminate`);
    if (e.status === 'won') wins++;
    else if (e.status === 'lost') losses++;
    else throw new Error(`${tag}: ended in state "${e.status}" with ${e.movesLeft} moves left`);
  }
}

console.log(`ok  levels=${LEVELS.length}  runs=${LEVELS.length * RUNS}  phases=${phases}  shuffles=${shuffles}`);
console.log(`    random play: won ${wins}, lost ${losses}  (${Date.now() - started} ms)`);
