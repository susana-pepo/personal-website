import type { CSSProperties } from 'react'
import { content } from '../../content/content'
import { COFFEE_MEDIA, HALO_MARGIN, overlay } from '../../scene/layout'
import './contact/contact.css'

const COFFEE = overlay('coffee')
const [MUG_W, MUG_H] = COFFEE_MEDIA.size // 180 x 385, the room's own still

// The room's halo PNG covers the mug's box plus HALO_MARGIN canvas px on every side
// (the same placement SceneObject uses), so it lands on the silhouette at any size.
const HALO_BOX: CSSProperties = {
  left: `${-(HALO_MARGIN / COFFEE.width) * 100}%`,
  top: `${-(HALO_MARGIN / COFFEE.height) * 100}%`,
  width: `${((COFFEE.width + 2 * HALO_MARGIN) / COFFEE.width) * 100}%`,
  height: `${((COFFEE.height + 2 * HALO_MARGIN) / COFFEE.height) * 100}%`,
}

/**
 * The last page of the insert. The intro as the page's lede, then one small still life:
 * "Let's chat" (the email itself, the subject filled in, the address never printed) with
 * LinkedIn under it, and beside them the coffee from the desk, the object that opened this
 * page, standing on the same ground line in the lamp's halo.
 */
export default function ContactSection() {
  const { contact } = content
  const hasDetails = Boolean(contact.email) || contact.links.length > 0
  const mailto = `mailto:${contact.email}?subject=${encodeURIComponent(contact.cta)}`

  const mug = (
    <>
      {COFFEE.halo && <img className="cup__halo" src={COFFEE.halo} alt="" style={HALO_BOX} decoding="async" draggable={false} />}
      <img className="cup__art" src={COFFEE_MEDIA.still} alt="" width={MUG_W} height={MUG_H} decoding="async" draggable={false} />
    </>
  )

  return (
    <div className="section section--folio contact-v-cup">
      <p className="lede cup__intro">{contact.intro}</p>

      <div className="cup__still">
        <div className="cup__words">
          {hasDetails ? (
            <>
              {contact.email && (
                <a className="cup__invite" href={mailto}>
                  {contact.cta}
                  <span className="visually-hidden">, send me an email to {contact.email}</span>
                </a>
              )}
              {contact.links.map((link) => (
                <a key={link.href} className="cup__link text-link" href={link.href} target="_blank" rel="noreferrer me">
                  {link.action ?? link.label}
                  <span className="visually-hidden"> (opens in a new tab)</span>
                </a>
              ))}
            </>
          ) : (
            <p className="reach__pending">{contact.pendingNote}</p>
          )}
        </div>

        {/* The mug is also the email, as it is in the room, for a pointer only: keyboard and
            screen readers get the one "Let's chat" link above. */}
        {contact.email ? (
          <a className="cup__mug" href={mailto} tabIndex={-1} aria-hidden="true">
            {mug}
          </a>
        ) : (
          <span className="cup__mug" aria-hidden="true">
            {mug}
          </span>
        )}
      </div>
    </div>
  )
}
