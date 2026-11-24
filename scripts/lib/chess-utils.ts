import { Chess, type Move } from 'chess.js'

export function uciToMove(uci: string) {
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.length > 4 ? uci[4] : undefined,
  }
}

export function moveToUci(m: Move): string {
  return m.from + m.to + (m.promotion ?? '')
}

/** Checks first, then captures, then the rest. Keeps the mate search fast on forcing positions. */
function ordered(chess: Chess): Move[] {
  const moves = chess.moves({ verbose: true })
  const score = (m: Move) => (m.san.includes('+') || m.san.includes('#') ? 2 : 0) + (m.captured ? 1 : 0)
  return moves.sort((a, b) => score(b) - score(a))
}

/**
 * True if the side to move can force checkmate within `n` of its own moves.
 * Plain minimax over chess.js, fine for n <= 4 in forcing positions.
 */
export function hasForcedMate(chess: Chess, n: number, deadline = Infinity): boolean {
  if (n <= 0) return false
  if (Date.now() > deadline) throw new Error('timeout')
  for (const m of ordered(chess)) {
    chess.move(m)
    let wins: boolean
    if (chess.isCheckmate()) wins = true
    else if (n === 1 || chess.isGameOver()) wins = false
    else wins = defenderLoses(chess, n - 1, deadline)
    chess.undo()
    if (wins) return true
  }
  return false
}

function defenderLoses(chess: Chess, n: number, deadline: number): boolean {
  for (const reply of ordered(chess)) {
    chess.move(reply)
    const stillMates = hasForcedMate(chess, n, deadline)
    chess.undo()
    if (!stillMates) return false
  }
  return true
}

/** Other first moves that also force mate within n moves (the puzzle would then be ambiguous). */
export function alternativeMates(fen: string, solutionFirst: string, n: number, budgetMs: number): string[] | 'timeout' {
  const chess = new Chess(fen)
  const deadline = Date.now() + budgetMs
  const alts: string[] = []
  try {
    for (const m of chess.moves({ verbose: true })) {
      const uci = moveToUci(m)
      if (uci === solutionFirst) continue
      chess.move(m)
      const mates = chess.isCheckmate() || (n > 1 && !chess.isGameOver() && defenderLoses(chess, n - 1, deadline))
      chess.undo()
      if (mates) alts.push(m.san)
    }
  } catch (e) {
    if ((e as Error).message === 'timeout') return 'timeout'
    throw e
  }
  return alts
}
