# Sugarfall

A sweet match-3 candy puzzle that runs in any browser — phone or desktop, no install.

**▶ Play: https://monkey-mountain.github.io/sugarfall/**

---

## What it is

Swap two candies side by side to line up three or more and clear them. Twelve levels,
each with its own goals (score, collect a colour, soak up syrup, crack ice) and a move
limit. Hit every goal before the moves run out to clear the level, and earn up to three
stars based on your score.

- **No framework, no build step** — HTML, CSS and vanilla ES modules
- **Mobile first** — swipe or tap-tap to swap, safe-area aware, installable (PWA manifest)
- **Everything is generated** — every candy is inline SVG, every sound is synthesised with
  WebAudio. There are no image or audio files in this repository
- **Progress is saved** to `localStorage`

### Pieces and blockers

| | What it does |
| --- | --- |
| **Side Sparkler** | Made by matching 4 in a row. Clears that whole row |
| **Down Sparkler** | Made by matching 4 in a column. Clears that whole column |
| **Bonbon Bomb** | Made by matching in an L or T shape. Blows up a 3×3 area |
| **Rainbow Drop** | Made by matching 5. Swap it with any candy to clear every candy of that colour |
| **Syrup** | Coats the board. Clear a candy sitting on it to soak it up (double syrup takes two) |
| **Ice** | The candy inside can't be moved. Clear it in a match to crack the ice |
| **Wall** | No candy ever sits here, and nothing falls through it |

Swapping two specials together combines them — cross sweeps, a 5×5 blast, or clearing the
whole board when two Rainbow Drops meet. Longer chain reactions multiply the score.

---

## Running it locally

It uses ES modules, so open it over HTTP rather than `file://`:

```bash
python3 -m http.server 4173
```

Then visit http://localhost:4173

---

## Layout

```
index.html                markup plus the SVG sprite — every candy is drawn here
css/style.css             all styling
js/engine.js              game logic, no DOM: matching, specials, chain reactions, gravity
js/levels.js              the twelve levels: boards, goals, star thresholds
js/ui.js                  rendering, input and screens; diffs engine state against the DOM
js/audio.js               WebAudio sound effects
js/main.js                entry point
tools/simulate.mjs        automated play-through test
tools/balance.mjs         difficulty report
```

`engine.js` knows nothing about rendering. Its `resolve()` is a generator that advances the
board one phase at a time and yields, so the UI can re-render and let CSS transitions
animate each step before asking for the next one.

---

## Development tools

```bash
node tools/simulate.mjs 40    # play every level 40x at random, checking board invariants
node tools/balance.mjs 80     # win rate and score spread per level, with a greedy player
```

Move counts, goal amounts and star thresholds come from `balance.mjs` measurements — they
are tuned so that a greedy simulated player's win rate falls smoothly from about 95% on
level 1 to about 50% on level 12. A human who plans ahead should do better than that.

---

## About originality

Sugarfall is an original game inspired by the match-3 genre.

- The name, logo, artwork, colours, copy, level design and special-piece names are its own
- Every asset is generated inside this repository: inline SVG for graphics, synthesised
  WebAudio for sound
- No assets, names, text or code from any existing title are used

The basic rule of matching three in a row is a genre convention shared by many games.

---

## License

MIT — see [LICENSE](LICENSE).
