import { useEffect, useState } from 'react'
import { content } from '../../content/content'
import { usePrefersReducedMotion, useMediaQuery } from '../../hooks/useMediaQuery'
import { DrawnMug } from './contact/DrawnMug'

/** On touch screens, once the page has arrived, the steam drifts up once, then rests. */
const ARRIVE_MS = 900
const STEAM_RISE_MS = 2400 // one slow drift of the wisps

/**
 * The last page of the insert, composed like About: the intro beside Susana’s mug (drawn flat
 * like the record player and the books, on its walnut coaster), as About sets its opening beside
 * the portrait. Below a hairline, "Let’s chat", set large, is itself the email (the subject
 * filled in, the address never printed), with LinkedIn as a plain link across from it.
 * Reaching for either action sends the mug’s steam up once.
 */
export default function ContactSection() {
  const { contact } = content
  const reducedMotion = usePrefersReducedMotion()
  const touch = useMediaQuery('(hover: none)')
  const [steam, setSteam] = useState<'rest' | 'rising'>('rest')
  const hasDetails = Boolean(contact.email) || contact.links.length > 0

  // Touch has no hover: once the page has arrived, the steam drifts up once, then rests.
  useEffect(() => {
    if (!touch || reducedMotion) return
    const start = window.setTimeout(() => setSteam('rising'), ARRIVE_MS)
    const stop = window.setTimeout(() => setSteam('rest'), ARRIVE_MS + STEAM_RISE_MS)
    return () => {
      window.clearTimeout(start)
      window.clearTimeout(stop)
    }
  }, [touch, reducedMotion])

  const warm = (on: boolean) => {
    if (reducedMotion || touch) return
    setSteam(on ? 'rising' : 'rest')
  }

  const mailto = `mailto:${contact.email}?subject=${encodeURIComponent(contact.cta)}`

  return (
    <div className="section section--folio">
      {/* The intro beside the mug, as About sets its opening beside the portrait. */}
      <div className="chat-opening">
        <p className="lede cv-lede">{contact.intro}</p>
        <div className="chat__desk" aria-hidden="true">
          <DrawnMug steam={steam} />
        </div>
      </div>

      {/* Below a hairline: the invitation, which is the email itself, and LinkedIn. */}
      {hasDetails ? (
        <div
          className="chat__actions"
          onPointerEnter={(e) => e.pointerType === 'mouse' && warm(true)}
          onPointerLeave={() => warm(false)}
          onFocus={() => warm(true)}
          onBlur={() => warm(false)}
        >
          {contact.email && (
            <a className="chat__invite" href={mailto}>
              {contact.cta}
              <span className="visually-hidden">, send me an email to {contact.email}</span>
            </a>
          )}
          {contact.links.map((link) => (
            <a key={link.href} className="chat__link text-link" href={link.href} target="_blank" rel="noreferrer me">
              {link.action ?? link.label}
              <span className="visually-hidden"> (opens in a new tab)</span>
            </a>
          ))}
        </div>
      ) : (
        <p className="reach__pending">{contact.pendingNote}</p>
      )}
    </div>
  )
}
