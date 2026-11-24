# Design System: Susana Pérez Posada — The Room

> Single source of truth for generating new screens (Google Stitch or any design agent) that
> belong to this site. Values are taken from the live code (`src/styles/tokens.css`). Where
> this file departs from generic "premium UI" defaults, it is because Susana chose so; those
> overrides are listed in section 8 and must be respected.

## 1. Visual Theme & Atmosphere

A quiet, lamplit, art-gallery-airy experience built around one hand-painted, animated room. The
painting is the cover of the site and also its only navigation: visitors discover sections by
touching objects in the room (the laptop, the notebook, the bookcase, the books on the desk, the
record player and the coffee mug). Everything else is restrained typography set around the picture,
like the label beside a painting or the printed insert inside a record sleeve.

- **Density 2, "Art Gallery Airy":** the homepage holds only the room, a name, one player and a
  copyright line. Content lives in a paper panel that slides over the room.
- **Variance 3, "Quietly Composed":** the room is centred and dominant. Asymmetry comes from the
  bottom row (name hard left, player on the centre line, copyright hard right), not from a split hero.
- **Motion 4, "Fluid CSS, calm":** short, strongly eased transitions that confirm actions. One
  gentle settle-in on first load. Nothing loops except the painting's own animation and the
  player's progress ring.
- **Mood words:** precise, playful, intimate. Tasteful and quiet above all.

## 2. Color Palette & Roles

Two-colour print logic: ink and paper, plus one spot colour sampled from the record label in the
illustration. All neutrals are warm, tinted toward that label's hue (≈ 40°), never cool zinc.

**Sleeve (the dark page around the room)**
- **Vinyl Night** (#110D0B) — page background. Never pure black.
- **Sleeve Raised** (#1B1614) — placeholder behind the stage before the poster paints.
- **Card Light** (#ECE9E4) — primary text on the dark page (the name, the player title).
- **Soft Light** (#BFBAB4) — secondary text on dark (disciplines line, artist names).
- **Faint Light** (#928B85) — metadata on dark (copyright, player time). Minimum contrast 4.5:1.
- **Light Hairline** (#ECE9E4 at 14% / 28% opacity) — the room's 1px edge, rules and the ring track.

**Insert (panels)**
- **Uncoated Card** (#EFECE8) — panel paper, with a faint 7%-opacity fibre noise texture.
- **Card Shade** (#E2DFDA) — image placeholders and loading blocks on the panel.
- **Press Ink** (#1B1613) — headings and primary text on the panel.
- **Ink Two** (#453E3B) — reading text and summaries.
- **Ink Three** (#675E5B) — labels, metadata, reading time.
- **Ink Hairline** (#1B1613 at 16% / 34% opacity) — dividers between items, section rules.

**The one accent**
- **Record-Label Vermilion** (#E4673F) — on the dark page: the progress ring, focus rings, the
  hover underline on linked titles and the hotspot label dot.
- **Vermilion Ink** (#B43914) — the same hue darkened for AA text on the card: current tab
  underline, small numbers, statuses, link underlines, focus rings inside panels.
- **Lamp Wash** (#F7D19C) — used **only** inside the illustration as a soft-light hover wash
  over an object. Never used on UI chrome.

Rules: one accent only, used rarely (about 10% of visual weight at most). No gradients on
surfaces or text. No purple, blue or neon. No glows.

## 3. Typography Rules

- **Display & reading: Newsreader** (variable, with optical sizes). A gentle, literary serif chosen
  by Susana to sit with the books, the record player and the lamp light. Used for the name
  (−0.01em), panel titles (500, −0.015em), ledes, entry and map titles, the player title, shelf
  titles and book spines. Display tracking stays close to zero; a serif closes up on its own.
  Sentence case, never bold, **no italics anywhere** (the italic files are not loaded).
- **Interface: DM Sans** (variable). Navigation, the scene control, body paragraphs in the panels,
  metadata, reading times, tooltips, copyright, tab labels. Tabular numerals for any time or count.
- **Scale:** 0.75 / 0.875 / 1.125 / clamp(1.3→1.55) / clamp(1.9→2.6) / clamp(2.8→4.6) rem.
  Ratio ≥ 1.25 between steps. Reading text is 1.125–1.19rem with line-height 1.6, capped at
  58–62ch.
- **Banned:** uppercase tracked labels, condensed or wide display grotesks, monospace as
  decoration, Inter, any third font family. Self-hosted fonts only; no third-party requests.

## 4. Component Stylings

- **The Room (stage), frameless:** an exact 16:9 canvas (1920 × 1080) scaled as one unit, never
  cropped or stretched, sitting straight on the page: no tray, no rim, no inner highlight (Susana
  found the frame heavy). Only clamp(18px → 30px) rounded corners and a wide, soft, warm ambient
  shadow (0 50px 100px −50px). The poster paints first; the muted, looping video fades in over it,
  and the four transparent objects (record player, books, laptop, cat) sit on top in that order.
  On phones: 16px corners, 12px margin all round.
- **Hotspots:** invisible SVG polygons traced to each object. On hover or keyboard focus: a warm
  Lamp Wash (soft-light blend) lifts the object, the rest of the room dims by 24%, and a small tag
  appears with a 5px vermilion dot on the object, a short hairline leader, and the label in DM Sans
  italic on Vinyl Night at 92% opacity. Keyboard focus also traces the object's outline in
  vermilion. On touch screens each object shows a steady 9px vermilion dot ringed in light, and
  the tap area is widened invisibly. The cat is an easter egg ("Shh… sleeping."), not a link.
- **Player (centred under the room):** a 44px round button, faintly filled (light at 6%; 12% on
  hover). A 1.25px ring around it traces the loop. Play and pause icons
  cross-fade with a 0.7 scale and 2px blur. Pressing scales it to 0.94. Beside it: the title in
  Newsreader, then a DM Sans meta line ("Playing · 0:12 / 0:28", or "Listening now ·
  Artist" once Spotify is connected).
- **Panel (section reader), floating double-bezel sheet:** a native modal dialog that slides in
  from the right and floats clamp(8px → 14px) inside the window edges, 42rem wide (54vw max on
  desktop, nearly full width on phones). The outer shell is a translucent light tray (14%) with a
  1px rim, 6px padding (4px on phones), 28px corners (22px on phones) and a deep soft shadow.
  The inner core is the Uncoated Card with concentric corners and an inset white top highlight.
  Top bar: section names as plain text tabs (current one underlined in Vermilion Ink) and a plain
  "Close ×". Header: "02 / 06 · 1 minute to read", a large Newsreader title, a summary, then
  a strong hairline. Footer: previous/next as underlined serif titles.
- **Lists inside panels:** never cards. Items are separated by hairline top rules, with small
  vermilion numerals in a narrow left column.
- **Bookshelf:** each shelf is a row of book spines standing on a 6px walnut board
  (#68432F). Spine colours come from the room (walnut, terracotta, orchid rose,
  sweater teal, slate evening, lamp ochre, card, ink). Titles run vertically in Newsreader and authors
  in DM Sans. A spine lifts 6px on hover and 10px when open; its note opens beneath the
  shelf.
- **Record collection (Music):** square Spotify covers with 6px corners and a soft warm two-layer
  shadow, in an auto-fill grid (min 8rem). With five or more items, the first spans 2 × 2 like a
  face-out sleeve. On hover the cover lifts 3px and a 36px Vermilion Ink play disc appears in its
  corner. Choosing a cover opens Spotify's own player (12px corners) above the grid; the chosen
  cover gets a 2px vermilion ring.
- **Work map and things I've made (Work):** the four areas of focus sit in the quadrants of two
  hairline axes (Music to Product, People to Systems). Choosing an area moves the crossing point to
  give it room and unfolds its summary; the other areas recede to their titles. Below, a grid of
  things Susana has made, the one deliberate exception to "never cards": each is a **drawn
  thumbnail** (an object seen from above on a room-coloured ground, 4:3, 6px corners, the record
  covers' shadow, one vermilion detail, no text inside) with its caption on the paper below, never
  a box. Two columns in the panel; on phones the drawing sits beside its caption. A tile opens in
  place; hovering it lights its area on the map, and an open area links to what was made there.
  Each drawing has one small motion, played once on hover or focus, never looping and none under
  reduced motion. No screenshots: their own UI colours fight the room.
- **Links and buttons:** text-first. Underline in Vermilion Ink at 1px with a 0.25em offset. No
  boxed outline buttons, no pills, no filled CTAs except the player disc.
- **Empty and loading states:** a missing feature hides itself on the live site rather than
  showing placeholders. Loading uses a flat Card Shade block of the final size, with no spinner.
  Development-only notes use a dashed Vermilion Ink border and never ship.

## 5. Layout Principles

- **Homepage, desktop:** a single first screen with no scrolling. The room is the largest 16:9 box
  that fits `100svh − top padding (clamp 1–2rem) − bottom row (7.25rem)`, capped at 118rem and
  never narrower than 40rem on screens taller than 560px. Below it, a three-column grid
  `1fr auto 1fr`: name left, player centred on the room's axis, copyright right and
  bottom-aligned.
- **No navigation bar, no menu.** The room is the navigation; panels carry their own section tabs.
- **Panels:** a single reading column with max-width 36rem and generous padding (3rem top,
  2rem sides). Two columns are allowed only for short paired items (values, music notes).
- **Spacing scale (4pt):** 4, 8, 12, 16, 24, 32, 48, 64, 96px. Tight within groups, generous
  between them.
- **Responsive:** at ≤ 900px the copyright drops under the name/player row. At ≤ 639px
  everything stacks into one column (name, player, copyright) and the room goes almost full-bleed.
  Never any horizontal scroll. Touch targets are at least 44px.

## 6. Motion & Interaction

- **Curves:** ease-out `cubic-bezier(0.23, 1, 0.32, 1)` for entering and feedback; drawer curve
  `cubic-bezier(0.32, 0.72, 0, 1)` for the panel; plain `ease` for colour and opacity.
- **Durations:** press 160ms; hover labels 180–220ms; dim/glow 240ms; panel in 420ms, out 240ms
  (leaving is faster than arriving).
- **First arrival only:** the room settles from scale 0.985, blur 6px and opacity 0 over 900ms;
  the name, player and copyright rise 6px in a 60ms stagger.
- **Panel cascade:** on open and on each section change, the header and each content block rise
  12px and fade in over 560ms, 45ms apart (opacity only under reduced motion). No blur inside the
  scrolling panel.
- **Texture:** a 5% light grain on a fixed layer behind the page (never over the painting); a
  7% fibre texture on panel card.
- **Feedback:** pressable things scale to 0.94–0.97 on `:active`. Hover lifts only under
  `(hover: hover) and (pointer: fine)`.
- **Transform and opacity only.** The player ring updates via `stroke-dashoffset` on a single
  element; no React re-render per frame.
- **Reduced motion:** the video doesn't autoplay and isn't even downloaded until Play is pressed.
  Movement becomes fades and durations shrink to 120–160ms.
- **No perpetual micro-loops on UI.** The painting is already alive; the interface stays still.

## 7. Anti-Patterns (Banned)

- No emojis, no icon-library decoration, no monogram badges.
- No boxed outline buttons, no pill buttons, no oversized CTAs, no floating dev widgets.
- No navigation bar or menu on the homepage; no "Explore the room" toggles, tracklists or
  "Side A / Side B" gimmicks.
- No quote-style taglines with a vertical rule, no italic hero statements over the room.
- No uppercase wide-tracked labels, no condensed grotesks, no third font family.
- No cream-paper + serif + sage green; the only accent is the record-label vermilion.
- No pure black (#000000) or pure white (#FFFFFF); no cool zinc or slate neutrals.
- No gradients on text or surfaces, no neon, no glows, no glassmorphism.
- No card grids of icon + heading + blurb; no three equal feature cards.
- No overlays covering the woman, cat, laptop or record player; never crop or alter the painting.
- No invented facts: no fake employers, dates, metrics, testimonials, emails, links, books or
  tracks. Empty content hides; samples exist only in development and are labelled as such.
- No AI copy clichés ("elevate", "seamless", "unleash", "transform your…"), no filler such as
  "Scroll to explore" or bouncing chevrons.
- No autoplaying sound, ever.

## 8. Deliberate Overrides of Generic "Premium" Defaults

These are Susana's decisions and take precedence over any generic design-agent guidance:

| Generic default | This site | Reason |
| --- | --- | --- |
| Modern serifs only (Fraunces, Instrument Serif…) | Newsreader (upright only) + DM Sans | Chosen by Susana. Funnel Display + Funnel Sans came first; the serif-italic pairing had read as AI-generated, so the serif stays upright and the interface stays sans |
| Zinc/Slate neutrals | Warm neutrals tinted toward the record label | Taken from the illustration so the UI belongs to the painting |
| Asymmetric split hero with inline-image headline | The centred room is the hero and the navigation | The painting is the statement; nothing competes with it |
| Perpetual micro-interactions on active components | Calm; only the painting and the progress ring move | The room is already alive; the UI should be quiet |
| Spring physics everywhere | Strong CSS ease-out curves | Transitions are short, predetermined and run smoothly off the main thread |
| Double-bezel on every card | Double-bezel only on the floating panel; the room is frameless; lists stay flat with hairline rules | Two framed objects read as precious; framing everything would read as an app |
| Pill CTAs with arrow "islands", eyebrow badges, floating glass nav | None; text links, one round player button, no nav | Explicitly rejected by Susana as unnecessary or "slop" |
| Desktop nav → mobile menu | No navigation outside the room | Susana wants discoverability to live in the illustration only |
