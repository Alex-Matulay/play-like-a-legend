/**
 * Finds "in the style of" candidates in the Lichess puzzle database (CC0).
 *
 * 1. Download https://database.lichess.org/lichess_db_puzzle.csv.zst and decompress it
 *    (e.g. `zstd -d lichess_db_puzzle.csv.zst`) into ./data/
 * 2. npm run import:lichess -- --gm tal --limit 150
 *
 * Writes data/candidates/<gm>.json in the app's Puzzle format, with hint and explanation left
 * empty. Review them, write the text, then copy the keepers into src/data/puzzles/<gm>.json
 * and run `npm run verify`.
 */
import { createReadStream, mkdirSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { Chess } from 'chess.js'
import { PACKS } from '../src/data/packs'
import type { Puzzle } from '../src/types'
import { uciToMove } from './lib/chess-utils'

const { values } = parseArgs({
  options: {
    gm: { type: 'string', default: 'tal' },
    csv: { type: 'string', default: 'data/lichess_db_puzzle.csv' },
    limit: { type: 'string', default: '150' },
    min: { type: 'string', default: '1200' },
    max: { type: 'string', default: '2100' },
    'min-popularity': { type: 'string', default: '85' },
    'min-plays': { type: 'string', default: '500' },
  },
})

const pack = PACKS.find((p) => p.id === values.gm)
if (!pack) throw new Error(`Unknown GM "${values.gm}". Known: ${PACKS.map((p) => p.id).join(', ')}`)

const limit = Number(values.limit)
const [minRating, maxRating] = [Number(values.min), Number(values.max)]
const profile = new Set(pack.themeProfile)

interface Scored {
  puzzle: Puzzle
  score: number
}

// Three rating bands so the pack has an even difficulty spread
const bands = [
  { lo: minRating, hi: 1500, items: [] as Scored[] },
  { lo: 1500, hi: 1800, items: [] as Scored[] },
  { lo: 1800, hi: maxRating, items: [] as Scored[] },
]
const perBand = Math.ceil(limit / bands.length)

const rl = createInterface({ input: createReadStream(values.csv!) })
let seen = 0

for await (const line of rl) {
  if (seen++ === 0 && line.startsWith('PuzzleId')) continue
  // PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags
  const [id, fen, moves, rating, , popularity, plays, themes] = line.split(',')
  const r = Number(rating)
  if (r < minRating || r >= maxRating) continue
  if (Number(popularity) < Number(values['min-popularity']) || Number(plays) < Number(values['min-plays'])) continue

  const tags = themes.split(' ')
  const matches = tags.filter((t) => profile.has(t)).length
  if (matches < 2) continue

  const band = bands.find((b) => r >= b.lo && r < b.hi)!
  // Score = style match first, then popularity as a quality signal
  const score = matches * 100 + Number(popularity)
  if (band.items.length >= perBand * 4 && score <= band.items[band.items.length - 1].score) continue

  // Lichess FEN is before the opponent's last move; the first UCI move is that move
  const [setup, ...solution] = moves.split(' ')
  const chess = new Chess(fen)
  chess.move(uciToMove(setup))

  band.items.push({
    score,
    puzzle: {
      id: `${pack.id}-lc-${id}`,
      gm: pack.id,
      type: 'style',
      source: null,
      fen: chess.fen(),
      solution,
      themes: tags,
      rating: r,
      hint: '',
      explanation: '',
    },
  })
  band.items.sort((a, b) => b.score - a.score)
  band.items.length = Math.min(band.items.length, perBand * 4)
}

const picked = bands.flatMap((b) => b.items.slice(0, perBand).map((s) => s.puzzle)).slice(0, limit)
mkdirSync('data/candidates', { recursive: true })
const out = join('data', 'candidates', `${pack.id}.json`)
writeFileSync(out, JSON.stringify(picked, null, 2))
console.log(`Scanned ${seen.toLocaleString()} puzzles, wrote ${picked.length} candidates to ${out}`)
