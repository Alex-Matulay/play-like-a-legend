/**
 * Prints a verified fact sheet for puzzles, to write hints/notes/explanations from facts
 * rather than from reading the board by eye.
 *
 *   npx tsx scripts/fact-sheet.ts tal-006 tal-007        # specific puzzles
 *   npx tsx scripts/fact-sheet.ts --from 6 --to 19       # a range of tal-NNN ids
 *
 * For the start position and after every move: ASCII board (from the solver's side), side to
 * move, whether in check and by which pieces, all legal moves for the side to move, and which
 * pieces of each side are attacked and by what.
 */
import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { Chess, type Color, type Square } from 'chess.js'
import type { Puzzle } from '../src/types'
import { uciToMove } from './lib/chess-utils'

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { gm: { type: 'string', default: 'tal' }, from: { type: 'string' }, to: { type: 'string' } },
})
const all = JSON.parse(readFileSync(`src/data/puzzles/${values.gm}.json`, 'utf8')) as Puzzle[]
const wanted = positionals.length
  ? all.filter((p) => positionals.includes(p.id))
  : all.filter((p) => {
      const n = Number(p.id.split('-').pop())
      return n >= Number(values.from ?? 0) && n <= Number(values.to ?? 9999)
    })

const NAME: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' }
const side = (c: Color) => (c === 'w' ? 'White' : 'Black')

function board(chess: Chess, flip: boolean): string {
  const rows = chess.board().map((row, r) =>
    `${8 - r} ` + row.map((sq) => (sq ? (sq.color === 'w' ? sq.type.toUpperCase() : sq.type) : '.')).join(' '),
  )
  const files = '  a b c d e f g h'
  if (!flip) return [...rows, files].join('\n')
  return [...rows.reverse().map((l) => l[0] + ' ' + l.slice(2).split(' ').reverse().join(' ')), '  h g f e d c b a'].join('\n')
}

function attacked(chess: Chess, victim: Color): string[] {
  const out: string[] = []
  const enemy = victim === 'w' ? 'b' : 'w'
  for (const row of chess.board())
    for (const sq of row)
      if (sq && sq.color === victim) {
        const by = chess.attackers(sq.square, enemy)
        if (by.length) {
          const defenders = chess.attackers(sq.square, victim)
          out.push(
            `${NAME[sq.type]} ${sq.square} attacked by ${by.map((s) => `${NAME[chess.get(s as Square)!.type]} ${s}`).join(', ')}` +
              (defenders.length ? ` (defended by ${defenders.map((s) => `${NAME[chess.get(s as Square)!.type]} ${s}`).join(', ')})` : ' (UNDEFENDED)'),
          )
        }
      }
  return out
}

function describe(chess: Chess, flip: boolean): string {
  const lines = [board(chess, flip)]
  const stm = chess.turn()
  if (chess.isCheckmate()) lines.push(`${side(stm)} is CHECKMATED`)
  else if (chess.inCheck()) {
    const k = chess.board().flat().find((s) => s?.type === 'k' && s.color === stm)!.square
    const by = chess.attackers(k, stm === 'w' ? 'b' : 'w')
    lines.push(`${side(stm)} to move, IN CHECK from ${by.map((s) => `${NAME[chess.get(s as Square)!.type]} ${s}`).join(' and ')}`)
  } else lines.push(`${side(stm)} to move`)
  const legal = chess.moves()
  if (!chess.isGameOver()) lines.push(`legal moves (${legal.length}): ${legal.join(' ')}`)
  for (const c of ['w', 'b'] as Color[]) {
    const a = attacked(chess, c)
    if (a.length) lines.push(`${side(c)} pieces under attack: ${a.join('; ')}`)
  }
  return lines.join('\n')
}

for (const p of wanted) {
  const chess = new Chess(p.fen)
  const flip = chess.turn() === 'b'
  console.log(`\n================ ${p.id} | rating ${p.rating} | ${side(chess.turn())} solves | themes: ${p.themes.join(', ')}`)
  console.log(`--- start position`)
  console.log(describe(chess, flip))
  p.solution.forEach((uci, i) => {
    const m = chess.move(uciToMove(uci))
    console.log(`--- ply ${i + 1}: ${side(m.color)} plays ${m.san}${m.captured ? ` (captures ${NAME[m.captured]})` : ''}${i % 2 === 0 ? '  [SOLVER]' : '  [DEFENDER]'}`)
    console.log(describe(chess, flip))
  })
}
