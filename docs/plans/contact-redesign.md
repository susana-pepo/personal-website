# Contact: redesign plan

**Status (24 November): built, composed as option A.** The intro sits beside the mug, as About sets its lede beside the portrait; below a hairline, "Let’s chat" and LinkedIn share a baseline (stacked on phones, with the mug above the intro). The mug is drawn flat from Susana’s own (`contact/DrawnMug.tsx`) and stands on its own walnut coaster, no board; the render, `ChatMug` and `SocialIcon` are removed.

## Why it reads as early 2000s

Set beside the other five sections (screens at 1440 × 900, 24 November), Contact is the only one built like a widget rather than a page of the printed insert:

1. **A boxed card.** A cream paper card with a drop shadow, a slight tilt and its own background. No other section puts its text in a box. Their text sits straight on the panel paper, and the drawn objects carry the picture.
2. **A photoreal mug.** The terracotta mug is a glossy 3D render with soft shadows. Every other object in the panels is drawn flat in the room’s colours: the book spines, the top-down record player, the laptop and its file icons. The render style is what reads as clip art.
3. **An icon-and-label contact list.** Small envelope and LinkedIn icons beside small labels is the classic “Contact me” sidebar box. The rest of the site uses plain text links (“Open in Spotify”, “Explore project ↗”) or the objects themselves as the controls.
4. **The type breaks the system.** The intro is set in the reading serif inside a narrow card. Every other section opens on a DM Sans lede at full measure, then gives its drawn object room.
5. **Unbalanced space.** The card and mug hug the top, and the board runs under both like a shelf, which reads as a product display.

## Direction: the last page of the insert

Contact becomes the colophon of the printed insert: a short lede, one big serif invitation that *is* the action, and a small flat drawing of her mug on the walnut desk edge, drawn the way the record player and the books are drawn.

**Layout (desktop)**
- **Lede.** The intro, as a `.lede` paragraph at the same size, measure and colour as Experience, Work and Music. No card.
- **The invitation.** “Let’s chat” set large in Newsreader, the size of the Music section’s sub-headings or one step up, and it *is* the email link: `mailto:` with the subject, address never printed. A vermilion underline draws in from the left on hover or focus (the same 200ms treatment as the other text links), with a small “↗”-style mark only if it doesn’t crowd the type.
- **The second action.** “Or find me on LinkedIn” in DM Sans as a plain `.text-link`, the same style as “Open in Spotify”. No icons.
- **The drawing.** The mug, redrawn as flat vector shapes in the Turntable’s style: terracotta body, cream dipped glaze at the foot, walnut coaster, two or three thin steam strokes in Ink Three. Standing on the shared walnut board (`ShelfBoard`), like the book piles in Experience. The board runs only under the mug, not under the text.
- **Composition.** Text on the left (about 60%), the mug on the right standing on its board, both on one baseline at the bottom of the block, so the panel isn’t empty below.

**Phones**
- Lede, then the mug on its board, centred and small (about 6 rem), then “Let’s chat” and the LinkedIn link. All targets at least 44px.

**Motion (calm, under 300ms, reduced motion respected)**
- Arrival: the panel’s usual cascade, no special card slide.
- Hovering or focusing “Let’s chat” sends the steam strokes up once (a 2.4s drift, opacity and a few pixels’ rise, then rest). This is the one moment of delight, and it ties the mug to the action. On touch it plays once after arrival. With reduced motion the steam stays still.
- No tilt, no drop shadows, no card.

**Copy (unchanged facts)**
- Intro: as Susana wrote it.
- “Let’s chat” as the email action (subject “Let’s chat”).
- “Or find me on LinkedIn” (LinkedIn only: no Instagram, no location, address never printed).

## What goes

- `.note`, `.note__card` (paper, shadow, tilt), the two-column grid and the phone layout where the mug rests on the card.
- `SocialIcon` in Contact (the file stays if anything else uses it).
- The render (`mug-body.webp`, `mug-steam.webp`) and `ChatMug`. They're replaced by a `DrawnMug` SVG component. The images stay in `public/` until the new mug is approved, then they're removed.

## Files

- `src/components/sections/ContactSection.tsx`: the new structure.
- `src/components/sections/contact/DrawnMug.tsx`: new, the SVG mug, with its steam as separate strokes.
- `src/components/sections/panel-sections.css`: the Contact block rewritten. Experience and About styles are untouched.
- `src/content/content.ts`: only if the LinkedIn label changes to “Or find me on LinkedIn”.
- `src/__tests__/contact.test.tsx`: updated (mailto subject, no printed address, one LinkedIn link, no Instagram).

## Checks

1440 and 390 wide, keyboard (Tab order: invitation, then LinkedIn; visible focus rings), reduced motion, `npx tsc -b`, `npx vitest run --dir src`, `npm run build`, and a side-by-side screenshot with Experience and Music to confirm it reads as the same insert.
