# Play Like a Legend

Chess puzzles themed around how the great grandmasters played. Each pack is built on one player's
style: Tal's sacrifices, Capablanca's endgames, Morphy's attacks, Petrosian's prophylaxis.

Users move the pieces on an interactive board. When they finish or give up, an animated replay
walks through the full solution with arrows and an explanation.

**Status:** MVP. The Tal pack has 60 puzzles: 5 original compositions plus 55 curated from the Lichess database. Every mate puzzle is machine-checked for a forced mate and a unique first move. Other packs are placeholders.

## Run it

```
npm install
npm run dev        # http://localhost:5173
npm run verify     # check every puzzle (legality, forced mate, unique first move)
npm run build
```

Pushing to `main` deploys to GitHub Pages through `.github/workflows/deploy.yml`. The deploy runs
`npm run verify` first, so a broken puzzle blocks the release.

## Puzzle format

`src/data/puzzles/<gm>.json`, one array per GM:

| field | meaning |
|---|---|
| `fen` | position with the solver to move |
| `solution` | UCI moves: solver, reply, solver, ... ending on a solver move |
| `type` | `real` (from the GM's own game, with `source`) or `style` (matches the GM's style) |
| `themes` | Lichess theme tags. `mateInN` makes the verifier prove the mate and its uniqueness |
| `rating`, `hint`, `explanation` | shown in the app |

On the last move any checkmate is accepted, as on Lichess.

## Content pipeline

1. **Style-matched puzzles** from the Lichess puzzle database (CC0):
   download `lichess_db_puzzle.csv.zst` from https://database.lichess.org/#puzzles into `data/`
   (no need to unpack it; Node 23.8+ reads it directly), then run
   `npm run import:lichess -- --gm tal --limit 900`.
   The first theme in the GM's `themeProfile` (`src/data/packs.ts`) is required. The others raise the score.
   Then `npm run curate -- --gm tal --count 55 --start 6` picks a varied set across the rating range,
   drops any mate that fails the uniqueness check, drafts hints and explanations, and appends to the pack.
2. **Real-game puzzles**: put the GM's games in `data/pgn/<gm>.pgn`, install Stockfish, then run
   `STOCKFISH_PATH=/path/to/stockfish npm run mine:pgn -- --pgn data/pgn/tal.pgn --player Tal --gm tal`.
   It finds moments where only one move wins and the GM found it.
3. Candidates land in `data/candidates/`. Review them, write the hint and explanation, copy the keepers into
   `src/data/puzzles/<gm>.json`, then run `npm run verify`.

## Puzzle text

Every puzzle has a hand-written hint, explanation and `moveNotes` (one note per move, shown during the replay).
Write them from `npx tsx scripts/fact-sheet.ts tal-012`, which prints the checks, legal replies and attacked pieces after every move,
so no claim is made from reading the board by eye. Puzzles without `moveNotes` fall back to generated notes (`src/lib/moveNotes.ts`).

## Portraits

`scripts/engrave-portrait.sh in.jpg <crop> out.jpg` turns a photo into the sepia engraving style
(needs ImageMagick). Use only public domain or CC0 photos and put the credit in `portraitCredit`.
All four current GMs have portraits. Morphy's faded 1859 photo needed a contrast boost before the filter.

## Selling

Every puzzle is open until a pack can be bought. Once `VITE_CHECKOUT_URL_TAL` (and so on) is set to a
Lemon Squeezy checkout link, only the first `FREE_PER_PACK` (10) stay free and an unlock button appears. Unlocking after payment needs a small backend
(webhook plus accounts), which is planned for V1. Progress is currently stored in the browser.

## Licences

Board UI is `react-chessboard` (MIT) and move logic is `chess.js` (BSD-2). Lichess puzzle data is CC0.
Game scores are facts and not copyrighted. Write all annotations and explanations yourself.
