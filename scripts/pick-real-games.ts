/**
 * Picks the best real-game candidates (from mine:pgn) and decides which Lichess puzzles they
 * replace, keeping the pack's difficulty spread. Writes a plan; nothing in the pack changes yet.
 *
 *   npx tsx scripts/pick-real-games.ts --gm tal --count 20
 *
 * Output: data/candidates/<gm>-real-plan.json  { add: Puzzle[], remove: string[] }
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { Chess, type Move } from 'chess.js'
import type { Puzzle } from '../src/types'
import { uciToMove } from './lib/chess-utils'

const { values } = parseArgs({ options: { gm: { type: 'string', default: 'tal' }, count: { type: 'string', default: '20' } } })
const gm = values.gm!
const count = Number(values.count)

type Candidate = Puzzle & { tags: string[]; evalCp: number }
const dir = join('data', 'candidates')
const candidates: Candidate[] = readdirSync(dir)
  .filter((f) => f.startsWith(`${gm}-games`) && f.endsWith('.json'))
  .flatMap((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as Candidate[])
console.log(`${candidates.length} candidates`)

function line(p: Puzzle): Move[] {
  const c = new Chess(p.fen)
  return p.solution.map((u) => c.move(uciToMove(u)))
}

const tier = (r: number) => (r < 1500 ? 0 : r < 1800 ? 1 : 2)

// Keep only positions that feel like Tal: a sacrifice, or a forced mate. Drop odd endings.
const good = candidates.filter((p) => {
  const ms = line(p)
  const last = ms[ms.length - 1]
  const mate = p.tags.some((t) => t.startsWith('mateIn'))
  if (!p.tags.includes('sacrifice') && !mate) return false
  if (last.piece === 'k' && !mate) return false // ending on a king walk reads badly as a puzzle
  if (ms.length < 3) return false
  return true
})
console.log(`${good.length} with a sacrifice or forced mate`)

const score = (p: Candidate) =>
  (p.tags.includes('sacrifice') ? 3 : 0) + (p.tags.some((t) => t.startsWith('mateIn')) ? 2 : 0) + (p.tags.includes('quietMove') ? 1 : 0)

// One per game, best first; then fill each difficulty tier in proportion to the current pack
const byGame = new Map<string, Candidate>()
for (const p of good.sort((a, b) => score(b) - score(a))) {
  const key = `${p.source?.white}|${p.source?.black}|${p.source?.year}|${p.source?.event}`
  if (!byGame.has(key)) byGame.set(key, p)
}
const pool = [...byGame.values()]
const pack = JSON.parse(readFileSync(join('src', 'data', 'puzzles', `${gm}.json`), 'utf8')) as Puzzle[]
const tierShare = [0, 1, 2].map((t) => pack.filter((p) => tier(p.rating) === t).length / pack.length)
const want = tierShare.map((s) => Math.round(s * count))
want[1] += count - want.reduce((a, b) => a + b, 0)

const picked: Candidate[] = []
const usedYears = new Map<number, number>()
for (const t of [0, 1, 2]) {
  const inTier = pool.filter((p) => tier(p.rating) === t).sort((a, b) => score(b) - score(a))
  for (const p of inTier) {
    if (picked.filter((x) => tier(x.rating) === t).length >= want[t]) break
    const y = p.source?.year ?? 0
    if ((usedYears.get(y) ?? 0) >= 2) continue // spread across his career
    usedYears.set(y, (usedYears.get(y) ?? 0) + 1)
    picked.push(p)
  }
}
// Top up if a tier ran short
for (const p of pool.sort((a, b) => score(b) - score(a))) if (picked.length < count && !picked.includes(p)) picked.push(p)

// Remove Lichess puzzles from the most repeated tactical shapes, matched by difficulty
const lichess = pack.filter((p) => p.lichessId)
const shape = (p: Puzzle) => line(p).map((m) => m.piece + (m.captured ? 'x' : '') + (m.san.match(/[+#]$/)?.[0] ?? '')).join(' ')
const shapeCount = new Map<string, number>()
for (const p of lichess) shapeCount.set(shape(p), (shapeCount.get(shape(p)) ?? 0) + 1)
const remove: string[] = []
for (const add of picked.sort((a, b) => a.rating - b.rating)) {
  const options = lichess
    .filter((p) => !remove.includes(p.id) && tier(p.rating) === tier(add.rating))
    .sort((a, b) => shapeCount.get(shape(b))! - shapeCount.get(shape(a))! || Math.abs(a.rating - add.rating) - Math.abs(b.rating - add.rating))
  const victim = options[0] ?? lichess.filter((p) => !remove.includes(p.id)).sort((a, b) => Math.abs(a.rating - add.rating) - Math.abs(b.rating - add.rating))[0]
  remove.push(victim.id)
  shapeCount.set(shape(victim), shapeCount.get(shape(victim))! - 1)
}

writeFileSync(join(dir, `${gm}-real-plan.json`), JSON.stringify({ add: picked, remove }, null, 2))
for (const p of picked)
  console.log(`${p.rating} ${p.source?.white} - ${p.source?.black}, ${p.source?.event} ${p.source?.year}: ${line(p).map((m) => m.san).join(' ')} [${p.tags.join(',')}]`)
console.log(`\nwould remove: ${remove.join(', ')}`)
