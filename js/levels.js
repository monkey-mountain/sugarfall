/*
 * Level definitions for Sugarfall.
 *
 * layout characters
 *   .  plain cell
 *   #  wall (no piece ever sits here)
 *   1  one layer of syrup
 *   2  two layers of syrup
 *   i  iced candy (the ice must be cracked before the candy can move)
 *   j  iced candy sitting on one layer of syrup
 *
 * goals
 *   { kind: 'score',   amount }
 *   { kind: 'collect', type, amount }   type = flavour index
 *   { kind: 'dust', amount? }           soak up N syrup layers (all of them when
 *                                       amount is left out)
 *   { kind: 'ice',  amount? }           crack N iced candies (all of them by default)
 *
 * Move counts, goal amounts and star thresholds were tuned against a
 * simulated player; see tools/balance.mjs and the README.
 */

export const LEVELS = [
  {
    name: 'First Bite',
    hint: 'Swap two candies to line up three',
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
    name: 'Sticky Floor',
    hint: 'Clearing a candy soaks up the syrup under it',
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
    name: 'Berry Hunt',
    hint: 'Match 4 in a row for a side Sparkler',
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
    name: 'Sugar Ring',
    hint: 'Match in an L or T shape for a Bonbon Bomb',
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
    name: 'Deep Freeze',
    hint: 'Ice cracks when you clear the candy inside it',
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
    name: 'Double Syrup',
    hint: 'Match 5 for a Rainbow Drop',
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
    name: 'Narrow Pass',
    hint: 'Nothing falls into a walled-off gap',
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
    name: 'Fizz Pools',
    hint: 'Swap two specials together for a bigger blast',
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
    name: 'The Vault',
    hint: 'A Rainbow Drop clears every candy of one colour',
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
    name: 'Twin Falls',
    hint: 'Match 4 in a column for a down Sparkler',
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
    name: 'Frost Festival',
    hint: 'Chain reactions multiply your score',
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
    name: 'Sweet Summit',
    hint: 'The last one. Clear it all.',
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
