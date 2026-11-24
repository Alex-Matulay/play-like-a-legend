/**
 * Mines puzzle candidates from a grandmaster's real games.
 *
 * Needs a native Stockfish binary (https://stockfishchess.org/download/, or
 * `winget install Stockfish.Stockfish`), pointed to by STOCKFISH_PATH.
 *
 *   STOCKFISH_PATH="C:/tools/stockfish.exe" npm run mine:pgn -- --pgn data/pgn/tal.pgn --player Tal --gm tal
 *
 * Rule (the same idea Lichess uses): a position where the GM is to move, the best move wins
 * clearly (>= +2.0 or mate), the second-best move does not (<= +0.8), and the GM actually played
 * the best move. Those are the moments that show the player's style. Output goes to
 * data/candidates/<gm>-games.json for human review.
 */
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { parseArgs } from 'node:util'
import { Chess } from 'chess.js'
import type { GmId, Puzzle } from '../src/types'
import { moveToUci, uciToMove } from './lib/chess-utils'

const { values } = parseArgs({
  options: {
    pgn: { type: 'string' },
    player: { type: 'string' },
    gm: { type: 'string' },
    depth: { type: 'string', default: '18' },
    'skip-opening': { type: 'string', default: '10' },
    'max-line': { type: 'string', default: '7' },
  },
})
if (!values.pgn || !values.player || !values.gm) throw new Error('Usage: --pgn <file> --player <surname> --gm <id>')
const STOCKFISH = process.env.STOCKFISH_PATH
if (!STOCKFISH) throw new Error('Set STOCKFISH_PATH to a Stockfish binary')

const WIN = 200 // centipawns
const NOT_WIN = 80
const depth = Number(values.depth)

// ---- Minimal UCI client -------------------------------------------------------------------------
const engine = spawn(STOCKFISH)
const lines = createInterface({ input: engine.stdout })
let waiter: ((line: string) => void) | null = null
lines.on('line', (l) => waiter?.(l))
const send = (cmd: string) => engine.stdin.write(cmd + '\n')

function waitFor(prefix: string, onLine?: (l: string) => void): Promise<string> {
  return new Promise((resolve) => {
    waiter = (l) => {
      onLine?.(l)
      if (l.startsWith(prefix)) resolve(l)
    }
  })
}

interface Line {
  cp: number // from side to move; mate scores mapped to +-100000
  pv: string[]
}

async function analyse(fen: string): Promise<Line[]> {
  const best: Record<number, Line> = {}
  send(`position fen ${fen}`)
  send(`go depth ${depth}`)
  await waitFor('bestmove', (l) => {
    const m = l.match(/ multipv (\d+) .*score (cp|mate) (-?\d+).* pv (.+)$/)
    if (!m) return
    const val = Number(m[3])
    const cp = m[2] === 'mate' ? (val > 0 ? 100000 - val : -100000 - val) : val
    best[Number(m[1])] = { cp, pv: m[4].split(' ') }
  })
  return [best[1], best[2]].filter(Boolean)
}

// ---- Main ---------------------------------------------------------------------------------------
send('uci')
await waitFor('uciok')
send('setoption name MultiPV value 2')
send('isready')
await waitFor('readyok')

const games = readFileSync(values.pgn, 'utf8')
  .split(/\r?\n(?=\[Event )/)
  .filter((g) => g.trim())
const player = values.player.toLowerCase()
const out: Puzzle[] = []

for (const [gi, pgn] of games.entries()) {
  const game = new Chess()
  try {
    game.loadPgn(pgn)
  } catch {
    console.warn(`skip game ${gi + 1}: could not parse`)
    continue
  }
  const h = game.getHeaders()
  const gmColor = h.White?.toLowerCase().includes(player) ? 'w' : h.Black?.toLowerCase().includes(player) ? 'b' : null
  if (!gmColor) continue

  const history = game.history({ verbose: true })
  const replay = new Chess(history[0]?.before)
  for (let ply = 0; ply < history.length; ply++) {
    const played = history[ply]
    const fen = replay.fen()
    replay.move(played)
    if (ply < Number(values['skip-opening']) * 2 || played.color !== gmColor) continue

    const [first, second] = await analyse(fen)
    if (!first || first.cp < WIN || (second && second.cp > NOT_WIN)) continue
    if (first.pv[0] !== moveToUci(played)) continue

    // Trim the engine line so it ends on a solver move
    const maxLine = Number(values['max-line'])
    const line = first.pv.slice(0, maxLine % 2 ? maxLine : maxLine - 1)
    if (line.length % 2 === 0) line.pop()
    const check = new Chess(fen)
    try {
      line.forEach((u) => check.move(uciToMove(u)))
    } catch {
      continue
    }

    const moveNo = Math.floor(ply / 2) + 1
    out.push({
      id: `${values.gm}-g${gi + 1}-${moveNo}`,
      gm: values.gm as GmId,
      type: 'real',
      source: {
        white: h.White ?? '?',
        black: h.Black ?? '?',
        event: h.Event ?? '',
        year: Number((h.Date ?? '').slice(0, 4)) || 0,
      },
      fen,
      solution: line,
      themes: check.isCheckmate() ? [`mateIn${Math.ceil(line.length / 2)}`] : ['advantage'],
      rating: 0, // set by hand or from playtest solve rates
      hint: '',
      explanation: '',
      gameContinuation: game
        .history()
        .slice(ply, ply + 6)
        .join(' '),
    })
    console.log(`game ${gi + 1} move ${moveNo}: ${played.san} (${(first.cp / 100).toFixed(1)})`)
  }
}

send('quit')
mkdirSync('data/candidates', { recursive: true })
const file = join('data', 'candidates', `${values.gm}-games.json`)
writeFileSync(file, JSON.stringify(out, null, 2))
console.log(`\n${out.length} candidates from ${games.length} games written to ${file}`)
