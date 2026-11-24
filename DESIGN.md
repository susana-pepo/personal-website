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

The panel is one opaque sheet of dark "smoked glass" taken from the room at night. `.panel`
(`SectionPanel.css`) redefines the `--card` and `--ink` tokens for everything inside it, so the
sections keep writing `var(--ink)` and `var(--card)` and read correctly on the dark surface. The
cream root values in `tokens.css` (#EFECE8 card, #1B1613 ink) are overridden inside the panel.
- **Smoke** (#29211C, `--card`) — the panel's ground. The sheet itself is painted with a 150°
  gradient from #342923 to #1B1412, a faint bloom of lamp light at the top left, a little more
  shade toward the bottom and a 7% grain so the gradient reads as a material and never bands.
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
  titles (`--text-title`, clamp 2.5→3.75rem), the titles of a page's parts (`--text-section`,
  clamp 1.4375→1.75rem: Music's shelves, Experience's second pile, a page's subheads), the
  wordmark in the masthead, the few invitations set like titles ("Let's chat" on Contact), and
  the Bookshelf's shelf names.
  Large serif type sits a little tighter: `--track-title` is −0.025em. The one weight is never made bolder; size and full ink carry it.
- **Everything else: Geist** (`--font-sans`, variable 100–900). Reading text, ledes, item
  titles (500), the room's labels and the greeting, navigation, tabs, the scene control, the
  player, metadata, copyright, the Work tablet's file names, the open book's title and Reading
  now's title (500), and the lettering on every spine, on the Experience desk and on the
  Bookshelf (600 for titles, 500 for authors and years), so it reads like foil stamping.
  Tabular numerals for any time or count.
- **`--font-serif` is the reading voice**, kept as its own token so a page's lead can move
  without touching the rest. It now resolves to Geist, so reading text is in the sans.
- **Floors:** body text 19px (1.1875rem) on About, 17px (1.0625rem) elsewhere in the panels; panel
  tabs 15px; metadata at least 14px inside panels. Reading text has line-height 1.6 and is
  capped at 58–62ch.
- **Hierarchy:** item titles (the sans at 500, about 1.25–1.5rem) always stay a step below
  section titles (the serif at `--text-section`), so an entry never competes with the heading
  over it.
- **Scale:** 0.75 / 0.875 / 1.125 / clamp(1.3→1.55) / clamp(1.9→2.6) / clamp(2.8→4.6) rem, plus
  the two title tokens above. Ratio ≥ 1.25 between steps.
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
  section: today the cat (pet it) and the lamp (click it). They have no halo and no label, so each
  has a *hint*: a small sign of life that makes a visitor curious, never an instruction (no hands,
  arrows, rings or words like "click"). One rule for all of them (`src/scene/glimmers.ts`):
  - **Moonlight is theirs.** Every hint is drawn in one soft moonlight blue (`--moon`, with a faint
    `--moon-bloom` edge on its own small marks) that nothing else in the room uses. Sections
    breathe amber, so the colour alone says "a different kind of thing".
  - **In its own nature.** The sleeping cat breathes out three z's, bold rather than big (Geist
    700, about 18 → 23 → 29px on a laptop), drifting up from its head. The lamp's bulb catches,
    a soft dip and back and a smaller one, as if a switch had been touched, and three four-point
    glints twinkle up its brass.
  - **The room's pace.** Hints ease in over most of a second, out of a slight blur like her
    greeting, drift on `--ease-drift` or breathe on `--ease-sine`, and fade as they go: never held,
    never snapped. Each covers about the same area, on the window side of its object.
  - **Looped while unfound, one at a time.** Every 9 s, the unfound ones spread evenly across the
    cycle. The first comes once the room's first look and her greeting are over (the greeting's
    timing never moves). Never while a page is open, the room is paused, the tab is hidden or
    something is pointed at; that turn is skipped. With reduced motion a hint fades where it
    stands.
  - **Their own cursors.** With a mouse over a glimmer, the cursor is drawn in the room's ink
    (cream, warm-brown line; `GlimmerCursor`). Over the cat it is a hand that strokes, gliding
    along its fingers and back, and a click pats. Over the lamp it is a little bulb that flicks
    on now and then (on, a catch, on), glows a moment with a small moonlight spark and eases
    off; it stays on while the button is down. Over the piano it is two beamed notes swaying
    in time, with a moonlight spark on the beat; a press makes them hop. No glimmer has a hover
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
  from the right and floats clamp(8px → 14px) inside the window edges, min(43rem, 56vw) wide
  (min(43rem, 88vw) up to 1024px; on phones it rises from the bottom, nearly full width,
  leaving a strip of the room above). Chosen by Susana after a design review with three prototypes and critics.
  The glass is **simulated and opaque, not translucent**: a warm gradient with grain (see §2), a
  1px rim of warm lamp light drawn in the border (brightest at the top left corner),
  an inset top highlight, and a directional shadow (a tight contact shadow on the room side, then
  a long fall-off). No `backdrop-filter`, `filter` or `will-change` on it: the room behind
  animates, and a blur would be redrawn on every frame (see the flicker notes in §6). 20px
  corners (18px on phones). Behind it the room is dimmed by a 50% backdrop.
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
- **About:** the portrait sits beside the heading, in the shared header (`HeaderArt`), as a small
  print on light paper turned 1° (8.5rem wide; 5.5rem and 1.5° on phones; under the heading
  below 360px). Then the lead in the reading face (`--font-serif`, now Geist) and the body at
  19px.
- **Contact:** the intro as the page's lede, then one small still life kept together at the
  left: "Let's chat" in Geist Serif (clamp 2→2.6rem), which is the email link itself (subject
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
  colour: 460ms after 40ms in, 240ms out so it finishes before the sheet.
- **The room stays still while a page is open.** No transform, scale or filter on `.cover` or
  the room behind the sheet: scaling the whole room made pages flicker as they opened and closed
  on Retina. The deeper backdrop is what sets the page apart.
- **Page entrance, one coordinated movement:** the incoming page arrives as one piece, header
  and content together, with no paragraph-by-paragraph cascade. On open it rises 12px and fades
  in over `--dur-panel` from 120ms. On a section change the old page fades over 180ms and slides
  14px away over 260ms; from 60ms the new page moves 18px with the direction of travel over
  380ms, and the tab ink glides with it. (`--i` is still read, so a section can give itself one
  deliberate beat; none does today.) Opacity only under reduced motion. No blur inside the
  scrolling panel.
- **Layers:** no `will-change` on the woman's clips (on their own layer Chrome dropped her for
  single frames on Retina) and no new large GPU layers (`will-change`, `translateZ`, `filter`,
  `backdrop-filter` on big elements). `.cover .stage { transform: translateZ(0) }` is deliberate,
  for Safari's rounded clip.
- **Halo invitation (off):** `halo-breathe` lets the halos breathe until the first object is
  found. It is switched off by configuration (every `glow.invite` in `scene-layout.json` is 0);
  raise one above 0 to bring it back. It is kept as an option, not dead code.
- **Texture:** a 5% light grain on a fixed layer behind the page (never over the painting); a
  7% grain painted into the panel's smoked glass.
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
