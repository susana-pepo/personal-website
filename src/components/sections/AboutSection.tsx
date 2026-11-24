import { content } from '../../content/content'

/**
 * The panel heading is the greeting (content.sections.about.title). Under it: the one sentence
 * it all hangs on, with my photo beside it as a small print laid on the page, then the prose at
 * a reading measure, then a quiet closing.
 */
export default function AboutSection() {
  const { about } = content
  return (
    <div className="section section--folio">
      <div className={about.portrait ? 'about-opening about-opening--portrait' : 'about-opening'}>
        {about.intro && <p className="lede about-intro">{about.intro}</p>}
        {about.portrait && (
          <figure className="about-print">
            <img
              src={about.portrait.src}
              srcSet={`${about.portrait.srcSmall} 280w, ${about.portrait.src} 560w`}
              sizes="(max-width: 639px) 9rem, 12rem"
              alt={about.portrait.alt}
              width={560}
              height={560}
              decoding="async"
            />
          </figure>
        )}
      </div>
      <div className="prose">
        {about.paragraphs.map((paragraph) => (
          <p key={paragraph.slice(0, 32)}>{paragraph}</p>
        ))}
      </div>
      {about.closing && <p className="about-closing">{about.closing}</p>}
    </div>
  )
}
