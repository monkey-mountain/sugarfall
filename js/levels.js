/*
 * Stage definitions for もちもちリンク / Mochi Mingle.
 *
 * layout characters
 *   .  plain cell
 *   #  wall (no piece ever sits here)
 *   1  one layer of kinako dust
 *   2  two layers of kinako dust
 *   i  frozen piece (ice must be cracked before the piece can move)
 *   j  frozen piece sitting on one layer of dust
 *
 * goals
 *   { kind: 'score',   amount }
 *   { kind: 'collect', type, amount }   type = flavour index
 *   { kind: 'dust', amount? }           sweep away N dust layers (all of them when
 *                                       amount is left out)
 *   { kind: 'ice',  amount? }           crack N frozen pieces (all of them by default)
 *
 * Move counts and goal amounts were tuned against a simulated player
 * (see the balance notes in README).
 */

export const LEVELS = [
  {
    name: 'はじめのひとくち',
    hint: 'よこ・たてに3つそろえよう',
    moves: 20,
    flavours: 5,
    goals: [{ kind: 'score', amount: 6000 }],
    stars: [6000, 7000, 8500],
    layout: [
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
    ],
  },
  {
    name: 'きなこをはらう',
    hint: 'きなこの上で消すと払える',
    moves: 20,
    flavours: 5,
    goals: [{ kind: 'dust' }],
    stars: [6000, 11500, 15500],
    layout: [
      '........',
      '........',
      '..1111..',
      '..1111..',
      '..1111..',
      '..1111..',
      '........',
      '........',
    ],
  },
  {
    name: 'さくらあつめ',
    hint: '4つそろえると「ながし」ができる',
    moves: 24,
    flavours: 6,
    goals: [
      { kind: 'collect', type: 0, amount: 15 },
      { kind: 'collect', type: 1, amount: 15 },
    ],
    stars: [5000, 7500, 9000],
    layout: [
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
    ],
  },
  {
    name: 'まるいおぼん',
    hint: 'L字にそろえると「ぽんっ」',
    moves: 28,
    flavours: 6,
    goals: [{ kind: 'dust', amount: 30 }],
    stars: [6000, 9000, 11000],
    layout: [
      '##1111##',
      '#111111#',
      '11....11',
      '11....11',
      '11....11',
      '11....11',
      '#111111#',
      '##1111##',
    ],
  },
  {
    name: 'こおりのつぶ',
    hint: 'こおりは隣で消すとひびが入る',
    moves: 22,
    flavours: 5,
    goals: [{ kind: 'ice' }],
    stars: [5000, 9500, 15000],
    layout: [
      '........',
      '..i..i..',
      '........',
      '...ii...',
      '...ii...',
      '........',
      '..i..i..',
      '........',
    ],
  },
  {
    name: 'ふたえのきなこ',
    hint: '5つそろえると「ほしだいふく」',
    moves: 30,
    flavours: 6,
    goals: [{ kind: 'dust' }],
    stars: [8000, 11500, 16000],
    layout: [
      '........',
      '........',
      '..2222..',
      '..2222..',
      '..2222..',
      '..2222..',
      '........',
      '........',
    ],
  },
  {
    name: 'ゆずのこみち',
    hint: 'かべのまわりは落ちてこない',
    moves: 26,
    flavours: 6,
    goals: [
      { kind: 'collect', type: 4, amount: 14 },
      { kind: 'ice' },
    ],
    stars: [4500, 6200, 7800],
    layout: [
      '..####..',
      '........',
      '...ii...',
      '#......#',
      '#......#',
      '...ii...',
      '........',
      '..####..',
    ],
  },
  {
    name: 'ラムネのあわ',
    hint: '特殊もちどうしを入れかえると大爆発',
    moves: 26,
    flavours: 6,
    goals: [
      { kind: 'collect', type: 3, amount: 18 },
      { kind: 'dust', amount: 14 },
    ],
    stars: [6500, 8500, 11000],
    layout: [
      '.1....1.',
      '1......1',
      '....11..',
      '...1111.',
      '.1111...',
      '..11....',
      '1......1',
      '.1....1.',
    ],
  },
  {
    name: 'おくのま',
    hint: 'ほしだいふくは好きな味を全部消す',
    moves: 32,
    flavours: 6,
    goals: [{ kind: 'dust', amount: 30 }, { kind: 'ice' }],
    stars: [6000, 9000, 12000],
    layout: [
      '###11###',
      '##1111##',
      '#j1111j#',
      '11.22.11',
      '11.22.11',
      '#j1111j#',
      '##1111##',
      '###11###',
    ],
  },
  {
    name: 'たきのぼり',
    hint: '縦に4つで「たきつぼ」ができる',
    moves: 30,
    flavours: 6,
    goals: [
      { kind: 'collect', type: 2, amount: 18 },
      { kind: 'collect', type: 5, amount: 18 },
      { kind: 'dust', amount: 20 },
    ],
    stars: [8000, 10000, 12500],
    layout: [
      '..2..2..',
      '.#2..2#.',
      '..2..2..',
      '.1......',
      '......1.',
      '..2..2..',
      '.#2..2#.',
      '..2..2..',
    ],
  },
  {
    name: 'つきよのうたげ',
    hint: 'れんさで点数がぐんぐん伸びる',
    moves: 32,
    flavours: 6,
    goals: [{ kind: 'ice', amount: 9 }, { kind: 'score', amount: 8000 }],
    stars: [8000, 8700, 9500],
    layout: [
      '..i##i..',
      '.j....j.',
      'i..##..i',
      '#.2222.#',
      '#.2222.#',
      'i..##..i',
      '.j....j.',
      '..i##i..',
    ],
  },
  {
    name: 'もちもちのきわみ',
    hint: 'さいごの一皿。全部きれいにしよう',
    moves: 38,
    flavours: 6,
    goals: [
      { kind: 'dust', amount: 33 },
      { kind: 'ice', amount: 6 },
      { kind: 'score', amount: 11000 },
    ],
    stars: [11000, 11600, 12500],
    layout: [
      '2j....j2',
      'j2.##.2j',
      '..2##2..',
      '#.2222.#',
      '#.2222.#',
      '..2##2..',
      'j2.##.2j',
      '2j....j2',
    ],
  },
];

export function levelCount() { return LEVELS.length; }
