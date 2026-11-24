/**
 * Development-only sample sheet for the Work thumbnails. Served by the dev
 * server at /work-thumbs.html; not part of the production build (Vite only
 * builds index.html). Captions are drafts taken from existing sources, for
 * judging the drawings in context, not final copy.
 */
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../styles/fonts.css'
import '../styles/tokens.css'
import '../styles/base.css'
import { WorkThumb } from '../components/sections/work/thumbs/WorkThumb'
import type { ThumbKind } from '../components/sections/work/thumbs/palette'
import './work-thumbs-sheet.css'

interface Sample {
  kind: ThumbKind
  title: string
  line: string
  status: string
  area: string
}

/* Draft captions. Sources: the old portfolio, the vault's Evidence Bank, each app's README, content.ts. */
const SAMPLES: Sample[] = [
  {
    kind: 'keys',
    title: 'Interactive chord builder',
    line: 'A concept-heavy topic turned into something learners can inspect and play.',
    status: 'Live',
    area: 'Notation and interactive learning',
  },
  {
    kind: 'guide',
    title: 'PM frameworks guidebook',
    line: 'A hands-on field guide to product frameworks, for people who learn by doing.',
    status: 'Live',
    area: 'Product discovery and engagement',
  },
  {
    kind: 'ledger',
    title: 'Licensing engine',
    line: 'Rights clearance for a song catalogue, with the business rules kept as data.',
    status: 'Internal, described only',
    area: 'Music rights and licensing',
  },
  {
    kind: 'plan',
    title: 'Apartment studio',
    line: 'Furnishing a new home at exact scale, in a 2D plan and a 3D walk-through.',
    status: 'Personal',
    area: 'Off the map',
  },
  {
    kind: 'network',
    title: 'Rights Intelligence',
    line: 'Tooling for work identification, ownership and contract coverage.',
    status: 'In progress',
    area: 'Off the map',
  },
]

function Tile({ sample, n, play }: { sample: Sample; n: number; play: boolean }) {
  return (
    <li className="wtile" tabIndex={0} data-play={play ? '' : undefined}>
      <WorkThumb kind={sample.kind} />
      <div className="sheet__caption">
        <span className="sheet__n">{String(n).padStart(2, '0')}</span>
        <h3 className="sheet__title">{sample.title}</h3>
        <p className="sheet__line">{sample.line}</p>
        <p className="sheet__meta">
          <span>{sample.status}</span>
          <span>{sample.area}</span>
        </p>
      </div>
    </li>
  )
}

function Sheet() {
  const [play, setPlay] = useState(0)
  const replay = () => {
    setPlay(0)
    requestAnimationFrame(() => requestAnimationFrame(() => setPlay((p) => p + 1)))
  }
  return (
    <main className="sheet">
      <header className="sheet__head">
        <p className="sheet__eyebrow">Development preview, not on the site</p>
        <h1>Work thumbnails</h1>
        <p>
          Five drawings in the room's colours. Hover or focus one to see its motion, or play them all. The captions are
          drafts from existing sources, here only to judge the drawings in context.
        </p>
        <button type="button" className="text-link sheet__play" onClick={replay}>
          Play all motions
        </button>
      </header>

      <section aria-labelledby="desk-h">
        <h2 id="desk-h">In the panel, desktop width</h2>
        <ul className="sheet__grid" role="list">
          {SAMPLES.map((s, i) => (
            <Tile key={s.kind} sample={s} n={i + 1} play={play > 0} />
          ))}
        </ul>
      </section>

      <section aria-labelledby="phone-h">
        <h2 id="phone-h">On a phone, 390 px</h2>
        <div className="sheet__phone">
          <ul className="sheet__rows" role="list">
            {SAMPLES.map((s, i) => (
              <Tile key={s.kind} sample={s} n={i + 1} play={play > 0} />
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="large-h">
        <h2 id="large-h">Large, for detail</h2>
        <div className="sheet__large">
          {SAMPLES.map((s) => (
            <div key={s.kind} className="wtile" tabIndex={0} data-play={play > 0 ? '' : undefined}>
              <WorkThumb kind={s.kind} />
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}

const root = document.getElementById('root')
if (root)
  createRoot(root).render(
    <StrictMode>
      <Sheet />
    </StrictMode>,
  )
