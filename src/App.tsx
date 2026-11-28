import { PACKS, FREE_PER_PACK, checkoutUrl, difficultyLabel, isLocked, puzzlesFor } from './data/packs'
import { PuzzlePlayer } from './components/PuzzlePlayer'
import { BIOS } from './data/bios'
import { getResult } from './lib/progress'
import { href, useRoute } from './lib/router'
import type { GameSource, GmPack } from './types'

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
        {route.name === 'about' && <AboutPage gm={route.gm} />}
        {route.name === 'puzzle' && <PuzzlePage id={route.id} />}
      </main>
      <footer className="site-footer">
        <p>
          Puzzles are original compositions or come from the{' '}
          <a href="https://database.lichess.org/#puzzles">Lichess puzzle database</a> (CC0), with thanks to Lichess.
          Not affiliated with or endorsed by any player or estate.
        </p>
        <p>
          Portraits:{' '}
          {PACKS.filter((p) => p.portraitCredit)
            .map((p) => `${p.name.split(' ').pop()}: ${p.portraitCredit}`)
            .join(' · ')}
        </p>
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

/** Round portrait, falling back to initials when a pack has no picture yet */
function Crest({ pack, large }: { pack: GmPack; large?: boolean }) {
  const cls = `crest${large ? ' large' : ''}`
  if (pack.portrait) {
    return <img className={`${cls} portrait`} src={pack.portrait} alt={`Portrait of ${pack.name}`} title={pack.portraitCredit} />
  }
  return <div className={cls}>{initials(pack.name)}</div>
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
  const bio = BIOS[pack.id]

  if (pack.available) {
    return (
      <a className="pack-card" href={href.pack(pack.id)}>
        <Crest pack={pack} />
        <div>
          <h2>{pack.name}</h2>
          <p className="muted">
            {pack.tagline} · {pack.years}
          </p>
          <p className="pack-meta">{count} puzzles</p>
        </div>
      </a>
    )
  }

  // Not playable yet: the card is dimmed, but the link to the life story stays at full strength
  return (
    <div className="pack-card disabled">
      <div className="dim">
        <Crest pack={pack} />
      </div>
      <div>
        <div className="dim">
          <h2>{pack.name}</h2>
          <p className="muted">
            {pack.tagline} · {pack.years}
          </p>
          <p className="pack-meta">Coming soon</p>
        </div>
        {bio && (
          <a className="more-link" href={href.about(pack.id)}>
            About {bio.firstName} →
          </a>
        )}
      </div>
    </div>
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
        <Crest pack={pack} large />
        <div>
          <p className="eyebrow">Think like</p>
          <h1>{pack.name}</h1>
          {BIOS[pack.id] && (
            <a className="more-link" href={href.about(pack.id)}>
              More about {BIOS[pack.id]!.firstName} →
            </a>
          )}
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

      <ol className="puzzle-grid">
        {puzzles.map((p, i) => {
          const result = getResult(p.id)
          const locked = isLocked(gm, i)
          const level = difficultyLabel(p.rating)
          const realGame = p.type === 'real' && p.source ? `${p.source.white} vs ${p.source.black}, ${p.source.year}` : ''
          const state = locked ? ' locked' : result?.solved ? ' solved' : ''
          return (
            <li key={p.id}>
              <a
                className={`puzzle-tile tier-${level.split(' ')[0].toLowerCase()}${state}`}
                href={locked ? undefined : href.puzzle(p.id)}
                title={realGame || `${level} · ${p.rating}`}
                aria-label={`Puzzle ${i + 1}, ${level}, rating ${p.rating}${result?.solved ? ', solved' : ''}${locked ? ', locked' : ''}`}
              >
                <span className="tile-num">{i + 1}</span>
                <span className="tile-meta">{p.rating}</span>
                {realGame && <span className="tile-game">{p.source!.year}</span>}
                <span className="tile-status">{locked ? '🔒' : result?.solved ? (result.clean ? '★' : '✓') : ''}</span>
              </a>
            </li>
          )
        })}
      </ol>
      <p className="tier-legend muted small">
        <span className="dot tier-club" /> Club <span className="dot tier-strong" /> Strong club{' '}
        <span className="dot tier-expert" /> Expert · ★ solved cleanly · ✓ solved
      </p>

      {checkout && puzzles.length > FREE_PER_PACK && (
        <div className="unlock">
          <p>
            The first {FREE_PER_PACK} puzzles are free. Unlock all {puzzles.length} to keep going.
          </p>
          <a className="btn primary" href={checkout}>
            Unlock the {pack.name.split(' ').pop()} pack
          </a>
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
  if (!pack || index < 0 || isLocked(gm, index)) return <NotFound />
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
      {puzzle.type === 'real' && puzzle.source ? (
        <RealGameBanner source={puzzle.source} gmName={pack.name} />
      ) : (
        <p className="source-line">In the style of {pack.name}</p>
      )}
      <PuzzlePlayer
        key={puzzle.id}
        puzzle={puzzle}
        onNext={() => (window.location.hash = next && !isLocked(gm, index + 1) ? href.puzzle(next.id) : href.pack(gm))}
      />
    </>
  )
}

/** Shown above the board when the position is taken from one of the GM's own games */
function RealGameBanner({ source, gmName }: { source: GameSource; gmName: string }) {
  const surname = gmName.split(' ').pop()!.toLowerCase()
  const gmIsWhite = source.white.toLowerCase().includes(surname)
  const gmIsBlack = source.black.toLowerCase().includes(surname)
  const opponent = gmIsWhite ? source.black : gmIsBlack ? source.white : null
  const where = [source.event, source.year || null].filter(Boolean).join(', ')

  return (
    <div className="real-game">
      <span className="real-game-tag">Real game</span>
      <p>
        This position comes from an actual game:{' '}
        <strong>
          {source.white} vs {source.black}
        </strong>
        {where && <>, {where}</>}.
        {opponent && (
          <>
            {' '}
            {gmName.split(' ').pop()} had the {gmIsWhite ? 'white' : 'black'} pieces against {opponent}.
          </>
        )}
      </p>
    </div>
  )
}

function AboutPage({ gm }: { gm: string }) {
  const pack = PACKS.find((p) => p.id === gm)
  const bio = BIOS[gm as GmPack['id']]
  if (!pack || !bio) return <NotFound />
  const count = puzzlesFor(gm).length

  return (
    <article className="about">
      <nav className="crumbs">
        <a href={pack.available ? href.pack(gm) : href.home()}>← {pack.available ? `${pack.name} puzzles` : 'All legends'}</a>
      </nav>
      <header className="gm-intro">
        <Crest pack={pack} large />
        <div>
          <p className="eyebrow">{pack.tagline}</p>
          <h1>{pack.name}</h1>
          <p className="muted">{bio.title}</p>
        </div>
      </header>

      <dl className="facts">
        <div>
          <dt>Born</dt>
          <dd>{bio.born}</dd>
        </div>
        <div>
          <dt>Died</dt>
          <dd>{bio.died}</dd>
        </div>
      </dl>

      <p className="lede">{bio.intro}</p>

      {bio.sections.map((sec) => (
        <section key={sec.heading}>
          <h2>{sec.heading}</h2>
          {sec.body.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </section>
      ))}

      <div className="about-cta">
        {pack.available ? (
          <a className="btn primary" href={href.pack(gm)}>
            Solve {count} puzzles in {bio.firstName}'s style →
          </a>
        ) : (
          <p className="muted">The {pack.name.split(' ').pop()} puzzle pack is coming soon.</p>
        )}
      </div>
    </article>
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
