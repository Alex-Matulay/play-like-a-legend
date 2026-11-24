/**
 * Turns data/candidates/<gm>.json (from import:lichess) into finished pack puzzles:
 *  - drops repeated lines and caps each tactical "shape" so the pack has variety
 *  - spreads picks evenly across the rating range
 *  - mate puzzles must pass the same forced-mate + unique-first-move check as `npm run verify`
 *  - drafts a hint and an explanation from the line and its themes (review them by hand)
 *
 *   npm run curate -- --gm tal --count 55 --start 6
 *
 * Appends to src/data/puzzles/<gm>.json, continuing the id numbering from --start.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { Chess, type Move } from 'chess.js'
import type { Puzzle } from '../src/types'
import { PACKS } from '../src/data/packs'
import { alternativeMates, hasForcedMate, uciToMove } from './lib/chess-utils'

const { values } = parseArgs({
  options: {
    gm: { type: 'string', default: 'tal' },
    count: { type: 'string', default: '55' },
    start: { type: 'string', default: '6' },
    'max-per-shape': { type: 'string', default: '2' },
    'mate-share': { type: 'string', default: '0.8' },
  },
})
const gm = values.gm!
const pack = PACKS.find((p) => p.id === gm)!
const surname = pack.name.split(' ').pop()!
const count = Number(values.count)
const candidates = JSON.parse(readFileSync(join('data', 'candidates', `${gm}.json`), 'utf8')) as Puzzle[]
const outFile = join('src', 'data', 'puzzles', `${gm}.json`)
const existing = JSON.parse(readFileSync(outFile, 'utf8')) as Puzzle[]

const PIECE: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' }

interface Analysed {
  p: Puzzle
  moves: Move[]
  shape: string
  mateIn: number | null
}

function analyse(p: Puzzle): Analysed | null {
  const g = new Chess(p.fen)
  const moves: Move[] = []
  try {
    for (const u of p.solution) moves.push(g.move(uciToMove(u)))
  } catch {
    return null
  }
  const mateTheme = p.themes.find((t) => /^mateIn\d$/.test(t))
  // "Shape" = the move pattern without squares, e.g. "N+ K Q+ Rx N#"
  const shape = moves.map((m) => m.piece.toUpperCase() + (m.captured ? 'x' : '') + (m.san.match(/[+#]$/)?.[0] ?? '')).join(' ')
  return { p, moves, shape, mateIn: mateTheme ? Number(mateTheme.slice(-1)) : null }
}

function sanLine(a: Analysed): string {
  const blackFirst = a.p.fen.split(' ')[1] === 'b'
  return a.moves
    .map((m, i) => {
      const ply = i + (blackFirst ? 1 : 0)
      const no = Math.floor(ply / 2) + 1
      const mark = i === 0 || isSacrifice(a, i) ? '!' : ''
      const prefix = ply % 2 === 0 ? `${no}.` : i === 0 ? `${no}...` : ''
      return `${prefix}${m.san}${mark}`
    })
    .join(' ')
}

/** Solver move i is a sacrifice if the reply captures the piece that just moved. */
function isSacrifice(a: Analysed, i: number): boolean {
  if (i % 2 !== 0) return false
  const reply = a.moves[i + 1]
  return !!reply && reply.to === a.moves[i].to && !!reply.captured && a.moves[i].piece !== 'p'
}

function themeSentence(a: Analysed): string {
  const t = new Set(a.p.themes)
  const last = a.moves[a.moves.length - 1]
  if (t.has('smotheredMate')) return 'The king is buried behind its own pieces, and the knight delivers a smothered mate.'
  if (t.has('arabianMate')) return 'Rook and knight work together in the corner: the Arabian mate.'
  if (t.has('operaMate')) return 'The rook lands on the back rank, guarded by the bishop. It is the same idea Morphy used in his famous Opera Game.'
  if (t.has('epauletteMate')) return 'The king is hemmed in by its own pieces on both sides, so one check is enough.'
  if (t.has('promotion')) return 'The pawn crashes through and promotes, which ends the game.'
  if (t.has('advancedPawn') && last.san.endsWith('#')) return 'The advanced pawn is the hidden hero. Once the queen is gone, it takes away the king\'s escape squares.'
  if (t.has('skewer')) return 'The last check skewers the king and wins the piece behind it, leaving a won position.'
  if (t.has('discoveredCheck') || t.has('doubleCheck')) return 'Discovered and double checks leave the defender no time to regroup.'
  if (last.san.endsWith('#')) return 'Every move is a check or a direct threat, so the defender never gets a free move.'
  return 'The attack wins decisive material.'
}

function explanation(a: Analysed): string {
  const sacIdx = a.moves.findIndex((_, i) => isSacrifice(a, i))
  const parts = [`${sanLine(a)}.`]
  if (sacIdx >= 0) {
    const m = a.moves[sacIdx]
    parts.push(`The ${PIECE[m.piece]} sacrifice on ${m.to} is the key: it forces the defence onto the one square where it collapses.`)
  }
  parts.push(themeSentence(a))
  if (sacIdx >= 0) parts.push(`${surname} would not even have stopped to count the material.`)
  return parts.join(' ')
}

function hint(a: Analysed): string {
  const first = a.moves[0]
  const piece = PIECE[first.piece]
  if (isSacrifice(a, 0)) return `Your ${piece} is worth less than the attack. Where can it go to force the king's hand?`
  if (a.p.themes.includes('doubleCheck') && a.moves.some((m, i) => i % 2 === 0 && m.san.includes('+') && i > 0))
    return `Start with a ${piece} move and look for a double check one move later.`
  if (first.san.includes('+')) return `Begin with a forcing ${piece} check. The real blow comes afterwards.`
  return `The first move is quiet but deadly. What does your ${piece} threaten from its new square?`
}

// ---- Selection ---------------------------------------------------------------------------------
const usedLines = new Set(existing.map((p) => p.fen.split(' ').slice(0, 2).join(' ')))
const shapeCount = new Map<string, number>()
const maxPerShape = Number(values['max-per-shape'])
const mateTarget = Math.round(count * Number(values['mate-share']))

const pool = candidates
  .map(analyse)
  .filter((a): a is Analysed => !!a && (a.mateIn === null || a.mateIn <= 4))
  .sort((x, y) => x.p.rating - y.p.rating)

const lo = pool[0].p.rating
const hi = pool[pool.length - 1].p.rating
const buckets = 11
const perBucket = Math.ceil(count / buckets)
const picked: Analysed[] = []
let mates = 0
let rejected = 0

function accept(a: Analysed): boolean {
  const key = a.p.fen.split(' ').slice(0, 2).join(' ')
  if (usedLines.has(key)) return false
  if ((shapeCount.get(a.shape) ?? 0) >= maxPerShape) return false
  const isMate = a.mateIn !== null
  if (isMate && mates >= mateTarget) return false
  if (!isMate && picked.length - mates >= count - mateTarget) return false
  if (isMate) {
    const n = a.mateIn!
    const ok = hasForcedMate(new Chess(a.p.fen), n)
    const alts = ok ? alternativeMates(a.p.fen, a.p.solution[0], n, 20_000) : 'timeout'
    if (!ok || alts === 'timeout' || alts.length) {
      rejected++
      return false
    }
  }
  usedLines.add(key)
  shapeCount.set(a.shape, (shapeCount.get(a.shape) ?? 0) + 1)
  if (isMate) mates++
  picked.push(a)
  return true
}

for (let b = 0; b < buckets && picked.length < count; b++) {
  const from = lo + ((hi - lo) * b) / buckets
  const to = lo + ((hi - lo) * (b + 1)) / buckets
  let inBucket = 0
  for (const a of pool) {
    if (a.p.rating < from || a.p.rating >= to || inBucket >= perBucket || picked.length >= count) continue
    if (accept(a)) inBucket++
  }
}
// Top up from anywhere if some buckets were thin
for (const a of pool) if (picked.length < count) accept(a)

picked.sort((x, y) => x.p.rating - y.p.rating)
let n = Number(values.start)
const finished: Puzzle[] = picked.map((a) => ({
  id: `${gm}-${String(n++).padStart(3, '0')}`,
  gm: a.p.gm,
  type: 'style',
  source: null,
  lichessId: a.p.id.split('-').pop(),
  fen: a.p.fen,
  solution: a.p.solution,
  themes: a.p.themes.filter((t) => !['short', 'long', 'veryLong', 'master', 'masterVsMaster', 'superGM', 'oneMove'].includes(t)),
  rating: a.p.rating,
  hint: hint(a),
  explanation: explanation(a),
}))

writeFileSync(outFile, JSON.stringify([...existing, ...finished], null, 2) + '\n')
console.log(
  `Added ${finished.length} puzzles (${mates} mates, ${finished.length - mates} material wins), ` +
    `ratings ${finished[0]?.rating}-${finished[finished.length - 1]?.rating}, ${rejected} mates rejected by the uniqueness check`,
)
