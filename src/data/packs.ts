import type { GmPack, Puzzle } from '../types'
import talPuzzles from './puzzles/tal.json'

export const FREE_PER_PACK = 10

/** Set VITE_CHECKOUT_URL_TAL etc. in .env once the Lemon Squeezy products exist */
export function checkoutUrl(gm: string): string | undefined {
  const env = import.meta.env as Record<string, string | undefined>
  return env[`VITE_CHECKOUT_URL_${gm.toUpperCase()}`]
}

/** The paywall only switches on once a pack can actually be bought; until then every puzzle is open. */
export function isLocked(gm: string, index: number): boolean {
  return !!checkoutUrl(gm) && index >= FREE_PER_PACK
}

export const PACKS: GmPack[] = [
  {
    id: 'tal',
    name: 'Mikhail Tal',
    years: '1936–1992',
    tagline: 'The Magician from Riga',
    style: [
      'Sacrifices material to rip open the enemy king',
      'Prefers chaos and initiative over safe equality',
      'Creates threats faster than the defender can count them',
    ],
    themeProfile: ['sacrifice', 'attackingF2F7', 'kingsideAttack', 'exposedKing', 'doubleCheck', 'smotheredMate'],
    portrait: 'portraits/tal.jpg',
    portraitCredit: 'Photo: R. Mieremet / Anefo, Nationaal Archief, CC0 (1973). Engraving effect added.',
    available: true,
  },
  {
    id: 'capablanca',
    name: 'José Raúl Capablanca',
    years: '1888–1942',
    tagline: 'The Chess Machine',
    style: ['Simplifies into winning endgames', 'Clear, economical piece play', 'Flawless technique'],
    themeProfile: ['endgame', 'rookEndgame', 'pawnEndgame', 'quietMove', 'zugzwang'],
    available: false,
  },
  {
    id: 'morphy',
    name: 'Paul Morphy',
    years: '1837–1884',
    tagline: 'The Pride and Sorrow of Chess',
    style: ['Rapid development', 'Opens lines against an uncastled king', 'Spectacular back-rank finishes'],
    themeProfile: ['mateIn2', 'mateIn3', 'backRankMate', 'opening', 'deflection'],
    available: false,
  },
  {
    id: 'petrosian',
    name: 'Tigran Petrosian',
    years: '1929–1984',
    tagline: 'Iron Tigran',
    style: ['Prophylaxis: stops plans before they start', 'Positional exchange sacrifices', 'Near-impossible to beat'],
    themeProfile: ['defensiveMove', 'quietMove', 'intermezzo', 'equality'],
    portrait: 'portraits/petrosian.jpg',
    portraitCredit: 'Photo: Harry Pot / Anefo, Nationaal Archief, CC0 (1962). Engraving effect added.',
    available: false,
  },
]

const ALL_PUZZLES: Puzzle[] = [...(talPuzzles as Puzzle[])]

export function puzzlesFor(gm: string): Puzzle[] {
  return ALL_PUZZLES.filter((p) => p.gm === gm).sort((a, b) => a.rating - b.rating)
}

export function difficultyLabel(rating: number): string {
  if (rating < 1500) return 'Club'
  if (rating < 1800) return 'Strong club'
  return 'Expert'
}
