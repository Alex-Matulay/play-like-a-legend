/**
 * Checks every puzzle in src/data/puzzles/*.json:
 *  - FEN is valid and the solution line is legal
 *  - the line ends on a solver move
 *  - mate puzzles: the line ends in checkmate, the first move really forces mate in N
 *    against every defence, and no other first move also mates in N (uniqueness)
 *
 * Run: npm run verify
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Chess } from 'chess.js'
import type { Puzzle } from '../src/types'
import { alternativeMates, hasForcedMate, uciToMove } from './lib/chess-utils'

const dir = join(import.meta.dirname, '..', 'src', 'data', 'puzzles')
const UNIQUENESS_BUDGET_MS = 60_000

let failures = 0
const ids = new Set<string>()

for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
  const puzzles = JSON.parse(readFileSync(join(dir, file), 'utf8')) as Puzzle[]
  for (const p of puzzles) {
    const problems: string[] = []
    const notes: string[] = []
    if (ids.has(p.id)) problems.push('duplicate id')
    ids.add(p.id)

    let chess: Chess
    try {
      chess = new Chess(p.fen)
    } catch (e) {
      console.log(`FAIL ${p.id}: bad FEN (${(e as Error).message})`)
      failures++
      continue
    }
    if (chess.isGameOver()) problems.push('start position is already game over')
    if (p.solution.length % 2 === 0) problems.push('solution must end on a solver move (odd length)')

    const san: string[] = []
    for (const uci of p.solution) {
      try {
        san.push(chess.move(uciToMove(uci)).san)
      } catch {
        problems.push(`illegal move ${uci} after ${san.join(' ') || 'start'}`)
        break
      }
    }

    const mateTheme = p.themes.find((t) => /^mateIn\d$/.test(t))
    if (mateTheme && problems.length === 0) {
      const n = Number(mateTheme.slice(-1))
      const solverMoves = Math.ceil(p.solution.length / 2)
      if (!chess.isCheckmate()) problems.push('line does not end in checkmate')
      if (solverMoves !== n) problems.push(`theme says ${mateTheme} but line has ${solverMoves} solver moves`)

      const start = new Chess(p.fen)
      if (!hasForcedMate(start, n)) problems.push(`no forced mate in ${n} found from the start position`)

      // The first move must force mate against every defence, not just the one in the line
      start.move(uciToMove(p.solution[0]))
      const forced = start.isCheckmate() || hasForcedMateAfterReplies(start, n - 1)
      if (!forced) problems.push('first move does not force mate against every defence')

      const alts = alternativeMates(p.fen, p.solution[0], n, UNIQUENESS_BUDGET_MS)
      if (alts === 'timeout') notes.push('uniqueness check timed out; review by hand')
      else if (alts.length) problems.push(`other first moves also mate in ${n}: ${alts.join(', ')}`)
    }

    if (problems.length) {
      failures++
      console.log(`FAIL ${p.id}: ${problems.join('; ')}`)
    } else {
      console.log(`ok   ${p.id}  ${san.join(' ')}${notes.length ? `  (${notes.join('; ')})` : ''}`)
    }
  }
}

function hasForcedMateAfterReplies(chess: Chess, n: number): boolean {
  if (n <= 0) return false
  for (const reply of chess.moves({ verbose: true })) {
    chess.move(reply)
    const ok = hasForcedMate(chess, n)
    chess.undo()
    if (!ok) return false
  }
  return true
}

console.log(failures ? `\n${failures} puzzle(s) failed` : '\nAll puzzles passed')
process.exit(failures ? 1 : 0)
