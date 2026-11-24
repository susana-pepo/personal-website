import { content } from '../../content/content'
import type { SectionId } from '../../content/types'

/**
 * A picture beside a page's heading, in the header's second column. Only About has one: my
 * portrait, a small print laid on the page next to "Hi there, I'm Susana". It lives in the
 * shared header (not in AboutSection) so it can sit level with the heading.
 */
export function HeaderArt({ id }: { id: SectionId }) {
  const portrait = id === 'about' ? content.about.portrait : undefined
  if (!portrait) return null
  return (
    <figure className="panel__header-art about-print">
      <img
        src={portrait.src}
        srcSet={`${portrait.srcSmall} 280w, ${portrait.src} 560w`}
        sizes="(max-width: 639px) 5.5rem, 8.5rem"
        alt={portrait.alt}
        width={560}
        height={560}
        decoding="async"
      />
    </figure>
  )
}
