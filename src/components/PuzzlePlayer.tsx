import { useEffect, useMemo, useRef, useState } from 'react'
import { Chess, type Square } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import type { Puzzle } from '../types'
import { saveResult } from '../lib/progress'

type Status = 'playing' | 'solved' | 'revealed'
type Flash = { square: string; kind: 'good' | 'bad' } | null

const REPLY_DELAY_MS = 450
const REPLAY_STEP_MS = 1100

function toMove(uci: string) {
  return { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }
}

interface Props {
  puzzle: Puzzle
  onNext?: () => void
}

export function PuzzlePlayer({ puzzle, onNext }: Props) {
  const game = useRef(new Chess(puzzle.fen))
  const [fen, setFen] = useState(puzzle.fen)
  const [step, setStep] = useState(0) // index into puzzle.solution of the next expected move
  const [status, setStatus] = useState<Status>('playing')
  const [mistakes, setMistakes] = useState(0)
  const [hintLevel, setHintLevel] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [lastMove, setLastMove] = useState<[string, string] | null>(null)
  const [flash, setFlash] = useState<Flash>(null)
  const [message, setMessage] = useState('')

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
      setStatus('solved')
      const clean = mistakes === 0 && hintLevel === 0
      saveResult(puzzle.id, { solved: true, clean })
      setMessage(clean ? 'Solved cleanly. Brilliant!' : 'Solved!')
      return true
    }

    setMessage('Good move. Keep going.')
    const reply = puzzle.solution[step + 1]
    window.setTimeout(() => {
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
    setStatus('revealed')
    saveResult(puzzle.id, { solved: false, clean: false })
  }

  // Square highlights: last move, selection, hint, flash
  const squareStyles: Record<string, React.CSSProperties> = {}
  if (lastMove) {
    squareStyles[lastMove[0]] = { background: 'var(--sq-last)' }
    squareStyles[lastMove[1]] = { background: 'var(--sq-last)' }
  }
  if (selected) {
    squareStyles[selected] = { background: 'var(--sq-selected)' }
    for (const m of game.current.moves({ square: selected as Square, verbose: true })) {
      squareStyles[m.to] = {
        background: 'radial-gradient(circle, var(--sq-dot) 22%, transparent 24%)',
      }
    }
  }
  const nextMove = puzzle.solution[step]
  if (status === 'playing' && hintLevel >= 1 && nextMove) {
    squareStyles[nextMove.slice(0, 2)] = { background: 'var(--sq-hint)' }
  }
  if (flash) squareStyles[flash.square] = { background: flash.kind === 'good' ? 'var(--sq-good)' : 'var(--sq-bad)' }

  const arrows: [Square, Square, string][] =
    status === 'playing' && hintLevel >= 2 && nextMove
      ? [[nextMove.slice(0, 2) as Square, nextMove.slice(2, 4) as Square, 'rgba(240, 180, 40, 0.85)']]
      : []

  if (status !== 'playing') {
    return (
      <div className="player">
        <SolutionReplay puzzle={puzzle} orientation={orientation} />
        <div className="player-panel">
          <p className={`status ${status}`}>
            {status === 'solved' ? (mistakes === 0 && hintLevel === 0 ? 'Solved cleanly!' : 'Solved!') : 'Solution'}
          </p>
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
        </div>
      </div>
    )
  }

  return (
    <div className="player">
      <div className="board-wrap">
        <Chessboard
          id={`board-${puzzle.id}`}
          position={fen}
          boardOrientation={orientation}
          onPieceDrop={(from, to) => tryMove(from, to)}
          onSquareClick={onSquareClick}
          isDraggablePiece={({ piece }) => piece[0] === solverColor}
          customSquareStyles={squareStyles}
          customArrows={arrows}
          autoPromoteToQueen
          animationDuration={250}
          customBoardStyle={{ borderRadius: '6px', boxShadow: '0 10px 30px rgba(0,0,0,.25)' }}
          customDarkSquareStyle={{ backgroundColor: 'var(--sq-dark)' }}
          customLightSquareStyle={{ backgroundColor: 'var(--sq-light)' }}
        />
      </div>
      <div className="player-panel">
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
      </div>
    </div>
  )
}

/** Animated walk through the full solution with arrows: the live version of the GIF solution. */
function SolutionReplay({ puzzle, orientation }: { puzzle: Puzzle; orientation: 'white' | 'black' }) {
  const frames = useMemo(() => {
    const g = new Chess(puzzle.fen)
    const out = [{ fen: g.fen(), san: '', uci: '' }]
    for (const uci of puzzle.solution) {
      const m = g.move(toMove(uci))
      out.push({ fen: g.fen(), san: m.san, uci })
    }
    return out
  }, [puzzle])

  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(true)

  useEffect(() => {
    if (!playing) return
    if (i >= frames.length - 1) {
      setPlaying(false)
      return
    }
    const t = window.setTimeout(() => setI((x) => x + 1), i === 0 ? 600 : REPLAY_STEP_MS)
    return () => window.clearTimeout(t)
  }, [i, playing, frames.length])

  const frame = frames[i]
  const arrows: [Square, Square, string][] = frame.uci
    ? [[frame.uci.slice(0, 2) as Square, frame.uci.slice(2, 4) as Square, i % 2 === 1 ? 'rgba(46,160,90,.85)' : 'rgba(200,70,60,.8)']]
    : []

  const startMoveNo = Number(puzzle.fen.split(' ')[5] ?? 1)
  const blackFirst = puzzle.fen.split(' ')[1] === 'b'

  return (
    <div className="board-wrap">
      <Chessboard
        id={`replay-${puzzle.id}`}
        position={frame.fen}
        boardOrientation={orientation}
        arePiecesDraggable={false}
        customArrows={arrows}
        animationDuration={350}
        customBoardStyle={{ borderRadius: '6px', boxShadow: '0 10px 30px rgba(0,0,0,.25)' }}
        customDarkSquareStyle={{ backgroundColor: 'var(--sq-dark)' }}
        customLightSquareStyle={{ backgroundColor: 'var(--sq-light)' }}
      />
      <div className="replay-controls">
        <button className="btn icon" onClick={() => { setPlaying(false); setI(0) }} aria-label="Start">⏮</button>
        <button className="btn icon" onClick={() => { setPlaying(false); setI((x) => Math.max(0, x - 1)) }} aria-label="Back">◀</button>
        <button
          className="btn icon"
          onClick={() => {
            if (i >= frames.length - 1) setI(0)
            setPlaying((p) => !p)
          }}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? '⏸' : '▶︎'}
        </button>
        <button className="btn icon" onClick={() => { setPlaying(false); setI((x) => Math.min(frames.length - 1, x + 1)) }} aria-label="Forward">▶</button>
        <button className="btn icon" onClick={() => { setPlaying(false); setI(frames.length - 1) }} aria-label="End">⏭</button>
      </div>
      <p className="move-list">
        {frames.slice(1).map((f, k) => {
          const ply = k + (blackFirst ? 1 : 0)
          const moveNo = startMoveNo + Math.floor(ply / 2)
          const prefix = ply % 2 === 0 ? `${moveNo}.` : k === 0 ? `${moveNo}...` : ''
          return (
            <span key={k} className={k + 1 === i ? 'current' : ''} onClick={() => { setPlaying(false); setI(k + 1) }}>
              {prefix}
              {f.san}{' '}
            </span>
          )
        })}
      </p>
    </div>
  )
}
