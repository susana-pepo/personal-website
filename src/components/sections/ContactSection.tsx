import { useEffect, useState } from 'react'
import { content } from '../../content/content'
import { usePrefersReducedMotion, useMediaQuery } from '../../hooks/useMediaQuery'
import { ShelfBoard } from './books/ShelfBoard'
import { ShelfDefs } from './books/ShelfDefs'
import { ChatMug } from './contact/ChatMug'
import { SocialIcon } from './contact/SocialIcon'
// The shared walnut board's styles (.bs-board) live in the Bookshelf's sheet.
import './bookshelf/bookshelf.css'

/** When the note has arrived, on touch screens the steam drifts twice (about 10 s) and stops. */
const ARRIVE_MS = 900
const STEAM_RISE_MS = 9600 // two slow drifts of the wisps (4.8 s each)

/**
 * A drawn coffee mug (in the books' style) and a small paper note, side by side on the walnut
 * desk edge in two columns of one height (on phones the mug rests on the note's corner). The note is the contact: the intro, "Let’s chat" as
 * its heading, then two equal actions: "Send me an email" (an email with the subject filled in;
 * the address itself is never printed) and "Connect on LinkedIn". Hovering or focusing either
 * action lets the steam drift, barely.
 */
export default function ContactSection() {
  const { contact } = content
  const reducedMotion = usePrefersReducedMotion()
  const touch = useMediaQuery('(hover: none)')
  const [steam, setSteam] = useState<'rest' | 'rising'>('rest')
  const hasDetails = Boolean(contact.email) || contact.links.length > 0

  // Touch has no hover: once the note has arrived, the steam drifts for a few seconds, then rests.
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
      <div className="note-desk">
        <ShelfDefs />
        <div className="note">
          <span className="note__mugcol">
            <ChatMug steam={steam} />
          </span>
          <div className="note__card">
            <p className="note__intro">{contact.intro}</p>

            {hasDetails ? (
              <div className="note__action">
                <h3 className="note__title">{contact.cta}</h3>
                <ul
                  className="note__acts"
                  role="list"
                  onPointerEnter={(e) => e.pointerType === 'mouse' && warm(true)}
                  onPointerLeave={() => warm(false)}
                  onFocus={() => warm(true)}
                  onBlur={() => warm(false)}
                >
                  {contact.email && (
                    <li>
                      <a className="note__act" href={mailto}>
                        <SocialIcon name="email" />
                        <span className="note__act-label">{contact.emailAction}</span>
                        <span className="visually-hidden">, to {contact.email}</span>
                      </a>
                    </li>
                  )}
                  {contact.links.map((link) => (
                    <li key={link.href}>
                      <a className="note__act" href={link.href} target="_blank" rel="noreferrer me">
                        <SocialIcon name={link.label} />
                        <span className="note__act-label">{link.action ?? link.label}</span>
                        <span className="visually-hidden"> (opens in a new tab)</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="reach__pending">{contact.pendingNote}</p>
            )}
          </div>
        </div>
        <ShelfBoard className="bs-board note-desk__board" />
      </div>
    </div>
  )
}
