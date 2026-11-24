# Susana Pérez Posada — illustrated portfolio

An interactive personal website built around a single hand-painted room. Visitors explore by
touching objects in the room: each opens a section in a paper panel that slides over the scene.
A slim masthead above the room holds the name, a quiet menu (About · Work · Contact) and the
scene control (time of day and weather); a small player sits beneath it. Every object is a
real, labelled link for keyboards and screen readers, touch screens get a small dot on each
object and a larger tap area, and once a panel is open its tab row moves between all sections.

| Object in the room | Tooltip | Opens | URL |
| --- | --- | --- | --- |
| Laptop | "My work" | Selected work | `/#work` |
| The woman at the desk | "Hey there, I'm Susana" | My story (About) | `/#about` |
| Books on the desk | "My experience" | Experience | `/#experience` |
| Books on the shelf | "My booklist" | Bookshelf | `/#bookshelf` |
| Record player | "What I'm listening to" | Music | `/#music` |
| Coffee mug | "Let's chat" | Say hello (Contact) | `/#contact` |
| Desk lamp | "Switch the light" | Changes the lamp's light | |
| Sleeping cat | "Pet the cat" | The cat stirs, then settles back to sleep | |

## Run it

Requires Node 22.12 or newer (Node 22, 24 or 26), as Vite and Vitest do.

```bash
npm install
```

```bash
npm run dev
```

Then open <http://localhost:5173>.

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload, plus the dev-only tools below |
| `npm run build` | Type-checks and builds the static site into `dist/` |
| `npm run preview` | Serves the production build locally |
| `npm test` | Unit tests (routing, hotspot geometry, content rules) |
| `npm run typecheck` | TypeScript only |
| `npm run spotify:auth` | One-time Spotify sign-in for "What I'm listening to" (see `docs/spotify-now-playing.md`) |
| `npm run scene:trace` | Re-trace the clickable outlines of the overlays after moving one (needs Pillow) |
| `npm run scene:glows` | Rebuild the precomputed amber halos and highlights (needs Pillow + numpy) |
| `npm run hotspots:preview` | Render the assembled scene with every outline to `docs/hotspot-preview.png` |
| `npm run scene:cat`, `scene:woman`, `scene:coffee` | Rebuild the cat's, the woman's or the coffee's animation from the raw exports |
| `npm run scene:window`, `scene:windows` | Rebuild the window's glass layers, or the dawn / midday / night views outside it |

The `scene:*` builders (Python, needing Pillow and numpy) read the raw artwork from
`portfolio-website-assets/`, which is too large for Git and is not in the repository; they only
run on a machine that has it. The built media in `public/media/` is committed, so the site
itself builds and runs from a fresh clone.

Nothing has been deployed. `dist/` is a plain static site that works on any static host
(Netlify, Vercel, GitHub Pages, Cloudflare Pages) with no server configuration, because
sections use URL hashes.

## Editing content

All copy lives in one file: **`src/content/content.ts`**. Types are in `src/content/types.ts`.

- Optional fields (`organization`, `period`, `href`, `email`, `links`, `education`, …) are
  simply not shown when empty. Fill them in and they appear.
- In development, the browser console prints a **Content checklist** of what still needs your
  input. Nothing about it appears on the page or in the production build.
- The About and Music copy are drafts written in your voice from the brief. Please read
  them and make them truly yours.

### Before publishing: what only you can supply

The draft deliberately invents nothing, so these are empty right now:

1. **Contact details** (`contact.email`, `contact.links`): a public email address and any
   profiles (LinkedIn etc.) you want listed. Until then the Contact panel shows a short
   "details coming soon" note and no links.
2. **Experience details** (`experience.entries[*].organization` / `period` / `location`):
   employers, dates and locations for each thread, if you want them shown. Add or reorder
   entries freely. Add `experience.education` entries if you want an Education list.
3. **CV**: put the PDF at `public/cv/susana-perez-posada-cv.pdf` and rebuild. The
   "Download CV" button appears only when that file exists.
4. **Case studies** (optional): add `href` to any work theme to link it.
5. **Books** (`bookshelf.books`): title, author, shelf (`reading`, `loved` or
   `recommended`) and an optional note in your words. In development the shelves show
   clearly labelled sample spines so you can see the design; the live site shows only yours.
6. **Record collection** (`music.collection.items`): paste Spotify share links (Share → Copy
   link) to albums or playlists. Covers and titles load from Spotify automatically; add a
   `subtitle` (artist) and an optional `note`. Choosing a cover opens Spotify's own player.
   In development the grid shows labelled sample sleeves; the live site shows only yours.
7. **Spotify "What I'm listening to"**: connect it by following
   [docs/spotify-now-playing.md](docs/spotify-now-playing.md). Until then it stays hidden.
8. **Music links** (optional): add `link` to a music card only for content you own or are
   free to share.
9. **Social preview image**: once you have a domain, change `og:image` in `index.html` to an
   absolute URL (e.g. `https://your-domain/media/scene/room.webp`); most link previews
   require that.
10. **Illustration credit**: if the artwork's licence asks for attribution, add it to
   `footer.note` in `content.ts`.

## How the room works

```
src/
  App.tsx                       page shell: masthead, room, player, panel
  content/                      all text + types + the dev checklist rules
  scene/
    scene-layout.json           where every overlay sits on the 1920×1080 canvas, and its media
    hotspot-geometry.json       hotspot outlines in canvas coordinates
    layout.ts, hotspots.ts      typed access + helpers (incl. the room's 1.9:1 framing, ROOM_VIEW)
    windowViews.ts, weather.ts  the view through the window by time of day; rain and snow
  components/
    Masthead/                   name, menu and the slot for the scene control
    HeroScene/                  the room (HeroScene.tsx) and its clickable outlines (HotspotLayer)
      overlays/                 the woman, the cat, the coffee, the record player, the laptop's terminal
      lamp/                     the desk lamp's light (a shader, with an SVG fallback), tint and splash
      window/                   the view through the window, its lights, and the rain and snow
      controls/                 SceneControl: time of day and weather (drawn in the masthead)
      dev/                      ?debug=1 outlines and ?sandbox=1 placement (development only)
    SiteFooter/                 the player beneath the room, and the first-visit cue
    SectionPanel/               the <dialog> panel
    sections/                   one lazily loaded component per section; books/ holds the book
                                drawing shared by Bookshelf and Experience
  hooks/                        URL section, media queries, room playback, Spotify feed
  lib/router.ts                 tiny hash router with tidy history
  styles/                       tokens (palette sampled from the artwork) + base
server/, api/, netlify/         the "now playing" endpoint (one implementation, two hosts)
scripts/                        offline builders for the scene's media (Python) and Spotify sign-in
```

**Media.** Everything lives in `public/media/scene/`. The room is a still painting
(`room.webp`); the objects are transparent overlays on one shared 1920×1080 canvas
(`src/scene/scene-layout.json`), and the whole canvas scales as one unit, so the overlays and the
clickable outlines can never drift apart. Nothing is stretched. The woman, the cat and the coffee
steam are short animated WebP clips built offline from the raw exports (see the `$comment`
entries in `scene-layout.json` for how each was made); with reduced motion or a paused room each
shows its first frame.

**Framing.** On the page the room is a cinematic 1.9:1 frame on the 16:9 canvas: the full width
shows and a thin band is hidden above and below (`ROOM_VIEW` in `src/scene/layout.ts`; nothing
that can be hovered or clicked is in it). On desktop it is about 92% of the window wide, at most
1440 px, and never taller than the first screen allows.

**The window.** Through the glass the view follows the visitor's own clock (dawn, midday, night)
until they pick a time in the scene control. The weather (clear, rain or snow; rain by default)
falls only behind the glass. By day, rain and snow re-colour the sunny view to an overcast sky.
Everything that moves pauses when the tab is hidden, the room scrolls out of view or the visitor
pauses it, and holds still with reduced motion.

**Discovery.** The objects are softly lit by a warm amber halo traced from each silhouette
(precomputed images, nothing filtered live). On hover or keyboard focus an object grows about 4%
from its base and a small tooltip appears (Escape hides it). Once per visit the objects glow in
turn after the room loads, and a small "Explore the room" chip rests inside the room's bottom edge
until the first interaction or until it is dismissed. Touch screens and reduced motion keep the
glow without the growth. Strengths live in `glow` per object in `scene-layout.json`.

**Room video (optional).** Setting `media.video` in `scene-layout.json` brings back an animated
room: it plays muted at `playbackRate`, each frame dissolving into the next, and its loop's wrap
dissolves too. With reduced motion or Save-Data it starts as the still poster and the video is
not requested until the visitor presses Play. If the poster fails, a quiet lamplit fallback shows.

**Panels and history.** Opening an object sets the URL hash (`#music`), so sections are
deep-linkable and Back/Forward work. Close, Escape and clicking the dimmed room all return to
the room; if the previous history entry was the room, Close steps back rather than piling up
entries. Focus moves to the section heading on open and back to whatever opened it on close.

### Adjusting hotspots

Outlines are polygons in `src/scene/hotspot-geometry.json`, in canvas pixel coordinates. Most
are traced automatically from each overlay's transparency (`npm run scene:trace`). A hotspot can have several polygons, combined with the even-odd rule: the
polygon drawn inside another cuts a hole in it. `label` sets where the hover annotation attaches
and on which side it sits.

- Open <http://localhost:5173/?debug=1> (development only), or press **D**, to see each overlay's
  box with its position and size, every outline with its vertices and tag anchor, and a live
  readout of the pointer position in canvas coordinates. Edits to the JSON hot-reload.
- Move an overlay in `src/scene/scene-layout.json`, then run `npm run scene:trace` and
  `npm run scene:glows` so its outline and halo follow.
- `python3 scripts/preview-hotspots.py` (needs Pillow) writes `docs/hotspot-preview.png`,
  the outlines drawn on the poster.
- `npm test` checks that hotspots don't overlap (except where two overlays genuinely touch, and
  then the one painted on top takes the click), every point is inside the picture, outlines stay
  tight, each overlay outline still matches its overlay, and the layer order is right.

## Accessibility

- Semantic landmarks and one `h1` (the name in the masthead); each panel has its own `h2`.
- Every navigational hotspot is a real link with an accessible name ("Selected work: open
  Work (the laptop)"); keyboard focus traces the object's outline in lamp colour.
- The panel is a native modal `<dialog>`: the page behind becomes inert, Escape closes it,
  focus is managed on open and close.
- The scene control is two radio groups (time of day, weather), operable with the arrow keys.
- Reduced-motion preferences are respected: the room, the weather and the interface hold still or only fade.
- The illustration has a full text description for screen readers.

## Design notes

See `.impeccable.md` for the design brief. The room sits on a near-black page with softly
rounded corners, under an editorial masthead (name, menu, scene control); beneath it are a low
liquid-glass player bar (centre) and the copyright (right). Panels are off-white card with near-black ink and one spot colour, the vermilion of
the record label in the illustration.

**Type.** Newsreader for the name, headings, ledes and book spines, DM Sans for navigation,
body paragraphs and controls (chosen by Susana; upright only, no italics anywhere). Both are self-hosted, so
there are no third-party requests. To change them, edit `--font-display`, `--font-serif` and
`--font-sans` in `src/styles/tokens.css` and the imports in `src/main.tsx`.

**Motion.** Strong ease-out curves; hover feedback ~200ms; panels arrive in 420ms and leave
in 240ms; the room settles in once on first load; buttons press down slightly; hover effects
only on devices with a real pointer; reduced-motion keeps fades and drops movement.
