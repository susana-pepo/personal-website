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

- **Density 2, "Art Gallery Airy":** the homepage holds only the room, a slim masthead (name,
  disciplines, a three-link menu and the scene control), one player and a copyright line. Content
  lives in a dark smoked-glass panel that slides over the room.
- **Variance 3, "Quietly Composed":** the room is centred and dominant. Asymmetry comes from the
  masthead (name hard left, scene control hard right) and the row beneath the room (player on the
  centre line, copyright hard right), not from a split hero.
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

**Insert (panels): smoked glass**

The panel is one slab of polished, nearly opaque dark "smoked glass", lit by the room's desk lamp. `.panel`
(`SectionPanel.css`) redefines the `--card` and `--ink` tokens for everything inside it, so the
sections keep writing `var(--ink)` and `var(--card)` and read correctly on the dark surface. The
cream root values in `tokens.css` (#EFECE8 card, #1B1613 ink) are overridden inside the panel.
- **Smoke** (#29211C, `--card`) — the panel's ground. The slab itself is painted with a 165°
  gradient from #251F1B to #14100D (`--g-top`, `--g-bottom`: a deep smoke, less brown than leather or card), slow density clouds
  (`public/media/panel/smoke.webp`), a little more shade toward the foot and a 7% grain, so it
  reads as a material and never bands. Its light and bevels are described in §4.
- **Smoke Shade** (#201915, `--card-shade`) — loading blocks and placeholders on the panel.
- **Lamp Ink** (#ECE7DF, `--ink`) — headings and primary text on the panel.
- **Ink Two** (#DFDAD2) — reading text.
- **Ink Three** (#C4BCB4) — metadata, tabs at rest, quiet notes.
- **Light Hairline** (#ECE7DF at 13% / 24%, `--rule-card`) — kept as tokens; no rule divides a page.
- **Raised Smoke** (#392F2A) — the Work tablet's project window: on the smoked panel, raised
  means a step lighter.

**The one accent**
- **Record-Label Vermilion** (#E4673F) — on the dark page: the progress ring, focus rings, the
  hover underline on linked titles and the hotspot label dot.
- **Vermilion Ink** (#B43914 in `tokens.css`; inside the panel lifted to #F79E75 so it reads on
  the smoke) — current tab underline, small numbers, statuses, link underlines, focus rings
  inside panels.
- **Lamp Wash** (#F7D19C) — used **only** inside the illustration as a soft-light hover wash
  over an object. Never used on UI chrome.

Rules: one accent only, used rarely (about 10% of visual weight at most). No gradients on
text. Surface gradients only where they simulate a material lit by the lamp: the panel's glass,
the turntable's walnut plinth, the pools of lamplight under the turntable and the coffee cup.
No purple, blue or neon. No glows. (One exception: the glimmers' moonlight, only on their
hints.)

## 3. Typography Rules

Two faces from Vercel's Geist family, self-hosted from the official release (geist@1.9.2, SIL
Open Font Licence 1.1; files and `LICENSE.txt` in `src/assets/fonts/geist/`, declared in
`src/styles/fonts.css`). `font-synthesis: none` (`base.css`), so the browser never fakes a
bold or an italic.

- **Titles: Geist Serif** (`--font-display`). One weight, 400, and no italic. Used for page
  titles (`--text-title`, clamp 1.875→2.5rem: 40px on a desktop, 30px on a phone), the titles
  of a page's parts (`--text-section`, 1.25rem: Music's shelves, Experience's second pile, a
  page's subheads, the Bookshelf's shelf names), the wordmark in the masthead, and the few
  invitations set like titles ("Let's chat" on Contact, clamp 1.5→1.75rem).
  Page titles are tracked a little tighter (`--track-title`, −0.025em, shared with the
  wordmark); part titles, near body size, keep normal tracking. The one weight is never made
  bolder; size and full ink carry it.
  On the panel's glass, page titles and section headings take `--ink-display`, oklch(0.95 0.02 80): a warmer cream than the body's `--ink`, as if the desk lamp falls on them. It is flat ink only. A study tried printed, under-glass, lit and edge-catch treatments; each read as emboss, dull grey or glow, or softened the strokes. Body, tabs and meta stay `--ink`/`--ink-2`/`--ink-3`, and higher-contrast modes fall back to `--ink`.
- **Everything else: Geist** (`--font-sans`, variable 100–900). Reading text, ledes, item
  titles (500), the room's labels and the greeting, navigation, tabs, the scene control, the
  player, metadata, copyright, the Work tablet's file names, the open book's title and Reading
  now's title (500), and the lettering on every spine, on the Experience desk and on the
  Bookshelf (600 for titles, 500 for authors and years), so it reads like foil stamping.
  Tabular numerals for any time or count.
- **`--font-serif` is the reading voice**, kept as its own token so a page's lead can move
  without touching the rest. It now resolves to Geist, so reading text is in the sans.
- **The panel's scale** (chosen by Susana, option A of a three-way study, Nov 2026). Sized for
  the panel's desktop column (about 33rem). One clear title, then everything near reading
  size, told apart by face and weight rather than by size, so nothing in the page shouts:

  | Role | Face | Size | Token |
  |---|---|---|---|
  | Page title | Geist Serif 400, cream | 40px desktop, 30px phone | `--text-title` |
  | A part's heading | Geist Serif 400, cream, line-height 1.3 | 20px | `--text-section` |
  | Lede | Geist 400, `--ink` | 19px, line-height 1.5, 40ch | `--text-lede` |
  | Item title (a project, a company, a role, a record, a book) | Geist 500 | 18px, line-height 1.3 | `--text-item` |
  | Body | Geist 400, `--ink-2` | 17px, line-height 1.6 | `--text-body` |
  | Meta, captions | Geist 400, `--ink-3` | 14px | `--text-sm` |

  A part's heading is the serif at 20px, not the body's 17px, because the serif's lowercase is
  shorter: at 20px it reads the same size as the body and is set apart by its face alone. (Neither
  face has an italic, small capitals or alternate sets, so the serif is the only "other voice"
  available at body size.) Item titles stay below the part heading over them in voice, not size.
- **Rhythm in the panel:** 32px from the page title to the page; `--rhythm-group` (2.5rem)
  between a page's groups (closer than the page's 3rem padding, so a small heading stays with
  what it heads); a heading sits 4–8px above its own content. Experience's two piles sit
  `--rhythm-group × 1.25` apart.
- **Floors:** body 17px; panel tabs 15px; metadata at least 14px inside panels. Reading text is
  capped at 58–62ch.
- **General scale** (outside the panel too): 0.75 / 0.875 / 1.125 / clamp(1.3→1.55) /
  clamp(1.9→2.6) / clamp(2.8→4.6) rem.
- **No italics anywhere** (Geist Serif has none). Sentence case.
- **Banned:** uppercase tracked labels, condensed or wide display grotesks, monospace as
  decoration, Inter, any third font family. Self-hosted fonts only; no third-party requests.
  One existing exception, not changed: the masthead's disciplines line ("Product, Music &
  Technology", 11px, 0.15em) and its three menu links (12px, 0.15em) are still set in small
  tracked capitals.
- **How Geist was chosen:** Newsreader (display and reading) with DM Sans (interface) came
  before it. In a type review a judge panel preferred keeping Newsreader + DM Sans; Susana chose
  Geist. Fixes applied for Geist: the Work tablet's file names and the Experience desk books'
  lettering and all spine lettering are set in the sans, About's lead wraps with `text-wrap: pretty` so no word is left
  alone, item titles are kept below section titles, and the wordmark is set at the serif's one
  weight in full ink rather than bolded.

## 4. Component Stylings

- **The Room (stage), frameless:** an exact 16:9 canvas (1920 × 1080) scaled as one unit, never
  cropped or stretched, sitting straight on the page: no tray, no rim, no inner highlight (Susana
  found the frame heavy). Only clamp(18px → 30px) rounded corners and a wide, soft, warm ambient
  shadow (0 50px 100px −50px). The poster paints first; the muted, looping video fades in over it,
  and the four transparent objects (record player, books, laptop, cat) sit on top in that order.
  On phones: 16px corners, 12px margin all round.
- **Hotspots:** invisible SVG polygons traced to each object. On hover or keyboard focus: a warm
  Lamp Wash (soft-light blend) lifts the object, the rest of the room dims by 24%, and a small tag
  appears with a 5px vermilion dot on the object, a short hairline leader, and the label in Geist
  (upright) on Vinyl Night at 92% opacity. Keyboard focus also traces the object's outline in
  vermilion. On touch screens each object shows a steady 9px vermilion dot ringed in light, and
  the tap area is widened invisibly. The cat is an easter egg ("Shh… sleeping."), not a link.
- **Glimmers (the room's small surprises):** objects that answer in place instead of opening a
  section: today the cat (pet it), the lamp (click it) and the piano (click it to play it). They have no halo and no label, so each
  has a *hint*: a small sign of life that makes a visitor curious, never an instruction (no hands,
  arrows, rings or words like "click"). One rule for all of them (`src/scene/glimmers.ts`):
  - **Moonlight is theirs.** Every hint is drawn in one soft moonlight blue (`--moon`, with a faint
    `--moon-bloom` edge on its own small marks) that nothing else in the room uses. Sections
    breathe amber, so the colour alone says "a different kind of thing".
  - **In its own nature.** The sleeping cat breathes out three z's, bold rather than big (Geist
    700, about 18 → 23 → 29px on a laptop), drifting up from its head. The lamp's bulb catches,
    a soft dip and back and a smaller one, as if a switch had been touched, and three four-point
    glints twinkle up its brass. The piano plays its own hover for about 3.6 s: it grows a touch,
    its screen flickers on and blinks PIXEL / JAM / PIANO, and a few cream notes float up. It is
    the one hint not in moonlight, since its screen is its voice. Once the piano is found, its
    screen alone still blinks its name on its own, like a vintage CRT (a white line snapping open, scanlines, a rolling bar, now and then a red/cyan glitch), 2 s after her opening lines, then every 10 s;
    no grow, no notes; not with reduced motion).
  - **The room's pace.** Hints ease in over most of a second, out of a slight blur like her
    greeting, drift on `--ease-drift` or breathe on `--ease-sine`, and fade as they go: never held,
    never snapped. Each covers about the same area, on the window side of its object.
  - **Looped while unfound, one at a time.** On the room's one clock (`src/scene/roomCues.ts`):
    each unfound glimmer in turn, every 13.5 s round, from a second after the first look and her
    greeting. The first cue
    comes once the room's first look and her greeting are over (the greeting's timing never
    moves). Never while a page is open, the room is paused, the tab is hidden or
    something is pointed at; that turn is skipped. With reduced motion a hint fades where it
    stands.
  - **Their own cursors.** With a mouse over a glimmer, the cursor is drawn in the room's ink
    (cream, warm-brown line; `GlimmerCursor`). Over the cat it is a hand that strokes, gliding
    along its fingers and back, and a click pats. Over the lamp it is a little bulb that flicks
    on now and then (on, a catch, on), glows a moment with a small moonlight spark and eases
    off; it stays on while the button is down. Over the piano it is a small pixel-art note that
    hops one pixel on the beat, with a moonlight sparkle; a press holds it up. No glimmer has a hover
    label: the cursor and the object's own answer say it (screen readers keep each name). The section objects keep the plain pointer. Still
    with reduced motion; never on touch or for the keyboard.
  - **Always an answer.** A pet while the cat is still answering the last one doesn't start
    over, but it never goes unanswered: a purr floats up from its head every time.
  - **A purr that follows the hand.** A real cat's purr (a CC0 recording, `src/audio/purr.ts`)
    starts softly as a pet begins, grows fuller the more the hand strokes, settles to a quiet
    resting purr when the hand stays still and fades as it leaves; a click swells it a little.
    Browsers allow sound only after a click, so it is first heard on a click on the cat; after
    that, stroking alone purrs. It is as loud as the music is set (30% by default).
  - **Found is for good.** Hovering, focusing or tapping one finds it, remembered in the browser;
    its hint stops (the cat keeps its occasional cream dreams). When all are found the room is
    quiet. A new glimmer needs an entry in `GLIMMERS` and one moonlight hint in its own nature.
- **Player (centred under the room):** a 44px round button, faintly filled (light at 6%; 12% on
  hover). A 1.25px ring around it traces the loop. Play and pause icons
  cross-fade with a 0.7 scale and 2px blur. Pressing scales it to 0.94. Beside it: the title
  and a meta line in Geist ("Playing · 0:12 / 0:28", or "Listening now · Artist" once Spotify
  is connected).
- **Panel (section reader), one sheet of smoked glass:** a native modal dialog that slides in
  from the right (on wide screens with a mouse, pours out of the clicked object: the genie, §6)
  and floats clamp(8px → 14px) inside the window edges, min(43rem, 56vw) wide
  (min(43rem, 88vw) up to 1024px; on phones it rises from the bottom, nearly full width,
  leaving a strip of the room above). Chosen by Susana after a design review with three prototypes and critics.
  The glass is **simulated and nearly opaque, not translucent** (route C, "polished smoked
  slab", chosen by Susana: realism from reflection and light, not see-through). It is lit by
  the desk lamp: SectionPanel.tsx measures the bulb onto the sheet (`--lamp-x`, `--lamp-y`, and
  `--lamp-near`, which eases the lamp's light when the bulb is far from the edge on wide
  windows). All of it is still paint in the Glass part of `SectionPanel.css`:
  - the smoke (see §2), sitting a touch deeper in the middle of the face (Fresnel: the face seen
    straight on reflects least), the lamp's bloom on the face, faint room light high up (warm
    over the lamp's side, the window's cool at the far top corner), soft shade inside the edges
    turned away from the lamp, a contact shadow and a long fall-off on the room, and the slab's
    thickness seen side-on: a dark 2px band just inside the edge line all round (lighter on the
    lamp's side, where the bevel's groove carries it), so the edge reads as "bright line, then
    dark line" like real glass, not as a border;
  - **the window's sheen** (`.panel__sheen`): one broad, very faint, slanted band of the
    window's cool light high on the face (`--g-sheen`: 0.045 at night, 0.065 at midday, 0.05 at
    dawn; 0.045 on a phone at midday, where it sat behind the tabs), with a soft start on its
    window side (it ramps in over about 9% of the width, so it reads as a reflection, not a drawn
    line) and gone by 40% of the height (25%, and softer, on phones), well above the body text;
  - **the room reflected in the face** (`::before`): one still of the whole room per time of day
    (`public/media/panel/reflection-{night,midday,dawn}-{face,edge,top}.webp`, made from the
    stage itself: only its bright shapes, mirrored, softened so the lamp shade reads as a warm
    band rather than a cut-out, at about half their colour, in the alpha). `glass.ts`
    lays it where the room's mirror image really falls on the sheet, from the stage's box at
    open time (`--refl-x/y/w/h`, re-measured on resize), so the lamp, curtain and window show at
    the edge at any width. Fresnel: strongest at the lamp-side edge and gone within about a sixth
    of the width, well before the reading column. The stills are fetched and decoded at idle, so the first open never waits;
  - **the bevels** (`.panel__glass` and its pseudo-elements): a rounded thickness, not a stroke.
    Each has a lit curve a couple of px in and a darker line where it meets the face. The
    lamp-side curve and its corner arc share one fade: lit facing the bulb and nearly gone 15%
    of the height either side of it, so the edge never reads as a pale rail; the arc keeps a
    little light, brighter on its lamp-facing end than at its top (`--g-arc-top`), and stays
    well below the bulb's point. The lamp-side bevel holds a
    faint, nearly colourless trace of the room squeezed into the curve (`--g-squeeze`; kept
    inside the curve and dropped when the bulb is far from the edge) and the lamp as a small,
    soft, warm-white point with a short tail at the bulb's height; the top bevel leaves the corner
    arc faintly warm and turns to the window's cool light along its far part (its middle stop is
    an even mix of the two, so dawn's rose tints it too), meeting the cool
    glint at the far corner; small glints where the bevels meet (a tiny warm one by the lamp, a
    cool one at the window's far corner); the far bevel is in shade, caught by the window high
    up and the room low down;
  - **the edge** (`::after`, 1px above the contents): light caught inside the slab, brightening
    briefly facing the bulb and otherwise sitting just above the smoke; on the shaded far side it
    is caught by the window twice (high, and again about two thirds down), so it comes and goes
    along its length rather than running even.
  **Balance (Susana: the first build's lamp edge was "too bright and abrasive"):** realism comes
  from many quiet cues, not one loud highlight. The hottest point on the glass stays warm white,
  not yellow, and within about 1.5x the dimmed room's brightest pixel (about 175 sRGB at night);
  the rest of the edge line stays near the room's own range. The dark line inside the bevel is
  what sells the thickness. Check any change at 3x and 1x, at 1440 and 1920, in all three lights.
  On phones the lamp is above the sheet: the top bevel carries its light at `--lamp-x` (a small
  soft point, no squeezed room in it, the brightest thing on the top edge), its two corners are
  quieter and differ (a small warm glint by the lamp's side, a fainter cool one on the other),
  both sides are in shade and their curves are gone 40% of the way down, and the room still hangs from the top edge. Midday turns the lamp down and the
  window up; dawn tints the window's light. The panel sets `data-light` from the scene's time.
  No `backdrop-filter`, `filter`, blend mode or `will-change` on it, and nothing on the glass
  animates once the sheet lands: the room behind animates, and a blur would be redrawn on every
  frame (see the flicker notes in §6). Body text keeps at least 10:1 against the brightest of the
  glass behind the reading column. 20px corners (18px on phones). Behind it the room is dimmed by
  a 50% backdrop.
  Top bar: section names as plain text tabs in Geist at 15px (current one underlined by a single
  Vermilion Ink mark that glides between tabs) and a plain "Close ×" (just the × on phones,
  still named). The bar's only line is the reading-progress hairline, in quiet ink, on pages
  that scroll. Header: just the title in Geist Serif; no "02 / 06" counter, no reading time, no
  summary and no rule under it (the tabs already say where you are). A section can place one
  picture beside the heading (`HeaderArt`). No footer.
- **No dividers inside pages.** Space does the grouping, in three named rhythms on `.panel`:
  0.5rem between lines of a group, 1.5rem between parts of an item, 3rem between groups.
- **Tab row on phones:** it scrolls sideways and always rests on a whole tab, with a fade at its
  end. Its start fades only when the row stops mid-word (possible only at its very end), so a
  cut word never shows and a whole tab is never faded.
- **Lists inside panels:** never cards and never ruled. Items are set apart by space, with small
  numerals in a narrow left column (in Experience they stay quiet ink until their book is chosen,
  then ink in vermilion with a 2px vermilion line drawn across the top of the entry).
- **About:** the portrait is a small print on light paper turned 1° (8.5rem wide; 5.5rem and
  1.5° on phones; under the heading below 360px), rendered in the shared header (`HeaderArt`).
  From 640px up, the greeting and the lead form one column on the left and the print stands
  on the right beside both (the page is a two-column grid; header and section take its rows
  through subgrid). On phones the print sits beside the two-line greeting and the lead runs
  full width below. The lead is in the reading face (`--font-serif`, now Geist) at the lede's
  19px, then four paragraphs of body at 17px.
- **Contact:** a short note centred on the glass, across and down (the page fills the sheet's
  view and sits in its middle; taller than the view, it starts at the top and scrolls). The
  greeting and the intro (the lede, centred with balanced lines) on one axis, then one small
  still life kept together as a group in the middle: "Let's chat" in Geist Serif (clamp 1.5→1.75rem), which is the email link itself (subject
  filled in, the address never printed on the page), with "Or find me on LinkedIn" under it;
  and beside them the room's own painted coffee cup (`coffee-still.webp`, the object that opens this page) with
  the halo the lamp gives it in the room, a pool of lamplight around the coaster and a contact
  shadow, its foot on the LinkedIn line's baseline. Reaching for either answers in both: the
  vermilion underline draws in, the cup lifts 2px and its halo brightens. The cup is the email
  too, for a pointer only; keyboards and screen readers get the one "Let's chat" link. No
  animation, filter or blend mode on it. The earlier drawn flat mug is gone.
- **Bookshelf:** each shelf is a row of book spines standing on a 6px walnut board
  (#68432F). Spine colours come from the room (walnut, terracotta, orchid rose,
  sweater teal, slate evening, lamp ochre, card, ink). Titles run vertically in Geist 600 and
  authors in Geist 500. A spine lifts 6px on hover and 10px when open; its note opens beneath
  the shelf.
- **Music:** three blocks, each headed by a serif section title with nothing under it (no
  counts, no descriptions). "What I'm listening to" is the deck: the room's record player drawn
  in CSS, lit by the lamp (a sheen across the walnut plinth and the vinyl, a warm top rim, a real
  shadow and a soft pool of lamplight around it on the panel, as the coffee has on Contact), with
  the track beside it as one link to Spotify; without a live feed it shows the record chosen in
  `content.ts`, labelled "On the turntable". "On my shelf of records" and "On my podcast shelf"
  are sleeves standing on a walnut board, flipped through with the pointer, a finger or the
  arrow keys; choosing one takes it out to the desk below with its notes and an opt-in Spotify
  player. Podcasts come out as a cover only, with no record. Only the sleeve pointed at is
  named, and on the podcast shelf its kind is not repeated ("Podcast" is never shown as a label).
- **Things I've built (Work): her tablet.** A tablet in landscape, drawn front-on in CSS (no
  photo): a thin matte champagne aluminium edge with a highlight on its right side (the lamp is
  upper right), an even ink bezel with a camera dot on the long top edge, resting in a small walnut
  stand on the shared walnut board, shadows falling down-left. The screen is at least about 4:3
  and grows if its content needs more. It is a warm dark desktop (never black or violet) with a
  low band of three flat hills in walnut, terracotta and rose, the painted wallpaper translated
  into room colours with no gradient. The tablet is exactly as wide as the text column (the board reaches a
  little past it) and sits 48px under the intro. Files at the top, the info centred beneath them,
  the browse control centred at the foot of the screen. Three equal files are in view at a
  time: the drawing and the name in Geist at 500 (a file is an item, under the page's serif
  title), names always given two lines' room so nothing shifts. Choosing a file selects it: a
  thin warm ring round its drawing (a 180ms change, never an underline); choosing the selected file again opens its window. Keyboard focus also selects. Hover
  only lifts and brightens a file a touch. Below the files, one compact fixed-height info area shows
  the selected project's one-line description (no repeated title) and "Explore project": a link
  with ↗ to the live project where one exists, otherwise a button that opens its window. Below it,
  the browse control: two round chevron buttons (clearer on hover) and a dot per position. No status
  tags anywhere. Area-of-focus names are not shown. Opening a file pours a
  window out of it, a step lighter than the panel (Raised Smoke), in a short, transform-only
  genie (~0.45s, width leading height; reversed in ~0.3s, reversible mid-way): three muted dots, the title and "Put it back" in its bar;
  the drawing on the left, title, line, summary, topics and link on the right. The screen
  grows to fit; nothing scrolls inside it. The other files fade and are unreachable while it is
  open. Escape puts it back before the panel closes; focus returns to the file; arrows, Home and End
  move between files. On phones the stand and board drop away, the tablet frames one column with the
  drawing beside each title, the hills become a thin strip, and a file unfolds in place beneath
  itself. Reduced motion: no travel or scale; the window cross-fades (~0.15s). No filters or
  backdrop-filter on large areas.
- **Links and buttons:** text-first. Underline in Vermilion Ink at 1px with a 0.25em offset. No
  boxed outline buttons, no pills, no filled CTAs except the player disc.
- **Empty and loading states:** a missing feature hides itself on the live site rather than
  showing placeholders. Loading uses a flat Card Shade block of the final size, with no spinner.
  Development-only notes use a dashed Vermilion Ink border and never ship.

## 5. Layout Principles

- **Homepage, desktop:** a single first screen with no scrolling. The masthead sits above the
  room, as wide as it. The room is shown in a cinematic 1.9:1 frame on its 16:9 canvas
  (`ROOM_VIEW`), about 92% of the window wide, at most 1440px, and short enough to fit the first
  screen with the masthead and the row beneath it (never narrower than 40rem on screens taller
  than 560px). Below it, a three-column grid `1fr auto 1fr`: the player centred on the room's
  axis, the copyright right.
- **No navigation bar beyond the masthead.** The room is the main way in; the masthead's three
  text links (About · Work · Contact) are the only other one, and panels carry their own section
  tabs.
- **Panels:** a single reading column with max-width 36rem (`--measure`) and padding of 3rem
  top and clamp(1.5rem → 2.75rem) at the sides (`--page-pad`). Two columns are allowed only for short paired items (values, music notes).
- **Spacing scale (4pt):** 4, 8, 12, 16, 24, 32, 48, 64, 96px. Tight within groups, generous
  between them.
- **Responsive:** at ≤ 639px the masthead stacks (name, then the menu and the scene control on
  rows of their own), the row beneath the room becomes one column (the player as wide as the
  room, then the copyright) and the room goes almost full-bleed.
  Never any horizontal scroll. Touch targets are at least 44px.

## 6. Motion & Interaction

- **One set of tokens** (`src/styles/tokens.css`). Use them before writing a literal.
  - Curves: `--ease-out` `(0.23, 1, 0.32, 1)` for entering and feedback, about four motions in
    five; `--ease-exit` `(0.4, 0, 1, 1)` for leaving, paired with a linear fade over the whole exit
    so nothing travels unseen; `--ease-drawer` `(0.32, 0.72, 0, 1)` for the sheet, drawers and the
    record's flight; `--ease-sine` `(0.45, 0, 0.55, 1)` for the room's crossfades and ambient
    motion (the CSS twin of `easeInOut()`); `--ease-drift` `(0.33, 0, 0.2, 1)` for words that
    float away; `--ease-in-out` only for the turntable arm. Plain `ease` for colour and opacity.
  - Durations: `--dur-quick` 160ms (press, colour, focus), `--dur-soft` 240ms (hover, tooltips,
    small exits), `--dur-panel` 460ms (the sheet, drawers, the page entrance), `--dur-panel-exit`
    260ms (leaving is quicker than arriving). The room keeps its own slower clock: 900ms for the
    entrance, 1800ms for a time-of-day fade, 2600ms for rain.
- **JS never copies a timing.** A timer that waits for a motion reads it from the computed style
  through `src/lib/motion.ts` (`transitionMs`, `animationMs`, `cssToken`), with a fallback only
  for when there is nothing to read. Change a timing in the CSS and the JS follows, reduced
  motion included.
- **First arrival only:** the room fades in from opacity 0 and scale 0.99 over 900ms. No blur
  over the room: on a large Retina screen it made the browser drop parts of the picture for a
  frame. The name rises 6px over 600ms from 160ms; the player and copyright follow at 260 and
  320ms (the footer's third child, the "Explore the room" chip, keeps its own later delay,
  `--hint-delay`, so it lands after the halo sweep). The greeting floats once.
- **The panel:** the sheet slides in 3rem (rises from below on phones) over `--dur-panel` on the
  drawer curve and is solid within 200ms (140ms on phones). It leaves over `--dur-panel-exit`
  (320ms on phones) on `--ease-exit`, and the dialog is removed when the sheet's own fade ends,
  never on a timer alone. The room dims by opacity under a 50% backdrop, never by repainting a
  colour: 460ms after 40ms in, 240ms out so it finishes before the sheet. This is the motion on
  phones and touch, with reduced motion (a short crossfade), for a deep link on load, without
  WebGL2, and whenever the genie below can't vouch for its picture of the glass.
- **The genie (wide screens with a mouse, `src/components/SectionPanel/genie/`):** the glass
  slab pours out of the object that was clicked and back into the object of the page shown. One
  signature curve, no overshoot, no bounce; three layers (the slab, its shadow, its light).
  - Open (ms from the click): 0-100 the object's own halo warms a touch (nothing moves, the room
    never does); 100-650 the slab pours along one calm S-curve, `(0.4, 0, 0.22, 1)` per slice,
    the far edge leading and the near edge following out of the object (`lag` 0.32). It starts
    as a small piece of the same smoked glass in the object's heart, visible from the first
    frame, that swells to the neck over the first 13% of the move before anything leaves. From
    objects left of the dock (the turntable, her) it pours as a funnel: a narrow stream across
    the room that fans out to the slab's full height only over the last 40-60% of the way to the
    dock, so it never stands in the room as a tall sheet over her face. It is the settled slab's
    material all the way: the piece is 82% opaque and solid by a third of its travel, and the
    neck and stream take the slab's own mean smoke rather than a lighter, milkier average of its
    lit edge (2.5% of the lamp's warmth is all it carries). Its travelling edges are soft (10%
    along the travel, 7% across, up to 2.6 times that in the object so the piece and the neck are
    a soft pool of glass, not a card; gone as each part lands), so it never reads as cut paper.
    Objects under the dock (the cup, the laptop, the desk books at 1440) make it rise out of the
    object and then widen. The contact shadow trails the slab by 50ms; the lamp-side glint lights only
    as the slab's lamp edge arrives under the bulb, up to its resting level and no further. On
    landing the lamp's light sweeps once across the slab from its lamp edge (300ms, faint: 4.5%
    warm white, under the text). The real sheet takes over at about 950ms, pixel for pixel.
  - The contents rise as it lands (from about 520ms): bar, header, then the page's blocks, 35ms
    apart (the cascade under 200ms), 8px over 300ms on `--ease-out`; readable by about 800ms.
    The dim arrives with the pour (560ms after 100ms). The retimed entrance (`data-genie-rise`)
    stays on until the panel closes: taking it off once the contents had landed handed them back
    to the page's own entrance, which started again from nothing (the blink at the end of every
    open). Contents held hidden after a reopen come back by a transition, never by a second
    animation, for the same reason.
  - Close (about 72% of the opening): the contents fade over 100ms, then the slab pours back on
    an accelerating curve, `(0.5, 0, 0.78, 0.42)`, over 370ms while the dim lifts in step. It is
    the opening backwards: the slab narrows into the stream as it leaves the dock, and the last
    20% (about 75ms) is a small piece of glass shrinking into the object, which the halo's one
    glow answers. Only then does the dialog close (SectionPanel awaits the genie's promise, and
    closes it whether the slab got home or the pour was cut short, a lost GPU say, so the modal
    is never left open over an inert room). Tabs keep their quick page turn: no pour.
  - Escape or Close mid-pour turns it round from where it is; coming back mid-close pours it out
    again. A first frame that comes late (the page mounting) delays the pour rather than skipping
    its start.
  - How: at idle once the room has settled, a stand-in of the panel is dressed as at open and its
    glass (the sheet, its pseudo-elements and decoration spans, read from the live CSS, its
    images inlined first, since an SVG image loads nothing itself) is drawn
    through an SVG foreignObject into three pictures: the slab without the lamp's glint, the
    glint alone (cropped), and its shadow. A WebGL2 canvas inside the dialog (above the dim,
    under the sheet) warps them on a 128x128 mesh. It is prepared again after a resize, a new
    light or weather, or a stylesheet change, and an open is refused (today's slide runs, and it
    prepares again) if the dialog, the glass, the window or the screen's pixel density no longer
    match, and a move under way when the window resizes ends at once where it was going. The
    glint is painted lit only over a 48px strip on the lamp edge. Every painted slab is checked
    before it is trusted (nearly opaque, a deep smoke, some texture: a picture drawn without its
    images is refused), and a probe checks once that the browser draws images inside a
    foreignObject at all. It runs only in Chromium browsers for now: Safari and Firefox keep the
    slide until it has been verified there (`localStorage['panel-genie'] = 'on'` or `?genie` turns
    it on to check, 'off' turns it off anywhere). Textures and the canvas's back buffer exist only
    during a move. The live room is never transformed or filtered; no
    backdrop-filter, no will-change.
- **The room stays still while a page is open.** No transform, scale or filter on `.cover` or
  the room behind the sheet: scaling the whole room made pages flicker as they opened and closed
  on Retina. The deeper backdrop is what sets the page apart.
- **Page entrance, one coordinated movement:** the incoming page arrives as one piece, header
  and content together, with no paragraph-by-paragraph cascade. On open it rises 12px and fades
  in over `--dur-panel` from 120ms. On a section change the old page fades over 180ms and slides
  14px away over 260ms; from 60ms the new page moves 18px with the direction of travel over
  380ms. (`--i` is still read, so a section can give itself one deliberate beat; none does
  today.) Opacity only under reduced motion. No blur inside the scrolling panel.
- **The turn as one move** (`turn-fx.css`, `liquidInk.ts`, `turnLight.ts`; timings and curves are
  tokens there, which the JS reads):
  - The tab's vermilion mark sets off first, at 0ms, and flows like a drop of ink over 460ms. Its
    leading edge runs to the far side of the new tab on `--ease-drawer` (it answers the click at
    once, with a little weight; home by 50%), so for a moment it reaches across both tabs. Its
    trailing edge lets go at 12% and gathers in on `--ease-sine`, home by 84%. It thins a little
    while stretched, is back to its full thickness as it gathers, then swells once as it settles
    under the tab (up to 1.3x tall, from its foot, at about 400ms) and eases to exactly its own
    size. Neither edge passes the new tab, and nothing bounces. One Web Animation of its
    transform. A turn made mid-flow sets off from wherever it is, with no pause; a resize reported
    mid-flow lets it finish.
  - The lamp's light passes once through the glass as the pages exchange: from 10ms over 480ms on
    `--ease-sine`, in the direction of travel, its heart crossing the reading column at about
    200-260ms. It is a broad, soft, leaning band in the lamp's own warm colour
    (`oklch(0.84 0.075 66)`) under the page, fading with distance from the bulb, with a catch of
    it in the slab's edge line. Forward it leaves the lamp bright and fades as it goes; back it
    holds until it reaches the lamp and fades into it. Measured on the slab: about 6-7/255 beside
    the lamp and 3-4/255 across the reading column, about the lamp's own bloom; the text itself
    changes by under 1/255. Its strength is the layer's opacity (`--turn-light-face`, `-edge`;
    three quarters at midday, 0.8 on phones) and the band is drawn at full scale, so the faint
    result is quantised only once; a still grain in its mask dithers away 1/255 contour steps.
    Two layers made for the pass inside the sheet, moved by transform and opacity only, removed
    when it ends or when the panel closes. A turn mid-pass carries the same light on, or back.
  - Everything has settled by about 490ms, and the new page is readable as early as before.
    Reduced motion: no light, and the mark is placed at once. The genie's open and close don't
    use either.
- **Layers:** no `will-change` on the woman's clips (on their own layer Chrome dropped her for
  single frames on Retina) and no new large GPU layers (`will-change`, `translateZ`, `filter`,
  `backdrop-filter` on big elements). `.cover .stage { transform: translateZ(0) }` is deliberate,
  for Safari's rounded clip.
- **Susana's lines:** her greeting ("Hey there, I'm Susana") is brief: the same `greet-float`
  over 3 s. As it is almost gone (2.3 s in), her second line, "Make yourself at home, have a look
  around", floats up in the same place with the same style and the full 4.6 s float. Nothing
  interrupts these two: they play through whatever the visitor points at meanwhile, hovering her
  included; her hover lines wait until they're done. Everything else she says only when she's hovered (or focused): each time a new
  line with the same float, never the same twice running, about something in the room not found or
  opened yet, saying where it is and what it holds ("You can find some of the books I love on the
  bookshelf."), a touch smaller than her greeting (about 15px against 17px on a laptop). Longer
  lines wrap onto two balanced, centred lines (17em at most). What she
  mentions answers her as she says it: a section object breathes (its amber halo swells about two
  thirds of the way to its hover glow and settles, the object lifting by a hair, about 3.8 s; not
  with reduced motion); a glimmer gives its hint. When nothing is left to find or open she says her
  usual "Hey there, I'm Susana". The lines live in `content.susana`; they are hers, in her voice
  (the glimmer rule against instructions is for the objects' own hints). The old nonstop
  `halo-breathe` invitation and the timed section breaths are gone; each `glow.invite` in
  `scene-layout.json` is unused.
- **Texture:** a 5% light grain on a fixed layer behind the page (never over the painting); a
  7% grain and slow smoke clouds painted into the panel's smoked glass.
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
- No navigation bar or menu on the homepage beyond the masthead's three quiet text links (About ·
  Work · Contact); no "Explore the room" toggles, tracklists or "Side A / Side B" gimmicks.
- No quote-style taglines with a vertical rule, no italic hero statements over the room.
- No uppercase wide-tracked labels (the masthead's disciplines line and menu are the one
  existing exception, see §3), no condensed grotesks, no third font family.
- No cream-paper + serif + sage green; the only accent is the record-label vermilion.
- No pure black (#000000) or pure white (#FFFFFF); no cool zinc or slate neutrals.
- No gradients on text, no neon, no glows. No translucent, blurred glassmorphism on the panel:
  its smoked glass is simulated in opaque paint (§2, §4). Susana chose it after a design review
  with three prototypes and critics, replacing the cream "Uncoated Card" paper and the earlier
  rule of no gradients on surfaces.
- No card grids of icon + heading + blurb; no three equal feature cards.
- No overlays covering the woman, cat, laptop or record player; never crop or alter the painting.
- No invented facts: no fake employers, dates, metrics, testimonials, emails, links, books or
  tracks. Empty content hides; samples exist only in development and are labelled as such.
- No AI copy clichés ("elevate", "seamless", "unleash", "transform your…"), no filler such as
  "Scroll to explore" or bouncing chevrons. The copy has had an unslop pass: tightened, with no
  AI phrasing.
- No section summaries under page titles (the `summary` on each section in `content.ts` is no
  longer shown), no counts, no labels that repeat what the heading already says
  (such as "Podcast" on every show), no descriptions under shelf headings.
- No autoplaying sound, ever.

## 8. Deliberate Overrides of Generic "Premium" Defaults

These are Susana's decisions and take precedence over any generic design-agent guidance:

| Generic default | This site | Reason |
| --- | --- | --- |
| Modern serifs only (Fraunces, Instrument Serif…) | Geist Serif (one weight, no italic) for titles + Geist for everything else | Chosen by Susana. Funnel Display + Funnel Sans came first, then Newsreader + DM Sans; a judge panel preferred keeping Newsreader + DM Sans, and Susana chose Geist. The serif stays upright and is kept to titles; the sans carries all reading and interface text |
| Zinc/Slate neutrals | Warm neutrals tinted toward the record label | Taken from the illustration so the UI belongs to the painting |
| Asymmetric split hero with inline-image headline | The centred room is the hero and the navigation | The painting is the statement; nothing competes with it |
| Perpetual micro-interactions on active components | Calm; only the painting and the progress ring move | The room is already alive; the UI should be quiet |
| Spring physics everywhere | Strong CSS ease-out curves | Transitions are short, predetermined and run smoothly off the main thread |
| Double-bezel on every card | No double bezel: one floating sheet of simulated smoked glass; the room is frameless; lists stay flat, set apart by space with no rules | One quiet object over the painting; framing everything would read as an app |
| Pill CTAs with arrow "islands", eyebrow badges, floating glass nav | None; text links, one round player button, a masthead with three text links | Explicitly rejected by Susana as unnecessary or "slop" |
| Desktop nav → mobile menu | The room is the main way in; outside it only the masthead's three text links, which wrap onto their own row on phones | Susana wants discoverability to live mainly in the illustration |
