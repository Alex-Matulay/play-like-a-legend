import { useEffect, useState } from 'react'

/**
 * Tiny hash router. Routes:
 *   #/                 home
 *   #/gm/:gm           pack page
 *   #/p/:puzzleId      puzzle (also the target of QR codes in the PDF books)
 */
export type Route = { name: 'home' } | { name: 'pack'; gm: string } | { name: 'puzzle'; id: string }

function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  if (parts[0] === 'gm' && parts[1]) return { name: 'pack', gm: parts[1] }
  if (parts[0] === 'p' && parts[1]) return { name: 'puzzle', id: parts[1] }
  return { name: 'home' }
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(window.location.hash))
  useEffect(() => {
    const onChange = () => {
      setRoute(parse(window.location.hash))
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

export const href = {
  home: () => '#/',
  pack: (gm: string) => `#/gm/${gm}`,
  puzzle: (id: string) => `#/p/${id}`,
}
