/**
 * Development only: sample records so the crate can be seen and tested before
 * any Spotify links are added. None of this is Susana's music, and it is loaded
 * lazily behind import.meta.env.DEV, so it never reaches the live site.
 */
import { content } from '../../../content/content'
import { RecordCrate } from './RecordCrate'
import type { CrateRecord } from './types'

const C = {
  walnut: 'oklch(0.42 0.07 50)',
  terracotta: 'oklch(0.55 0.13 40)',
  rose: 'oklch(0.72 0.065 28)',
  teal: 'oklch(0.36 0.045 185)',
  slate: 'oklch(0.46 0.05 262)',
  ochre: 'oklch(0.76 0.095 78)',
  card: 'oklch(0.945 0.006 85)',
  ink: 'oklch(0.205 0.01 45)',
  spot: 'oklch(0.66 0.165 38)',
  sage: 'oklch(0.6 0.04 150)',
  plum: 'oklch(0.36 0.05 340)',
  sand: 'oklch(0.86 0.03 80)',
}

type Motif = 'window' | 'keys' | 'stripes' | 'arcs' | 'type' | 'split' | 'grid' | 'sun' | 'moon'

interface Sample {
  t: string
  a: string
  k: 'Album' | 'Playlist'
  y?: number
  n: string
  s: [string, string]
  art: [Motif, string, string, string]
}

const SAMPLES: Sample[] = [
  {
    t: 'Night Bus Études',
    a: 'Placeholder Trio',
    k: 'Album',
    y: 2019,
    n: '9 tracks, 41 min',
    s: ['04', 'Sample track title'],
    art: ['window', C.walnut, C.ochre, C.card],
  },
  {
    t: 'Sunday piano',
    a: 'A sample playlist',
    k: 'Playlist',
    n: '38 songs, 2 h 10 min',
    s: ['01', 'Sample opening song'],
    art: ['keys', C.card, C.ink, C.spot],
  },
  {
    t: 'Rain on Glass',
    a: 'The Sample Quartet',
    k: 'Album',
    y: 2008,
    n: '11 tracks, 47 min',
    s: ['07', 'Sample track title'],
    art: ['stripes', C.teal, C.card, C.ochre],
  },
  {
    t: 'Low Lamp Sessions',
    a: 'Example Ensemble',
    k: 'Album',
    y: 1996,
    n: '8 tracks, 52 min',
    s: ['02', 'Sample track title'],
    art: ['arcs', C.slate, C.sand, C.spot],
  },
  {
    t: 'Fourteen Small Rooms',
    a: 'Lorem Collective',
    k: 'Album',
    y: 2021,
    n: '14 tracks, 39 min',
    s: ['11', 'Sample track title'],
    art: ['type', C.ink, C.card, C.spot],
  },
  {
    t: 'Orchid Hours',
    a: 'Demo Orchestra',
    k: 'Album',
    y: 1974,
    n: '6 tracks, 44 min',
    s: ['03', 'Sample track title'],
    art: ['split', C.rose, C.terracotta, C.card],
  },
  {
    t: 'Practice room',
    a: 'A sample playlist',
    k: 'Playlist',
    n: '52 songs, 3 h 4 min',
    s: ['01', 'Sample opening song'],
    art: ['grid', C.sand, C.ink, C.spot],
  },
  {
    t: 'Slow Ochre',
    a: 'Ipsum Duo',
    k: 'Album',
    y: 2013,
    n: '10 tracks, 36 min',
    s: ['05', 'Sample track title'],
    art: ['sun', C.ochre, C.terracotta, C.ink],
  },
  {
    t: 'Late, low and slow',
    a: 'A sample playlist',
    k: 'Playlist',
    n: '41 songs, 2 h 38 min',
    s: ['01', 'Sample opening song'],
    art: ['moon', C.plum, C.sand, C.rose],
  },
]

const NOTE = 'Placeholder liner note.'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
const range = (n: number) => Array.from({ length: n }, (_, i) => i)

/** Small printed designs in the room's colours (from the design prototype). */
function coverSvg(r: Sample): string {
  const [m, bg, fg, ac] = r.art
  const T = (x: number, y: number, size: number, fill: string, text: string, w = 500, anchor = 'start') =>
    `<text x="${x}" y="${y}" font-family="Newsreader Variable, Newsreader, Georgia, serif" font-weight="${w}" font-size="${size}" fill="${fill}" text-anchor="${anchor}" letter-spacing="-0.2">${esc(text)}</text>`
  let g = ''
  switch (m) {
    case 'window':
      g = `<rect x="22" y="16" width="56" height="62" rx="1" fill="${fg}" opacity=".92"/>
        ${range(13)
          .map(
            (i) =>
              `<line x1="${25 + i * 4.2}" y1="${18 + (i % 3) * 5}" x2="${23 + i * 4.2}" y2="${40 + (i % 4) * 8}" stroke="${bg}" stroke-width=".7" opacity=".45"/>`,
          )
          .join('')}
        <line x1="50" y1="16" x2="50" y2="78" stroke="${bg}" stroke-width="2.2"/><line x1="22" y1="47" x2="78" y2="47" stroke="${bg}" stroke-width="2.2"/>
        ${T(7, 92, 6.4, ac, r.t)}${T(93, 92, 4.4, fg, r.a, 400, 'end')}`
      break
    case 'keys':
      g = `${range(10)
        .map(
          (i) =>
            `<rect x="${i * 10}" y="44" width="9.4" height="56" fill="${i === 6 ? ac : '#fff'}" opacity="${i === 6 ? 1 : 0.65}"/>`,
        )
        .join('')}
        ${[0, 1, 3, 4, 5, 7, 8].map((i) => `<rect x="${i * 10 + 6.5}" y="44" width="6" height="33" fill="${fg}"/>`).join('')}
        ${T(7, 24, 11, fg, r.t, 600)}${T(7, 33, 4.6, fg, 'playlist', 400)}`
      break
    case 'stripes':
      g = `${range(22)
        .map(
          (i) =>
            `<line x1="0" y1="${8 + i * 4}" x2="100" y2="${8 + i * 4}" stroke="${fg}" stroke-width="${0.3 + (i % 5) * 0.12}" opacity=".5"/>`,
        )
        .join('')}
        <circle cx="70" cy="34" r="12" fill="${ac}"/>${T(7, 88, 9, fg, r.t, 600)}${T(7, 95, 4.4, fg, r.a, 400)}`
      break
    case 'arcs':
      g = `${range(9)
        .map(
          (i) =>
            `<circle cx="50" cy="108" r="${18 + i * 9}" fill="none" stroke="${i === 3 ? ac : fg}" stroke-width="${i === 3 ? 2.2 : 0.7}" stroke-opacity="${i === 3 ? 1 : 0.55}"/>`,
        )
        .join('')}
        ${T(7, 14, 7, fg, r.t, 500)}${T(7, 21, 4.4, fg, r.a, 400)}`
      break
    case 'type':
      g = `${T(5, 34, 21, fg, 'Fourteen', 600)}${T(5, 55, 21, fg, 'Small', 600)}${T(5, 76, 21, ac, 'Rooms', 600)}${T(6, 93, 4.6, fg, r.a, 400)}`
      break
    case 'split':
      g = `<rect x="0" y="0" width="100" height="56" fill="${fg}"/><circle cx="50" cy="56" r="22" fill="${ac}"/>
        <rect x="0" y="56" width="100" height="44" fill="${bg}"/><path d="M28 56 A22 22 0 0 0 72 56 Z" fill="${fg}" opacity=".35"/>
        ${T(50, 90, 7, C.ink, r.t, 500, 'middle')}`
      break
    case 'grid':
      g = `${range(25)
        .map(
          (i) =>
            `<circle cx="${22 + (i % 5) * 14}" cy="${26 + Math.floor(i / 5) * 12}" r="${i === 17 ? 4.5 : 2.4}" fill="${i === 17 ? ac : fg}"/>`,
        )
        .join('')}
        ${T(7, 13, 6, fg, r.t, 600)}${T(93, 94, 4.4, fg, 'playlist', 400, 'end')}`
      break
    case 'sun':
      g = `<circle cx="50" cy="74" r="34" fill="${fg}"/><rect x="0" y="74" width="100" height="26" fill="${ac}"/>
        ${range(4)
          .map(
            (i) => `<line x1="0" y1="${80 + i * 5}" x2="100" y2="${80 + i * 5}" stroke="${bg}" stroke-width=".6" opacity=".55"/>`,
          )
          .join('')}
        ${T(7, 15, 9, ac, r.t, 600)}${T(7, 22, 4.4, ac, r.a, 400)}`
      break
    case 'moon':
      g = `<circle cx="64" cy="38" r="19" fill="${fg}"/><circle cx="72" cy="33" r="17" fill="${bg}"/>
        ${T(7, 82, 8, fg, 'Late, low', 500)}${T(7, 91, 8, ac, 'and slow', 500)}`
      break
  }
  return `<rect width="100" height="100" fill="${bg}"/>${g}`
}

function SampleCover({ svg }: { svg: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

const SAMPLE_RECORDS: CrateRecord[] = SAMPLES.map((r) => {
  const svg = coverSvg(r)
  return {
    key: `sample:${r.t}`,
    title: r.t,
    artist: r.a,
    kind: r.k,
    year: r.y,
    note: NOTE,
    startWith: { number: r.s[0], title: r.s[1] },
    length: r.n,
    art: <SampleCover svg={svg} />,
    tint: r.art[1],
    sample: true,
  }
})

export default function CratePreview() {
  const { collection } = content.music
  return <RecordCrate records={SAMPLE_RECORDS} heading={collection.heading} description={collection.description} />
}
