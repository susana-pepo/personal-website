import { content } from '../../content/content'
import { WorkDesktop } from './work/WorkDesktop'

/**
 * Things I've built: the room's tablet, drawn front-on on the walnut board,
 * with the projects as big drawings that scroll on its screen. Choosing one
 * fills the screen with that project ("Put it back" returns to the tiles).
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
