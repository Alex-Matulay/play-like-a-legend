import { Chess, type Color, type Move, type PieceSymbol, type Square } from 'chess.js'
import type { Puzzle } from '../types'

const NAME: Record<PieceSymbol, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' }
const VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 }
const SIDE: Record<Color, string> = { w: 'White', b: 'Black' }

function toMove(uci: string) {
  return { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }
}

function kingSquare(chess: Chess, color: Color): Square {
  for (const row of chess.board()) for (const sq of row) if (sq?.type === 'k' && sq.color === color) return sq.square
  throw new Error('no king')
}

function list(items: string[]): string {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/** Why the defender's king can't get out, in a few words. */
function mateReason(after: Chess, loser: Color): string {
  const k = kingSquare(after, loser)
  const checkers = after.attackers(k, loser === 'w' ? 'b' : 'w')
  if (checkers.length === 1) {
    const checker = after.get(checkers[0])!
    if (checker.type === 'n') return 'A knight check cannot be blocked, and the king has nowhere to go.'
  }
  return 'The king has no safe square, and the check can be neither blocked nor captured.'
}

/**
 * One short note per move of the solution, explaining what the move does.
 * Generated from the position itself; a puzzle's own `moveNotes` replace any of these.
 */
export function buildMoveNotes(puzzle: Puzzle): string[] {
  const g = new Chess(puzzle.fen)
  const solver = g.turn()
  const moves: Move[] = []
  const replies: number[] = [] // legal moves available to the side to move after each ply
  for (const uci of puzzle.solution) {
    moves.push(g.move(toMove(uci)))
    replies.push(g.moves().length)
  }

  const replay = new Chess(puzzle.fen)
  const notes = moves.map((m, i) => {
    const mover = m.color
    const isSolver = mover === solver
    replay.move(m)
    const next = moves[i + 1]
    const opp = mover === 'w' ? 'b' : 'w'
    const piece = NAME[m.piece]

    if (replay.isCheckmate()) {
      const how = m.promotion ? `The pawn promotes with mate. ` : ''
      return `Checkmate! ${how}${mateReason(replay, opp)}`
    }

    if (isSolver) {
      const parts: string[] = []
      const king = kingSquare(replay, opp)
      const checkers = replay.inCheck() ? replay.attackers(king, mover) : []
      const sacrificed = next && next.to === m.to && next.captured && VALUE[m.piece] > VALUE[(m.captured ?? 'p') as PieceSymbol]

      if (sacrificed) {
        parts.push(
          m.captured
            ? `Sacrifice! The ${piece} takes on ${m.to}, knowing it will be captured.`
            : `Sacrifice! The ${piece} goes to ${m.to}, where it can simply be taken.`,
        )
      } else if (m.captured) {
        parts.push(`The ${piece} takes the ${NAME[m.captured]} on ${m.to}.`)
      }

      if (checkers.length >= 2) {
        const who = checkers.map((s) => `the ${NAME[replay.get(s)!.type]} on ${s}`)
        parts.push(`Double check from ${list(who)}: no block or capture can stop both, so the king must move.`)
      } else if (checkers.length === 1 && checkers[0] !== m.to) {
        parts.push(`Discovered check: moving the ${piece} unmasks the ${NAME[replay.get(checkers[0])!.type]} on ${checkers[0]}.`)
      } else if (checkers.length === 1) {
        parts.push(replies[i] === 1 ? 'Check, and there is only one legal reply.' : `Check: ${SIDE[opp]} has to answer it, so there is no time to defend anything else.`)
      }

      if (m.promotion) parts.push(`The pawn promotes to a ${NAME[m.promotion]}.`)

      // Last move of a material-winning line: say what falls
      if (i === moves.length - 1) {
        const targets: string[] = []
        for (const row of replay.board())
          for (const sq of row)
            if (sq && sq.color === opp && sq.type !== 'k' && VALUE[sq.type] >= 3 && replay.attackers(sq.square, mover).includes(m.to))
              targets.push(`the ${NAME[sq.type]} on ${sq.square}`)
        if (targets.length && checkers.length) parts.push(`Once the king moves, ${list(targets)} is next. The attack has won decisive material.`)
        else if (targets.length) parts.push(`The ${piece} now also attacks ${list(targets)}, and the material balance has swung decisively.`)
        else parts.push('The dust settles with a decisive material advantage.')
      }
      if (!parts.length) parts.push(`A quiet move with a big threat: the ${piece} on ${m.to} sets up the next blow.`)
      if (sacrificed && !checkers.length) parts.push(`Taking it is ${SIDE[opp]}'s best try.`)
      return parts.join(' ')
    }

    // Defender's move
    const forced = i > 0 && replies[i - 1] === 1
    const tookSac = moves[i - 1] && m.to === moves[i - 1].to && m.captured
    if (tookSac) {
      return forced
        ? `Forced: capturing the ${NAME[m.captured!]} is the only legal move. It pulls the ${piece} onto ${m.to}, exactly where ${SIDE[solver]} wants it.`
        : `${SIDE[mover]} takes the ${NAME[m.captured!]}, the best try, but now the ${piece} sits on ${m.to}, exactly where ${SIDE[solver]} wants it.`
    }
    if (m.piece === 'k') {
      return forced ? `Forced: the king's only square is ${m.to}.` : `The king steps to ${m.to}, its best chance of escape.`
    }
    if (forced) return `Forced: ${m.san} is the only legal move.`
    if (m.captured) return `${SIDE[mover]} grabs the ${NAME[m.captured]} on ${m.to}, but it does not save the position.`
    return `${SIDE[mover]} tries ${m.san}, the most stubborn defence.`
  })

  return notes.map((n, i) => puzzle.moveNotes?.[i] || n)
}
