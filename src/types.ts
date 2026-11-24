export type GmId = 'tal' | 'capablanca' | 'morphy' | 'petrosian' | 'alekhine' | 'fischer'

export interface GameSource {
  white: string
  black: string
  event: string
  year: number
}

export interface Puzzle {
  id: string
  gm: GmId
  /** "real" = a moment from the GM's own game, "style" = a position matching the GM's style */
  type: 'real' | 'style'
  source: GameSource | null
  /** Position with the solver to move */
  fen: string
  /** UCI moves: solver, reply, solver, reply, ... always ending on a solver move */
  solution: string[]
  themes: string[]
  rating: number
  hint: string
  explanation: string
  /** Optional hand-written note per solution move, shown during the replay (overrides the generated one) */
  moveNotes?: string[]
  /** Source puzzle id when taken from the Lichess database (CC0) */
  lichessId?: string
  /** For real-game puzzles: what was actually played, in SAN */
  gameContinuation?: string
}

export interface GmPack {
  id: GmId
  name: string
  years: string
  tagline: string
  style: string[]
  /** Lichess puzzle themes used to find style-matched positions */
  themeProfile: string[]
  /** Path under public/, shown in the round crest */
  portrait?: string
  portraitCredit?: string
  available: boolean
}
