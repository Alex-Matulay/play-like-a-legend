// Per-device progress for the MVP. Moves to user accounts in V1.
export interface PuzzleResult {
  solved: boolean
  /** Solved without a wrong move or a hint */
  clean: boolean
}

const KEY = 'pll.progress.v1'

function read(): Record<string, PuzzleResult> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}

export function getResult(id: string): PuzzleResult | undefined {
  return read()[id]
}

export function saveResult(id: string, result: PuzzleResult) {
  const all = read()
  const prev = all[id]
  // Never downgrade a clean solve
  all[id] = prev?.clean ? prev : result
  try {
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    /* storage unavailable: progress just isn't kept */
  }
}
