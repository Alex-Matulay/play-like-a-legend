import { useEffect, useMemo, useRef, useState } from 'react'
import { Chess, type Square } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import type { Puzzle } from '../types'
import { saveResult } from '../lib/progress'

type Status = 'playing' | 'solved' | 'revealed'
type Flash = { square: string; kind: 'good' | 'bad' } | null
type Arrow = [Square, Square, string]

const REPLY_DELAY_MS = 450
const REPLAY_STEP_MS = 1100
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
    play: () => {
      setIndex(0)
      setPlaying(true)
    },
    pause: () => setPlaying(false),
    goTo: (i: number) => {
      setPlaying(false)
      setIndex(Math.max(0, Math.min(last, i)))
    },
    reset: () => {
      setPlaying(false)
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
  const [flash, setFlash] = useState<Flash>(null)
  const [message, setMessage] = useState('')
  const replay = useReplay(puzzle)

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
    setFlash(null)
    setMessage(`${solverColor === 'w' ? 'White' : 'Black'} to move. Find the winning line.`)
    return () => window.clearTimeout(replyTimer.current)
  }, [puzzle.fen, solverColor])

  function flashSquare(square: string, kind: 'good' | 'bad') {
    setFlash({ square, kind })
    window.setTimeout(() => setFlash(null), 600)
  }

  function tryMove(from: string, to: string): boolean {
    if (status !== 'playing' || game.current.turn() !== solverColor) return false
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
      setMistakes((m) => m + 1)
      flashSquare(to, 'bad')
      setMessage('Not quite. Look for something more forcing and try again.')
      return false
    }

    g.move(toMove(uci))
    setFen(g.fen())
    setLastMove([from, to])
    setSelected(null)
    setHintLevel(0)
    flashSquare(to, 'good')

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
      setLastMove([reply.slice(0, 2), reply.slice(2, 4)])
      setStep(step + 2)
    }, REPLY_DELAY_MS)
    return true
  }

  function onSquareClick(square: Square) {
    if (status !== 'playing') return
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

  function reveal() {
    window.clearTimeout(replyTimer.current)
    setStatus('revealed')
    setSelected(null)
    saveResult(puzzle.id, { solved: false, clean: false })
    replay.play()
  }

  const done = status !== 'playing'
  // After a solve, show the user's own final position until they start the replay
  const showingReplay = done && (status === 'revealed' || replay.playing || replay.index !== replay.frames.length - 1)
  const frame = replay.frames[replay.index]

  // ---- Board decorations --------------------------------------------------------------------------
  const squareStyles: Record<string, React.CSSProperties> = {}
  let arrows: Arrow[] = []

  if (showingReplay) {
    if (frame.uci) {
      const solverMove = replay.index % 2 === 1
      arrows = [[frame.uci.slice(0, 2) as Square, frame.uci.slice(2, 4) as Square, solverMove ? 'rgba(46,160,90,.85)' : 'rgba(200,70,60,.8)']]
    }
  } else {
    if (lastMove) {
      squareStyles[lastMove[0]] = { background: 'var(--sq-last)' }
      squareStyles[lastMove[1]] = { background: 'var(--sq-last)' }
    }
    if (selected) {
      squareStyles[selected] = { background: 'var(--sq-selected)' }
      for (const m of game.current.moves({ square: selected as Square, verbose: true })) {
        squareStyles[m.to] = { background: 'radial-gradient(circle, var(--sq-dot) 22%, transparent 24%)' }
      }
    }
    const nextMove = puzzle.solution[step]
    if (!done && hintLevel >= 1 && nextMove) squareStyles[nextMove.slice(0, 2)] = { background: 'var(--sq-hint)' }
    if (!done && hintLevel >= 2 && nextMove) {
      arrows = [[nextMove.slice(0, 2) as Square, nextMove.slice(2, 4) as Square, 'rgba(240, 180, 40, 0.85)']]
    }
    if (flash) squareStyles[flash.square] = { background: flash.kind === 'good' ? 'var(--sq-good)' : 'var(--sq-bad)' }
  }

  const startMoveNo = Number(puzzle.fen.split(' ')[5] ?? 1)
  const blackFirst = puzzle.fen.split(' ')[1] === 'b'

  return (
    <div className="player">
      <div className="board-wrap">
        {/* One board for the whole puzzle: switching to the replay must not remount it */}
        <Chessboard
          id={`board-${puzzle.id}`}
          position={showingReplay ? frame.fen : fen}
          boardOrientation={orientation}
          onPieceDrop={(from, to) => tryMove(from, to)}
          onSquareClick={onSquareClick}
          arePiecesDraggable={!done}
          isDraggablePiece={({ piece }) => piece[0] === solverColor}
          customSquareStyles={squareStyles}
          customArrows={arrows}
          autoPromoteToQueen
          animationDuration={showingReplay ? 350 : 250}
          customBoardStyle={BOARD_STYLE}
          customDarkSquareStyle={DARK}
          customLightSquareStyle={LIGHT}
        />

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
