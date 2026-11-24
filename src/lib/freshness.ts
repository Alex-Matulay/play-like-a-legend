/**
 * GitHub Pages lets browsers cache index.html for 10 minutes, so after a deploy people can keep
 * running the previous build. Ask the server (bypassing the cache) which bundle is current and
 * reload once if it differs. Runs on load and whenever the tab becomes visible again.
 */
const SCRIPT_RE = /assets\/index-[\w-]+\.js/

function currentBundle(): string | null {
  for (const s of Array.from(document.scripts)) {
    const m = s.src.match(SCRIPT_RE)
    if (m) return m[0]
  }
  return null
}

async function check() {
  const mine = currentBundle()
  if (!mine) return // dev server: nothing to compare
  try {
    const res = await fetch(window.location.pathname, { cache: 'no-store' })
    const latest = (await res.text()).match(SCRIPT_RE)?.[0]
    if (!latest || latest === mine) return
    // Guard against a reload loop if something odd is cached further down the line
    const key = `pll.reloadedFor.${latest}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
    window.location.reload()
  } catch {
    /* offline or storage blocked: keep running the build we have */
  }
}

export function keepFresh() {
  if (!import.meta.env.PROD) return
  void check()
  document.addEventListener('visibilitychange', () => {
    // Don't yank a half-solved puzzle away; the next page load picks up the update instead
    const onPuzzle = window.location.hash.startsWith('#/p/')
    if (document.visibilityState === 'visible' && !onPuzzle) void check()
  })
}
