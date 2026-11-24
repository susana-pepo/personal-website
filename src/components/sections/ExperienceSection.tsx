import { useEffect, useRef, useState } from 'react'
import { content } from '../../content/content'
import type { ExperienceEntry } from '../../content/types'
import { objectLabel, pad } from '../SectionPanel/folio'
import { DeskPile } from './experience/DeskPile'
import { Topics } from './Topics'
import { prefersReducedMotion } from '../../lib/motion'

/** How long the scroll takes to arrive before the chosen entry's rule inks in. */
const INK_DELAY_MS = 280

const entryId = (entry: ExperienceEntry) => `experience-${entry.id}`


/**
 * "The books on the desk": one drawn book per thread, lying in a pile.
 * Choosing a book pulls it out of the stack and brings its entry into view.
 * Every entry is always listed below, so nothing needs a click to be read.
 */
export default function ExperienceSection() {
  const { experience } = content
  const { entries } = experience
  const [chosen, setChosen] = useState<string | null>(null)
  const [inked, setInked] = useState<string | null>(null)
  const [peek, setPeek] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const choose = (entry: ExperienceEntry) => {
    window.clearTimeout(timer.current)
    setInked(null)
    if (chosen === entry.id) {
      setChosen(null)
      return
    }
    setChosen(entry.id)
    const reduce = prefersReducedMotion()
    document.getElementById(entryId(entry))?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
    // Ink the rule once the entry has arrived, so the motion is seen, not missed.
    timer.current = window.setTimeout(() => setInked(entry.id), reduce ? 0 : INK_DELAY_MS)
  }

  const deskLabel = objectLabel('experience') || 'The books on the desk'

  return (
    <div className="section section--folio">
      <p className="lede">{experience.intro}</p>

      {entries.length > 0 && (
        <DeskPile entries={entries} label={deskLabel} chosen={chosen} peek={peek} controls={entryId} onChoose={choose} />
      )}

      <ol className="entries entries--desk" role="list" onPointerLeave={() => setPeek(null)}>
        {entries.map((entry, i) => {
          const details = [entry.period, entry.organization, entry.location].filter(Boolean)
          return (
            <li
              key={entry.id}
              id={entryId(entry)}
              className="entry"
              data-current={inked === entry.id ? '' : undefined}
              onPointerEnter={() => setPeek(entry.id)}
            >
              <span className="entry__n" aria-hidden="true">
                {pad(i + 1)}
              </span>
              {details.length > 0 && (
                <p className="entry__meta">
                  {details.map((detail) => (
                    <span key={detail}>{detail}</span>
                  ))}
                </p>
              )}
              <h3 className="entry__title">{entry.title}</h3>
              <p className="entry__body">{entry.summary}</p>
              <Topics label={`Focus areas in ${entry.title}`} items={entry.focus} />
            </li>
          )
        })}
      </ol>

      {experience.education.length > 0 && (
        <div className="folio-group">
          <h3 className="folio-subhead">Education</h3>
          <ul className="folio-education" role="list">
            {experience.education.map((item) => (
              <li key={item.id}>
                <span className="folio-education__qualification">{item.qualification}</span>
                <span className="folio-education__institution">
                  {item.institution}
                  {item.period ? `, ${item.period}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {__CV_PATH__ && (
        <p className="section__actions">
          <a className="text-link" href={__CV_PATH__} download>
            {experience.cvLabel}
          </a>
        </p>
      )}
    </div>
  )
}
