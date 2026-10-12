/*
 * Difficulty report.
 *
 *   node tools/balance.mjs [runsPerLevel]
 *
 * Plays every level with a greedy player (picks a near-best move, with a
 * little noise) and prints the win rate and score spread. Used to pick the
 * move counts, goal amounts and star thresholds in js/levels.js.
 */

import { Engine, SP } from '../js/engine.js';
import { LEVELS } from '../js/levels.js';

const RUNS = Number(process.argv[2] || 80);

function legalMoves(e) {
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

/** How appealing a swap looks, without actually playing it out. */
function rate(e, a, b) {
  const A = e.cells[a].tile;
  const B = e.cells[b].tile;
  if (A.special === SP.STAR || B.special === SP.STAR) return 1000;
  if (A.special !== SP.NONE && B.special !== SP.NONE) return 900;

  e.cells[a].tile = B;
  e.cells[b].tile = A;
  const groups = e.findGroups();
  let score = -1;
  if (groups.length) {
    score = 0;
    for (const g of groups) {
      score += g.cells.size * 10;
      if (g.maxH >= 5 || g.maxV >= 5) score += 300;
      else if (g.maxH >= 3 && g.maxV >= 3) score += 200;
      else if (g.maxH === 4 || g.maxV === 4) score += 120;
      for (const i of g.cells) {
        score += e.cells[i].dust * 25;
        for (const [dr, dc] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
          const rr = e.row(i) + dr;
          const cc = e.col(i) + dc;
          if (e.inBoard(rr, cc) && e.cells[e.idx(rr, cc)].ice > 0) score += 30;
        }
      }
    }
  }
  e.cells[a].tile = A;
  e.cells[b].tile = B;
  return score;
}

function play(level, seed) {
  const e = new Engine(level, seed);
  let guard = 0;
  while (e.status === 'playing' && guard++ < 400) {
    const moves = legalMoves(e).map(([a, b]) => [a, b, rate(e, a, b)]).filter((m) => m[2] >= 0);
    if (!moves.length) break;
    moves.sort((x, y) => y[2] - x[2]);
    const pick = moves[Math.min(moves.length - 1, (Math.random() * 2) | 0)];
    if (!e.beginSwap(pick[0], pick[1]).ok) { e.revert(); break; }
    for (const _ of e.resolve()) { /* drain the animation phases */ }
    for (const cell of e.cells) if (cell.tile) cell.tile.fresh = false;
  }
  return e;
}

const pct = (arr, p) => {
  const s = [...arr].sort((x, y) => x - y);
  return s.length ? s[Math.floor((s.length - 1) * p)] : 0;
};

console.log(`greedy player, ${RUNS} runs per level\n`);
console.log('    stage          moves  win%   win score p10/p50/p90   stars');
for (let li = 0; li < LEVELS.length; li++) {
  const lv = LEVELS[li];
  const winScores = [];
  let wins = 0;
  for (let run = 0; run < RUNS; run++) {
    const e = play(lv, li * 61813 + run * 17);
    if (e.status === 'won') { wins++; winScores.push(e.score); }
  }
  const win = Math.round((wins / RUNS) * 100);
  console.log(
    `L${String(li + 1).padStart(2)} ${lv.name.padEnd(10)} ` +
    `${String(lv.moves).padStart(5)}  ${String(win).padStart(3)}%   ` +
    `${String(pct(winScores, 0.1)).padStart(6)}/${String(pct(winScores, 0.5)).padStart(6)}/${String(pct(winScores, 0.9)).padStart(6)}   ` +
    `${JSON.stringify(lv.stars)}`,
  );
}
