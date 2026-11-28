/**
 * Adds the curated real-game puzzles to the pack and removes the same number of Lichess puzzles,
 * taking them from the most repeated tactical patterns and matching difficulty tiers.
 *
 *   npx tsx scripts/merge-real-games.ts --gm tal --ready data/candidates/tal-real-ready.json \
 *     --text data/rewrites/real-1.json,data/rewrites/real-2.json
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { Chess } from 'chess.js'
import type { Puzzle } from '../src/types'
import { uciToMove } from './lib/chess-utils'

const { values } = parseArgs({ options: { gm: { type: 'string', default: 'tal' }, ready: { type: 'string' }, text: { type: 'string' } } })
const packFile = join('src', 'data', 'puzzles', `${values.gm}.json`)
const pack = JSON.parse(readFileSync(packFile, 'utf8')) as Puzzle[]
const ready = JSON.parse(readFileSync(values.ready!, 'utf8')) as Puzzle[]
const text = values.text!.split(',').flatMap((f) => JSON.parse(readFileSync(f, 'utf8'))) as (Pick<Puzzle, 'id' | 'hint' | 'explanation' | 'moveNotes'> & { rating: number })[]

/** "Tal, Mihail" -> "Mikhail Tal"; "Reshevsky, Samuel Herman" -> "Samuel Reshevsky" */
const SPECIAL: Record<string, string> = { 'Tal, Mihail': 'Mikhail Tal', 'Kortschnoj, Viktor': 'Viktor Korchnoi' }
function tidyName(raw: string): string {
  if (SPECIAL[raw]) return SPECIAL[raw]
  const [surname, given] = raw.split(',').map((s) => s.trim())
  if (!given) return surname
  const first = given.split(/\s+/).find((t) => t.replace('.', '').length > 1) ?? given.split(/\s+/)[0]
  return `${first} ${surname}`
}
const EVENTS: Record<string, string> = {
  'Munich olm fin-A': 'Munich Olympiad',
  'URS-ch32': 'USSR Championship',
  'URS-ch24': 'USSR Championship',
  'URS Spartakiad': 'USSR Spartakiad',
  Hastings7374: 'Hastings 1973/74',
  'URS-ch sf': 'USSR Championship semi-final',
  'Herceg Novi blitz': 'Herceg Novi blitz tournament',
  'Tbilisi sim m': 'Tbilisi',
  'Bundesliga 8990': 'Bundesliga 1989/90',
  'World Championship 24th': 'World Championship match',
  Zuerich: 'Zurich',
}

const added: Puzzle[] = ready.map((p) => {
  const t = text.find((x) => x.id === p.id)
  if (!t) throw new Error(`no text for ${p.id}`)
  if (t.moveNotes?.length !== p.solution.length) throw new Error(`${p.id}: notes/moves mismatch`)
  return {
    ...p,
    source: p.source && { ...p.source, white: tidyName(p.source.white), black: tidyName(p.source.black), event: EVENTS[p.source.event] ?? p.source.event },
    rating: t.rating,
    hint: t.hint,
    explanation: t.explanation,
    moveNotes: t.moveNotes,
  }
})

const tier = (r: number) => (r < 1500 ? 0 : r < 1800 ? 1 : 2)
const shape = (p: Puzzle) => {
  const c = new Chess(p.fen)
  return p.solution.map((u) => c.move(uciToMove(u))).map((m) => m.piece + (m.captured ? 'x' : '') + (m.san.match(/[+#]$/)?.[0] ?? '')).join(' ')
}
const lichess = pack.filter((p) => p.lichessId)
const shapeCount = new Map<string, number>()
for (const p of lichess) shapeCount.set(shape(p), (shapeCount.get(shape(p)) ?? 0) + 1)

const remove = new Set<string>()
for (const add of [...added].sort((a, b) => a.rating - b.rating)) {
  const left = lichess.filter((p) => !remove.has(p.id))
  const sameTier = left.filter((p) => tier(p.rating) === tier(add.rating))
  const pickFrom = sameTier.length ? sameTier : left
  const victim = pickFrom.sort(
    (a, b) => shapeCount.get(shape(b))! - shapeCount.get(shape(a))! || Math.abs(a.rating - add.rating) - Math.abs(b.rating - add.rating),
  )[0]
  remove.add(victim.id)
  shapeCount.set(shape(victim), shapeCount.get(shape(victim))! - 1)
}

const next = [...pack.filter((p) => !remove.has(p.id)), ...added]
writeFileSync(packFile, JSON.stringify(next, null, 2) + '\n')
const counts = [0, 1, 2].map((t) => next.filter((p) => tier(p.rating) === t).length)
console.log(`removed ${remove.size}: ${[...remove].join(', ')}`)
console.log(`pack now ${next.length} puzzles: ${next.filter((p) => p.type === 'real').length} real, ${next.filter((p) => p.lichessId).length} Lichess, ${next.filter((p) => !p.lichessId && p.type !== 'real').length} original`)
console.log(`tiers club/strong/expert: ${counts.join(' / ')}`)
for (const p of added) console.log(`${p.id} ${p.rating} ${p.source?.white} vs ${p.source?.black}, ${p.source?.event} ${p.source?.year}`)
