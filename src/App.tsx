import { PACKS, FREE_PER_PACK, checkoutUrl, difficultyLabel, puzzlesFor } from './data/packs'
import { PuzzlePlayer } from './components/PuzzlePlayer'
import { getResult } from './lib/progress'
import { href, useRoute } from './lib/router'
import type { GmPack } from './types'

export default function App() {
  const route = useRoute()
  return (
    <>
      <header className="site-header">
        <a href={href.home()} className="brand">
          <span className="brand-mark">♞</span> Play Like a Legend
        </a>
      </header>
      <main>
        {route.name === 'home' && <Home />}
        {route.name === 'pack' && <PackPage gm={route.gm} />}
        {route.name === 'puzzle' && <PuzzlePage id={route.id} />}
      </main>
      <footer className="site-footer">
        Puzzles are original compositions or positions from public game records. Not affiliated with or endorsed by
        any player or estate.
      </footer>
    </>
  )
}

function initials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
}

function Home() {
  return (
    <>
      <section className="hero">
        <h1>Solve puzzles the way the legends played.</h1>
        <p>
          Every pack is built around one grandmaster's style. Sacrifice like Tal, grind like Capablanca, attack like
          Morphy. Move the pieces, then watch the full solution play out.
        </p>
        <a className="btn primary" href={href.pack('tal')}>
          Start with Tal →
        </a>
      </section>
      <section className="pack-grid">
        {PACKS.map((p) => (
          <PackCard key={p.id} pack={p} />
        ))}
      </section>
    </>
  )
}

function PackCard({ pack }: { pack: GmPack }) {
  const count = puzzlesFor(pack.id).length
  const inner = (
    <>
      <div className="crest">{initials(pack.name)}</div>
      <div>
        <h2>{pack.name}</h2>
        <p className="muted">
          {pack.tagline} · {pack.years}
        </p>
        <p className="pack-meta">{pack.available ? `${count} puzzles` : 'Coming soon'}</p>
      </div>
    </>
  )
  return pack.available ? (
    <a className="pack-card" href={href.pack(pack.id)}>
      {inner}
    </a>
  ) : (
    <div className="pack-card disabled">{inner}</div>
  )
}

function PackPage({ gm }: { gm: string }) {
  const pack = PACKS.find((p) => p.id === gm)
  if (!pack || !pack.available) return <NotFound />
  const puzzles = puzzlesFor(gm)
  const solved = puzzles.filter((p) => getResult(p.id)?.solved).length
  const checkout = checkoutUrl(gm)

  return (
    <>
      <section className="gm-intro">
        <div className="crest large">{initials(pack.name)}</div>
        <div>
          <p className="eyebrow">Think like</p>
          <h1>{pack.name}</h1>
          <p className="muted">
            {pack.tagline} · {pack.years}
          </p>
          <ul className="style-list">
            {pack.style.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <p className="pack-meta">
            {solved} of {puzzles.length} solved
          </p>
        </div>
      </section>

      <ol className="puzzle-list">
        {puzzles.map((p, i) => {
          const result = getResult(p.id)
          const locked = i >= FREE_PER_PACK
          return (
            <li key={p.id}>
              <a className={`puzzle-row${locked ? ' locked' : ''}`} href={locked ? undefined : href.puzzle(p.id)}>
                <span className="num">{i + 1}</span>
                <span className="row-main">
                  <span>{p.type === 'real' && p.source ? `${p.source.white} vs ${p.source.black}, ${p.source.year}` : `In the style of ${pack.name.split(' ').pop()}`}</span>
                  <span className="muted small">
                    {difficultyLabel(p.rating)} · {p.rating}
                  </span>
                </span>
                <span className="row-status">{locked ? '🔒' : result?.solved ? (result.clean ? '★' : '✓') : ''}</span>
              </a>
            </li>
          )
        })}
      </ol>

      {puzzles.length > FREE_PER_PACK && (
        <div className="unlock">
          <p>
            The first {FREE_PER_PACK} puzzles are free. Unlock all {puzzles.length} to keep going.
          </p>
          {checkout ? (
            <a className="btn primary" href={checkout}>
              Unlock the {pack.name.split(' ').pop()} pack
            </a>
          ) : (
            <button className="btn" disabled>
              Full pack coming soon
            </button>
          )}
        </div>
      )}
    </>
  )
}

function PuzzlePage({ id }: { id: string }) {
  const gm = id.split('-')[0]
  const pack = PACKS.find((p) => p.id === gm)
  const puzzles = puzzlesFor(gm)
  const index = puzzles.findIndex((p) => p.id === id)
  if (!pack || index < 0 || index >= FREE_PER_PACK) return <NotFound />
  const puzzle = puzzles[index]
  const next = puzzles[index + 1]

  return (
    <>
      <nav className="crumbs">
        <a href={href.pack(gm)}>← {pack.name}</a>
        <span className="muted">
          Puzzle {index + 1} of {puzzles.length} · {difficultyLabel(puzzle.rating)} · {puzzle.rating}
        </span>
      </nav>
      <p className="source-line">
        {puzzle.type === 'real' && puzzle.source
          ? `${puzzle.source.white} vs ${puzzle.source.black}, ${puzzle.source.event} ${puzzle.source.year}`
          : `In the style of ${pack.name}`}
      </p>
      <PuzzlePlayer
        key={puzzle.id}
        puzzle={puzzle}
        onNext={() => (window.location.hash = next && index + 1 < FREE_PER_PACK ? href.puzzle(next.id) : href.pack(gm))}
      />
    </>
  )
}

function NotFound() {
  return (
    <section className="hero">
      <h1>Nothing here.</h1>
      <a className="btn" href={href.home()}>
        Back to all packs
      </a>
    </section>
  )
}
