import { useEffect, useMemo, useRef, useState } from 'react'
import { Chess, type Square } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import type { Puzzle } from '../types'
import { saveResult } from '../lib/progress'
import { buildMoveNotes } from '../lib/moveNotes'

type Status = 'playing' | 'solved' | 'revealed'
type Badge = { square: string; kind: 'good' | 'bad'; id: number } | null
type Arrow = [Square, Square, string]

const REPLY_DELAY_MS = 450
// How long a wrong move stays on the board (with its red badge) before sliding back
const WRONG_HOLD_MS = 600
// Long enough to read each move's note while the piece moves
const REPLAY_STEP_MS = 2500
const BOARD_STYLE = { borderRadius: '6px', boxShadow: '0 10px 30px rgba(0,0,0,.25)' }
const DARK = { backgroundColor: 'var(--sq-dark)' }
const LIGHT = { backgroundColor: 'var(--sq-light)' }

function toMove(uci: string) {
  return { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }
}

interface Frame {
  fen: string
  san: string
  uci: string
}

/** Solution playback state. It drives the same board the user played on, so nothing remounts. */
function useReplay(puzzle: Puzzle) {
  const frames = useMemo<Frame[]>(() => {
    const g = new Chess(puzzle.fen)
    const out: Frame[] = [{ fen: g.fen(), san: '', uci: '' }]
    for (const uci of puzzle.solution) {
      const m = g.move(toMove(uci))
      out.push({ fen: g.fen(), san: m.san, uci })
    }
    return out
  }, [puzzle])

  const last = frames.length - 1
  const [index, setIndex] = useState(last)
  const [playing, setPlaying] = useState(false)
  // True once the user has started or stepped through the replay; keeps the last move's note on screen after it ends
  const [started, setStarted] = useState(false)

  useEffect(() => {
    if (!playing) return
    if (index >= last) {
      setPlaying(false)
      return
    }
    const t = window.setTimeout(() => setIndex((x) => x + 1), index === 0 ? 600 : REPLAY_STEP_MS)
    return () => window.clearTimeout(t)
  }, [index, playing, last])

  return {
    frames,
    index,
    playing,
    started,
    play: () => {
      setIndex(0)
      setPlaying(true)
      setStarted(true)
    },
    pause: () => setPlaying(false),
    goTo: (i: number) => {
      setPlaying(false)
      setStarted(true)
      setIndex(Math.max(0, Math.min(last, i)))
    },
    reset: () => {
      setPlaying(false)
      setStarted(false)
      setIndex(last)
    },
  }
}

interface Props {
  puzzle: Puzzle
  onNext?: () => void
}

export function PuzzlePlayer({ puzzle, onNext }: Props) {
  const game = useRef(new Chess(puzzle.fen))
  const replyTimer = useRef<number | undefined>(undefined)
  const [fen, setFen] = useState(puzzle.fen)
  const [step, setStep] = useState(0) // index into puzzle.solution of the next expected move
  const [status, setStatus] = useState<Status>('playing')
  const [mistakes, setMistakes] = useState(0)
  const [hintLevel, setHintLevel] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [lastMove, setLastMove] = useState<[string, string] | null>(null)
  const [badge, setBadge] = useState<Badge>(null)
  // While a wrong move is on show: the position with it played, and the move itself
  const [wrong, setWrong] = useState<{ fen: string; from: string; to: string } | null>(null)
  const wrongTimer = useRef<number | undefined>(undefined)
  const badgeId = useRef(0)
  const [message, setMessage] = useState('')
  // Plies played so far, and which earlier position the user is looking at (null = the live one)
  const [played, setPlayed] = useState(0)
  const [view, setView] = useState<number | null>(null)
  const replay = useReplay(puzzle)
  const notes = useMemo(() => buildMoveNotes(puzzle), [puzzle])

  const solverColor = useMemo(() => new Chess(puzzle.fen).turn(), [puzzle.fen])
  const orientation = solverColor === 'w' ? 'white' : 'black'

  // Reset when the puzzle changes
  useEffect(() => {
    game.current = new Chess(puzzle.fen)
    setFen(puzzle.fen)
    setStep(0)
    setStatus('playing')
    setMistakes(0)
    setHintLevel(0)
    setSelected(null)
    setLastMove(null)
    setBadge(null)
    setWrong(null)
    setPlayed(0)
    setView(null)
    setMessage(`${solverColor === 'w' ? 'White' : 'Black'} to move. Find the winning line.`)
    return () => {
      window.clearTimeout(replyTimer.current)
      window.clearTimeout(wrongTimer.current)
    }
  }, [puzzle.fen, solverColor])

  function showBadge(square: string, kind: 'good' | 'bad') {
    setBadge({ square, kind, id: ++badgeId.current })
  }

  function tryMove(from: string, to: string): boolean {
    if (status !== 'playing' || view !== null || wrong || game.current.turn() !== solverColor) return false
    const g = game.current
    const piece = g.get(from as Square)
    const isPromotion = piece?.type === 'p' && (to[1] === '8' || to[1] === '1')
    const uci = from + to + (isPromotion ? 'q' : '')

    const probe = new Chess(g.fen())
    try {
      probe.move(toMove(uci))
    } catch {
      return false // illegal: piece snaps back silently
    }

    const expected = puzzle.solution[step]
    const isLastMove = step === puzzle.solution.length - 1
    const correct = uci === expected || (isLastMove && probe.isCheckmate())

    if (!correct) {
      // Like Lichess: let the move land, mark it with a red badge, then slide it back
      setMistakes((m) => m + 1)
      setSelected(null)
      setWrong({ fen: probe.fen(), from, to })
      showBadge(to, 'bad')
      setMessage('Not quite. Look for something more forcing and try again.')
      wrongTimer.current = window.setTimeout(() => {
        setWrong(null)
        // Let the piece finish sliding home before the badge goes
        window.setTimeout(() => setBadge((b) => (b?.kind === 'bad' ? null : b)), 300)
      }, WRONG_HOLD_MS)
      return true
    }

    g.move(toMove(uci))
    setFen(g.fen())
    setPlayed((n) => n + 1)
    setLastMove([from, to])
    setSelected(null)
    setHintLevel(0)
    showBadge(to, 'good')

    if (isLastMove) {
      const clean = mistakes === 0 && hintLevel === 0
      // The board keeps showing the user's own final position (it may be a different mate than
      // the stored line), so the replay starts parked on the end and only moves on request.
      replay.reset()
      setStatus('solved')
      saveResult(puzzle.id, { solved: true, clean })
      setMessage(clean ? 'Solved cleanly!' : 'Solved!')
      return true
    }

    setMessage('Good move. Keep going.')
    const reply = puzzle.solution[step + 1]
    replyTimer.current = window.setTimeout(() => {
      g.move(toMove(reply))
      setFen(g.fen())
      setBadge(null)
      setPlayed((n) => n + 1)
      setLastMove([reply.slice(0, 2), reply.slice(2, 4)])
      setStep(step + 2)
    }, REPLY_DELAY_MS)
    return true
  }

  function onSquareClick(square: Square) {
    if (status !== 'playing' || view !== null || wrong) return
    const piece = game.current.get(square)
    if (selected) {
      if (selected === square) return setSelected(null)
      if (piece && piece.color === solverColor) return setSelected(square)
      tryMove(selected, square)
      setSelected(null)
      return
    }
    if (piece && piece.color === solverColor) setSelected(square)
  }

  function showHint() {
    if (status !== 'playing') return
    setHintLevel((h) => Math.min(h + 1, 2))
    if (hintLevel === 0) setMessage(puzzle.hint)
  }

  /** Step through the positions reached so far; never past the live position. */
  function stepView(delta: number) {
    const current = view ?? played
    const next = Math.max(0, Math.min(played, current + delta))
    setSelected(null)
    setView(next === played ? null : next)
  }

  function reveal() {
    window.clearTimeout(replyTimer.current)
    setView(null)
    setStatus('revealed')
    setSelected(null)
    saveResult(puzzle.id, { solved: false, clean: false })
    replay.play()
  }

  const done = status !== 'playing'
  const viewing = !done && view !== null
  const viewFrame = viewing ? replay.frames[view] : null

  // Left/right arrow keys step through moves, both while solving and in the replay
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return
      e.preventDefault()
      const delta = e.key === 'ArrowLeft' ? -1 : 1
      if (status === 'playing') stepViewRef.current(delta)
      else replay.goTo(replay.index + delta)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  const stepViewRef = useRef(stepView)
  stepViewRef.current = stepView
  // After a solve, show the user's own final position until they start the replay
  const showingReplay = done && (status === 'revealed' || replay.started)
  const frame = replay.frames[replay.index]

  const shownFen = viewFrame ? viewFrame.fen : showingReplay ? frame.fen : (wrong?.fen ?? fen)
  // Check and mate are read from whatever position is on the board right now
  const { checkSquare, mateSquare } = useMemo(() => {
    const c = new Chess(shownFen)
    if (!c.inCheck()) return { checkSquare: null, mateSquare: null }
    const k = c.board().flat().find((p) => p?.type === 'k' && p.color === c.turn())!.square
    return { checkSquare: k, mateSquare: c.isCheckmate() ? k : null }
  }, [shownFen])
  const showBadges = !showingReplay && !viewing

  // ---- Board decorations --------------------------------------------------------------------------
  const squareStyles: Record<string, React.CSSProperties> = {}
  let arrows: Arrow[] = []

  if (viewFrame) {
    if (viewFrame.uci) {
      squareStyles[viewFrame.uci.slice(0, 2)] = { background: 'var(--sq-last)' }
      squareStyles[viewFrame.uci.slice(2, 4)] = { background: 'var(--sq-last)' }
    }
  } else if (showingReplay) {
    if (frame.uci) {
      const solverMove = replay.index % 2 === 1
      arrows = [[frame.uci.slice(0, 2) as Square, frame.uci.slice(2, 4) as Square, solverMove ? 'rgba(46,160,90,.85)' : 'rgba(200,70,60,.8)']]
    }
  } else {
    const shownMove = wrong ? [wrong.from, wrong.to] : lastMove
    if (shownMove) {
      squareStyles[shownMove[0]] = { background: 'var(--sq-last)' }
      squareStyles[shownMove[1]] = { background: 'var(--sq-last)' }
    }
    if (selected) {
      squareStyles[selected] = { background: 'var(--sq-selected)' }
      for (const m of game.current.moves({ square: selected as Square, verbose: true })) {
        // A centre dot would be hidden under the enemy piece, so captures get a ring around the edge instead
        const takesPiece = !!m.captured && !m.flags.includes('e')
        squareStyles[m.to] = {
          background: takesPiece
            ? 'radial-gradient(circle closest-side, transparent 78%, var(--sq-capture) 81%)'
            : 'radial-gradient(circle, var(--sq-dot) 22%, transparent 24%)',
        }
      }
    }
    const nextMove = puzzle.solution[step]
    if (!done && hintLevel >= 1 && nextMove) squareStyles[nextMove.slice(0, 2)] = { background: 'var(--sq-hint)' }
    if (!done && hintLevel >= 2 && nextMove) {
      arrows = [[nextMove.slice(0, 2) as Square, nextMove.slice(2, 4) as Square, 'rgba(240, 180, 40, 0.85)']]
    }
  }
  if (checkSquare) {
    // Red glow behind the king that grows out from the centre (same idea as Lichess's check marker)
    squareStyles[checkSquare] = {
      ...squareStyles[checkSquare],
      backgroundImage: 'radial-gradient(circle, rgba(255,40,40,.95) 0%, rgba(231,20,20,.6) 32%, rgba(169,0,0,0) 72%)',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'center',
      backgroundSize: '100% 100%',
      animation: 'pll-check-in .35s ease-out',
    }
  }

  /** Absolute position of a square inside the board, for the overlay layer */
  function squareBox(sq: string): React.CSSProperties {
    const file = sq.charCodeAt(0) - 97
    const rank = Number(sq[1])
    const col = orientation === 'white' ? file : 7 - file
    const row = orientation === 'white' ? 8 - rank : rank - 1
    return { left: `${col * 12.5}%`, top: `${row * 12.5}%`, width: '12.5%', height: '12.5%' }
  }

  const startMoveNo = Number(puzzle.fen.split(' ')[5] ?? 1)
  const blackFirst = puzzle.fen.split(' ')[1] === 'b'

  // The note is rendered twice: beside the board on desktop, directly under it on phones (CSS picks one)
  const moveNote = (where: string) =>
    showingReplay && (
      <p className={`move-note ${where}`} aria-live={where === 'panel-note' ? 'polite' : 'off'}>
        {replay.index === 0 ? (
          <>Starting position. {solverColor === 'w' ? 'White' : 'Black'} to move.</>
        ) : (
          <>
            <strong>{replay.frames[replay.index].san}</strong> {notes[replay.index - 1]}
          </>
        )}
      </p>
    )

  return (
    <div className="player">
      <div className="board-wrap">
        {/* One board for the whole puzzle: switching to the replay must not remount it */}
        <div className="board-frame">
        <Chessboard
          id={`board-${puzzle.id}`}
          position={shownFen}
          boardOrientation={orientation}
          onPieceDrop={(from, to) => tryMove(from, to)}
          onSquareClick={onSquareClick}
          arePiecesDraggable={!done && !viewing && !wrong}
          isDraggablePiece={({ piece }) => piece[0] === solverColor}
          customSquareStyles={squareStyles}
          customArrows={arrows}
          autoPromoteToQueen
          animationDuration={showingReplay ? 350 : 250}
          customBoardStyle={BOARD_STYLE}
          customDarkSquareStyle={DARK}
          customLightSquareStyle={LIGHT}
        />
          {/* Move badges and the mate outline sit above the pieces and animate on their own */}
          <div className="board-overlay" aria-hidden="true">
            {showBadges && badge && (
              <span key={badge.id} className={`sq-badge ${badge.kind}`} style={squareBox(badge.square)}>
                <span>{badge.kind === 'good' ? '✓' : '✗'}</span>
              </span>
            )}
            {mateSquare && <span key={`mate-${shownFen}`} className="mate-ring" style={squareBox(mateSquare)} />}
          </div>
        </div>

        {moveNote('board-note')}
        {!done && played > 0 && (
          <div className="replay-controls">
            <button className="btn icon" onClick={() => stepView(-1)} disabled={(view ?? played) === 0} aria-label="Previous position">
              ◀
            </button>
            <span className={`view-label${viewing ? ' past' : ''}`}>
              {viewing ? (view === 0 ? 'Starting position' : `After ${replay.frames[view].san}`) : 'Current position'}
            </span>
            <button className="btn icon" onClick={() => stepView(1)} disabled={!viewing} aria-label="Next position">
              ▶
            </button>
          </div>
        )}
        {done && (
          <>
            <div className="replay-controls">
              <button className="btn icon" onClick={() => replay.goTo(replay.index - 1)} aria-label="Previous move">
                ◀
              </button>
              {replay.playing ? (
                <button className="btn replay-main" onClick={replay.pause}>
                  ⏸ Pause
                </button>
              ) : (
                <button className="btn primary replay-main" onClick={replay.play}>
                  ↻ Replay solution
                </button>
              )}
              <button className="btn icon" onClick={() => replay.goTo(replay.index + 1)} aria-label="Next move">
                ▶
              </button>
            </div>
            <p className="move-list">
              {replay.frames.slice(1).map((f, k) => {
                const ply = k + (blackFirst ? 1 : 0)
                const moveNo = startMoveNo + Math.floor(ply / 2)
                const prefix = ply % 2 === 0 ? `${moveNo}.` : k === 0 ? `${moveNo}...` : ''
                return (
                  <span key={k} className={showingReplay && k + 1 === replay.index ? 'current' : ''} onClick={() => replay.goTo(k + 1)}>
                    {prefix}
                    {f.san}{' '}
                  </span>
                )
              })}
            </p>
          </>
        )}
      </div>

      <div className="player-panel">
        {done ? (
          <>
            {moveNote('panel-note')}
            <p className={`status ${status}`}>{status === 'solved' ? message : 'Solution'}</p>
            <p className="explanation">{puzzle.explanation}</p>
            {puzzle.gameContinuation && (
              <p className="explanation">
                <strong>In the game:</strong> {puzzle.gameContinuation}
              </p>
            )}
            {onNext && (
              <button className="btn primary" onClick={onNext}>
                Next puzzle →
              </button>
            )}
          </>
        ) : (
          <>
            <p className="status playing">{message}</p>
            <div className="actions">
              <button className="btn" onClick={showHint} disabled={hintLevel >= 2}>
                {hintLevel === 0 ? 'Hint' : hintLevel === 1 ? 'Show the move' : 'Hint used'}
              </button>
              <button className="btn ghost" onClick={reveal}>
                Show solution
              </button>
            </div>
            {mistakes > 0 && <p className="muted">Wrong tries: {mistakes}</p>}
          </>
        )}
      </div>
    </div>
  )
}
