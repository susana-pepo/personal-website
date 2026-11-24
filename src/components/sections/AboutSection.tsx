import { content } from '../../content/content'

/**
 * The panel heading is the greeting (content.sections.about.title), with my photo beside it as
 * a small print laid on the page (SectionPanel's HeaderArt). Under it: the one sentence it all
 * hangs on, set in the serif, then the prose at a reading measure, then a quiet closing.
 */
export default function AboutSection() {
  const { about } = content
  return (
    <div className="section section--folio">
      {about.intro && <p className="lede about-intro">{about.intro}</p>}
      <div className="prose">
        {about.paragraphs.map((paragraph) => (
          <p key={paragraph.slice(0, 32)}>{paragraph}</p>
        ))}
      </div>
      {about.closing && <p className="about-closing">{about.closing}</p>}
    </div>
  )
}
