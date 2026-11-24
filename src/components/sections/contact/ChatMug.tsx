/**
 * The coffee mug: Susana's terracotta stoneware illustration on a walnut
 * coaster, in two layers cut at the rim (public/media/contact): the mug and
 * coaster, and the steam above it, so the steam can drift on its own.
 *
 * It fills the box it's given and stands at the box's foot. `steam="rising"`
 * lets the steam drift, barely (see .note-mug in panel-sections.css).
 */
export const MUG = {
  body: '/media/contact/mug-body.webp',
  steam: '/media/contact/mug-steam.webp',
  /** The whole illustration's width over its height (steam and mug together). */
  ratio: 646 / 1020,
} as const

export function ChatMug({ steam }: { steam: 'rest' | 'rising' }) {
  return (
    <span className="note-mug" data-steam={steam} aria-hidden="true">
      <span className="note-mug__art">
        <img className="note-mug__steam" src={MUG.steam} alt="" width={480} height={306} decoding="async" draggable={false} />
        <img className="note-mug__body" src={MUG.body} alt="" width={480} height={452} decoding="async" draggable={false} />
      </span>
    </span>
  )
}
