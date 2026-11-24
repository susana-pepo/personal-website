# The folio: a proposal for the section panel

Prototype: open `folio-prototype.html` in a browser. Click the books on the desk to open Experience, choose a book, then turn to Work with the tabs or the pager. The room is a drawn placeholder. All copy comes from `src/content/content.ts`. The one invented value (the contact email) is marked "sample".

## The idea

The panel stops looking like an app sheet and becomes a page taken from the room: one sheet of uncoated card, with two more pages showing beneath it as thin edges on the spine side. Every section is a page in the same folio. They share one header, one rhythm and one pager. Each section gets a single layout idea of its own. Experience gets the books on the desk.

This also brings the desk books back as the way into Experience. The hotspot opens it, and the page starts with the same stack drawn as an index you can use.

## What changes

| Part | Now | Proposed |
| --- | --- | --- |
| Container | Translucent tray (14%) around a card (double bezel) | One card sheet with 20px corners. Two pages beneath show as 5px and 9px edges. No translucency. |
| Open | Sheet slides 3rem and fades, 420ms | Same drawer curve, 460ms. The pages beneath arrive 30ms and 60ms later. The room steps back to `scale(.985)`. Closing takes 240ms on an ease-in curve. |
| Tabs | Each tab has its own underline | One 2px vermilion mark moves between tabs (380ms ease-out, transform only). Left and right arrow keys move between tabs. |
| Progress | None | A 1px vermilion line under the bar fills as you scroll. It only appears when the page scrolls. |
| Header | `03 / 06 · 1 minute to read`, title, summary | Same order, but only the number is in vermilion, and it rolls like a counter when you change sections. If the lede repeats the summary (as it does on Experience), the summary is dropped. |
| Section change | Remounts, then rises 12px | A page turn. The old page slides 14px against the direction of travel and fades in 180ms. The new page's blocks slide in 18px from the direction of travel, 45ms apart. Opening the panel keeps the vertical rise, so opening and turning feel different. |
| Pager | Previous / Next and a title | Previous / Next, the title in Funnel Display, and **the object it lives in** ("The books on the shelf"). This ties the panel back to the room. On hover, a vermilion underline draws across from the outer edge. |
| Phones | Same side sheet, near full width | The page rises from the bottom, and a 3.5rem strip of the room stays visible above it. The page edges move to the top. "Close" becomes just the ×. |

## Per-section layouts

- **Experience, "the books on the desk":** one book per thread, lying flat on a walnut board. The spines use colours from the room, with gilt bands at the ends like the painted books. The books settle onto the stack from the bottom up when the page opens. Choosing a book pulls it 18px out of the stack, scrolls to its entry, and inks that entry's top rule in vermilion. When you hover an entry, its book nudges out 8px. Every entry is always listed below the stack, so a hiring manager who scans never has to click to read.
- **Work:** the same numbered entries (vermilion numerals in a narrow column, hairline above), with a meta line ("Area of focus", plus a status dot for Rights Intelligence).
- **About:** a large Funnel Display lede, then prose at 60ch, then the values in two columns with hairlines above.
- **Contact:** the address set large in Funnel Display. "Copy address" swaps to "Copied ✓" in place: a 6px vertical cross-fade that reverts after 2.4s and is announced to screen readers.
- Bookshelf and Music keep their own layouts inside the same frame. They are not drawn here.

## The rhythm (one scale, three steps)

- 4pt scale: `4 8 12 16 24 32 48 64 96`.
- `--rhythm-inline` 8px: lines inside a group (meta to title).
- `--rhythm-block` 24px: parts of one item.
- `--rhythm-section` 48px: groups on a page (header to lede, lede to list).
- Page padding is `clamp(24px … 44px)`, and the reading measure stays at 36rem.

## Motion rules

Animations use only transform and opacity. Entering and feedback use `cubic-bezier(.23,1,.32,1)`, and the sheet uses the drawer curve `(.32,.72,0,1)`. Leaving is always faster than arriving. Presses scale to 0.96–0.985. Nothing loops. Under reduced motion, every movement becomes a fade of 120–180ms: no sliding sheet, no number roll, and no smooth scrolling.

## Mapping onto the code

- `SectionPanel.css`: replace `.panel__sheet` and `.panel__core` with one sheet plus two `aria-hidden` under-page divs, and add the `.tabs__ink` and `.progress` elements. Keep the `data-state` open/closing machine as it is.
- `SectionPanel.tsx`: keep the previous section id so you can derive `dir`. Render the outgoing `<article>` for about 260ms with `inert` (or use the View Transitions API with a fallback). Move the ink in a layout effect from `offsetLeft` and `offsetWidth`. Add the object name to the pager (`content.sections[id].objectName`).
- `ExperienceSection.tsx`: add a `DeskStack` above the timeline (buttons with `aria-pressed` and `aria-controls`). Spine colours become four tokens in `tokens.css`.
- Content: one rule in the panel (hide the summary when the lede starts with it), or simply shorten one of the two Experience lines.
- Effort: about 1.5–2 days, including reduced-motion and phone passes. No new dependencies.

## Open questions for Susana

1. Should the double bezel give way to the paper edges? It was a deliberate choice, and this proposal replaces it.
2. Should Experience's header summary or lede be rewritten so they stop repeating each other?
3. Should the CV link sit under the desk stack, as a quiet text link, once the file exists?
