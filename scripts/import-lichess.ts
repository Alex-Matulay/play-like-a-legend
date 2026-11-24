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
import { closeSync, createReadStream, fstatSync, mkdirSync, openSync, readSync, writeFileSync } from 'node:fs'
import nodeZlib from 'node:zlib'
import { createInterface } from 'node:readline'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { Chess } from 'chess.js'
import { PACKS } from '../src/data/packs'
import type { Puzzle } from '../src/types'
import { uciToMove } from './lib/chess-utils'

/**
 * Lichess ships the database in pzstd format: many independent zstd frames, each preceded by a
 * skippable frame (magic 0x184D2A50) holding the next frame's compressed size. Node's streaming
 * decoder stops at the first skippable frame, so walk the frames and decompress each one.
 * Needs Node 23.8+ for built-in zstd.
 */
function* pzstdChunks(path: string): Generator<Buffer> {
  const zlib = nodeZlib as typeof nodeZlib & { zstdDecompressSync?: (b: Buffer) => Buffer }
  if (!zlib.zstdDecompressSync) throw new Error('This Node version has no zstd; decompress the file first')
  const fd = openSync(path, 'r')
  const size = fstatSync(fd).size
  const head = Buffer.alloc(12)
  let pos = 0
  try {
    while (pos + 8 <= size) {
      readSync(fd, head, 0, 12, pos)
      const magic = head.readUInt32LE(0)
      if ((magic & 0xfffffff0) !== 0x184d2a50) throw new Error(`Not a pzstd file (unexpected bytes at ${pos})`)
      const skipLen = head.readUInt32LE(4)
      if (skipLen !== 4) {
        pos += 8 + skipLen // some other skippable frame, e.g. a seek table
        continue
      }
      const frameLen = head.readUInt32LE(8)
      const frame = Buffer.alloc(frameLen)
      readSync(fd, frame, 0, frameLen, pos + 12)
      yield zlib.zstdDecompressSync(frame)
      pos += 12 + frameLen
    }
  } finally {
    closeSync(fd)
  }
}

const { values } = parseArgs({
  options: {
    gm: { type: 'string', default: 'tal' },
    csv: { type: 'string', default: 'data/lichess_db_puzzle.csv.zst' },
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

async function* lines(): AsyncGenerator<string> {
  if (!values.csv!.endsWith('.zst')) {
    yield* createInterface({ input: createReadStream(values.csv!) })
    return
  }
  let rest = ''
  for (const chunk of pzstdChunks(values.csv!)) {
    const parts = (rest + chunk.toString('utf8')).split('\n')
    rest = parts.pop() ?? ''
    yield* parts
  }
  if (rest) yield rest
}

const mustHave = pack.themeProfile[0] // the defining theme, e.g. "sacrifice" for Tal
let seen = 0

for await (const line of lines()) {
  if (seen++ === 0 && line.startsWith('PuzzleId')) continue
  // PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags
  const [id, fen, moves, rating, , popularity, plays, themes] = line.split(',')
  if (!themes) continue // blank or truncated line
  const r = Number(rating)
  if (r < minRating || r >= maxRating) continue
  if (Number(popularity) < Number(values['min-popularity']) || Number(plays) < Number(values['min-plays'])) continue

  const tags = themes.split(' ')
  if (!tags.includes(mustHave)) continue
  const matches = tags.filter((t) => profile.has(t)).length
  if (matches < 2) continue

  const band = bands.find((b) => r >= b.lo && r < b.hi)!
  // Score = style match first, then popularity as a quality signal
  const score = matches * 1e6 + Number(popularity) * 1e4 + Math.min(Number(plays), 9999)
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
