import { useEffect, useRef, useState } from 'react'
import { content } from '../../content/content'

const COPIED_MS = 2400

/** The address set large, with a copy button that confirms in place. */
export default function ContactSection() {
  const { contact } = content
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const hasDetails = Boolean(contact.email) || contact.links.length > 0

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(contact.email)
      setCopied(true)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(false), COPIED_MS)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="section section--folio">
      <p className="lede lede--large">{contact.intro}</p>

      <div className="reach">
        {contact.email && (
          <div className="reach__email">
            <p className="reach__label">Email</p>
            <div className="reach__row">
              <a className="reach__address" href={`mailto:${contact.email}`}>
                {contact.email}
              </a>
              <button type="button" className="copy-button" data-done={copied ? '' : undefined} onClick={copyEmail}>
                <span className="copy-button__idle">Copy address</span>
                <span className="copy-button__done" aria-hidden="true">
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path
                      d="M3 8.5l3 3 7-7"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Copied
                </span>
              </button>
              <span className="visually-hidden" role="status">
                {copied ? 'Email address copied to clipboard' : ''}
              </span>
            </div>
          </div>
        )}

        {contact.links.length > 0 && (
          <ul className="reach__links" role="list">
            {contact.links.map((link) => (
              <li key={link.href}>
                <a href={link.href} target="_blank" rel="noreferrer me">
                  <span className="reach__link-label">{link.label}</span>
                  <span className="reach__link-display">{link.display}</span>
                  <span className="visually-hidden"> (opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        )}

        {!hasDetails && <p className="reach__pending">{contact.pendingNote}</p>}
        {contact.location && <p className="reach__location">{contact.location}</p>}
      </div>
    </div>
  )
}
