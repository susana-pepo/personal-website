/** Small brand marks for the profile links, drawn in the current text colour. */
export function SocialIcon({ name }: { name: string }) {
  const key = name.toLowerCase()
  if (key === 'email') {
    return (
      <svg className="social-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect x="2.75" y="5.25" width="18.5" height="13.5" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M3.5 6.5l8.5 6.5 8.5-6.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    )
  }
  if (key === 'linkedin') {
    return (
      <svg className="social-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          fill="currentColor"
          d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z"
        />
      </svg>
    )
  }
  if (key === 'instagram') {
    return (
      <svg className="social-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="12" cy="12" r="4.3" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="17.6" cy="6.4" r="1.3" fill="currentColor" />
      </svg>
    )
  }
  return null
}
