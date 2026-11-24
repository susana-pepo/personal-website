import { content } from '../../content/content'
import { WorkDesktop } from './work/WorkDesktop'

/**
 * Things I've built: the room's tablet, drawn front-on on the walnut board,
 * with each project as a file on its desktop. Opening one pours a window
 * out of the file ("Put it back" returns it); on phones it unfolds in place.
 * The tablet is one top-level block, so the panel's entrance cascade applies.
 */
export default function WorkSection() {
  const { work } = content
  return (
    <div className="section section--folio">
      <p className="lede lede--reading">{work.intro}</p>
      <WorkDesktop label={work.projects.label} projects={work.projects.items} />
    </div>
  )
}
