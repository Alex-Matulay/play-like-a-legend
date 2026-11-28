/**
 * Mines puzzle candidates from a grandmaster's real games.
 *
 * Needs a native Stockfish binary (https://stockfishchess.org/download/), pointed to by
 * STOCKFISH_PATH (defaults to the copy unzipped into data/stockfish/).
 *
 *   npm run mine:pgn -- --pgn data/pgn/Tal.pgn --player Tal --gm tal
 *
 * How a position qualifies (the same idea Lichess uses for its puzzles):
 *  1. Only games the GM won, from move --skip-opening onwards, with the GM to move.
 *  2. Quick screen (low depth, 2 lines): the best move wins clearly and the second best doesn't.
 *  3. Deep check (high depth): still true, and the GM actually played that best move.
 *  4. The line follows the engine's best play, and only continues while the GM's next move is
 *     again the only one that keeps the win. It always ends on the GM's move.
 * Output: data/candidates/<gm>-games.json, with tags (sacrifice, mate) and an estimated rating,
 * for curation (hints, explanations and notes are written afterwards).
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { parseArgs } from 'node:util'
import { Chess, type Move } from 'chess.js'
import type { GmId, Puzzle } from '../src/types'
import { moveToUci, uciToMove } from './lib/chess-utils'

const { values } = parseArgs({
  options: {
    pgn: { type: 'string' },
    player: { type: 'string' },
    gm: { type: 'string' },
    'screen-ms': { type: 'string', default: '60' },
    'deep-ms': { type: 'string', default: '1500' },
    shard: { type: 'string', default: '1/1' }, // run several copies in parallel: --shard 2/4
    'skip-opening': { type: 'string', default: '10' },
    'max-line': { type: 'string', default: '9' },
    threads: { type: 'string', default: '3' },
    limit: { type: 'string', default: '0' }, // stop after this many games (0 = all), for quick tests
  },
})
if (!values.pgn || !values.player || !values.gm) throw new Error('Usage: --pgn <file> --player <surname> --gm <id>')
const STOCKFISH = process.env.STOCKFISH_PATH ?? 'data/stockfish/stockfish/stockfish-windows-x86-64-universal.exe'
if (!existsSync(STOCKFISH)) throw new Error(`Stockfish not found at ${STOCKFISH}; set STOCKFISH_PATH`)

const WIN = 250 // centipawns for "clearly winning"
const NOT_WIN = 100 // second-best must be no better than this
const MATE = 100000
const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }

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
  cp: number // from the side to move; mates mapped to +-(MATE - plies)
  mate: number | null
  pv: string[]
}

async function analyse(fen: string, movetimeMs: number, multipv = 2): Promise<Line[]> {
  const best: Record<number, Line> = {}
  send(`setoption name MultiPV value ${multipv}`)
  send(`position fen ${fen}`)
  send(`go movetime ${movetimeMs}`)
  await waitFor('bestmove', (l) => {
    const m = l.match(/ multipv (\d+) .*score (cp|mate) (-?\d+).* pv (.+)$/)
    if (!m) return
    const val = Number(m[3])
    const mate = m[2] === 'mate' ? val : null
    const cp = mate !== null ? (mate > 0 ? MATE - mate : -MATE - mate) : val
    best[Number(m[1])] = { cp, mate, pv: m[4].split(' ') }
  })
  return Object.keys(best)
    .sort((a, b) => Number(a) - Number(b))
    .map((k) => best[Number(k)])
}

/** The best move is the only one that wins: clearly winning, and the runner-up is not. */
function uniqueWin(ls: Line[]): boolean {
  const [a, b] = ls
  if (!a || a.cp < WIN) return false
  if (!b) return true // only one legal move
  if (a.mate !== null && a.mate > 0) return !(b.mate !== null && b.mate > 0) && b.cp < WIN
  return b.cp <= NOT_WIN
}

// ---- Main ---------------------------------------------------------------------------------------
send('uci')
await waitFor('uciok')
send(`setoption name Threads value ${values.threads}`)
send('setoption name Hash value 256')
send('isready')
await waitFor('readyok')

const games = readFileSync(values.pgn, 'latin1')
  .split(/\r?\n(?=\[Event )/)
  .filter((g) => g.trim())
const player = values.player.toLowerCase()
const out: (Puzzle & { tags: string[]; evalCp: number })[] = []
const started = Date.now()
const limit = Number(values.limit) || games.length
let scanned = 0

const [shardNo, shardCount] = values.shard!.split('/').map(Number)
for (const [gi, pgn] of games.slice(0, limit).entries()) {
  if (gi % shardCount !== shardNo - 1) continue
  const game = new Chess()
  try {
    game.loadPgn(pgn)
  } catch {
    continue
  }
  const h = game.getHeaders()
  const gmColor = h.White?.toLowerCase().includes(player) ? 'w' : h.Black?.toLowerCase().includes(player) ? 'b' : null
  if (!gmColor) continue
  if (h.Result !== (gmColor === 'w' ? '1-0' : '0-1')) continue // only games the GM won
  scanned++

  const history = game.history({ verbose: true })
  const replay = new Chess(history[0]?.before)
  let lastFoundPly = -99
  for (let ply = 0; ply < history.length; ply++) {
    const played = history[ply]
    const fen = replay.fen()
    replay.move(played)
    if (ply < Number(values['skip-opening']) * 2 || played.color !== gmColor) continue
    if (ply - lastFoundPly < 6) continue // one puzzle per combination

    const quick = await analyse(fen, Number(values['screen-ms']))
    if (!uniqueWin(quick) || quick[0].pv[0] !== moveToUci(played)) continue
    const deep = await analyse(fen, Number(values['deep-ms']))
    if (!uniqueWin(deep) || deep[0].pv[0] !== moveToUci(played)) continue

    // Extend the line while the GM's move stays the only winning one
    const line: string[] = [deep[0].pv[0]]
    const walk = new Chess(fen)
    walk.move(uciToMove(line[0]))
    const maxLine = Number(values['max-line'])
    while (line.length + 2 <= maxLine && !walk.isGameOver()) {
      const reply = (await analyse(walk.fen(), Number(values['deep-ms']), 1))[0]?.pv[0]
      if (!reply) break
      const afterReply = new Chess(walk.fen())
      afterReply.move(uciToMove(reply))
      if (afterReply.isGameOver()) break
      const next = await analyse(afterReply.fen(), Number(values['deep-ms']))
      if (!uniqueWin(next)) break
      line.push(reply, next[0].pv[0])
      walk.move(uciToMove(reply))
      walk.move(uciToMove(next[0].pv[0]))
    }
    if (line.length < 3 && !walk.isCheckmate()) continue // a single non-mating move is too thin

    // Tags and a rough difficulty estimate
    const check = new Chess(fen)
    const moves: Move[] = line.map((u) => check.move(uciToMove(u)))
    const sacrifice = moves.some(
      (m, i) => i % 2 === 0 && moves[i + 1]?.to === m.to && moves[i + 1]?.captured && VALUE[m.piece] > VALUE[m.captured ?? 'p'],
    )
    const mate = check.isCheckmate()
    const quietFirst = !moves[0].captured && !moves[0].san.includes('+')
    const solverMoves = Math.ceil(line.length / 2)
    const rating = Math.min(2300, 1250 + solverMoves * 140 + (quietFirst ? 180 : 0) + (sacrifice ? 60 : 0) + (mate ? 0 : 80))
    const tags = [sacrifice && 'sacrifice', mate && `mateIn${solverMoves}`, quietFirst && 'quietMove'].filter(Boolean) as string[]

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
      themes: tags.length ? tags : ['advantage'],
      tags,
      evalCp: deep[0].cp,
      rating,
      hint: '',
      explanation: '',
      gameContinuation: game
        .history()
        .slice(ply, ply + 8)
        .join(' '),
    })
    lastFoundPly = ply
    console.log(`game ${gi + 1} (${h.White} - ${h.Black}, ${h.Date}) move ${moveNo}: ${moves.map((m) => m.san).join(' ')} [${tags.join(',')}]`)
  }
  if (scanned % 50 === 0) {
    const mins = ((Date.now() - started) / 60000).toFixed(1)
    console.log(`... ${scanned} won games scanned, ${out.length} candidates, ${mins} min`)
  }
}

send('quit')
mkdirSync('data/candidates', { recursive: true })
const file = join('data', 'candidates', shardCount > 1 ? `${values.gm}-games-${shardNo}of${shardCount}.json` : `${values.gm}-games.json`)
writeFileSync(file, JSON.stringify(out, null, 2))
console.log(`\n${out.length} candidates from ${scanned} won games written to ${file}`)
