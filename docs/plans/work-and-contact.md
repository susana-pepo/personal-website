# Work and Contact: a plan to make them feel like their objects

## 1. What I found

- **Work is the only object section that doesn't look like its object.** Music has a crate and a turntable, the Bookshelf has spines, and Experience has piles of books. Work is a paper card grid that could belong to any portfolio, with no screen, bezel or window anywhere. The five drawings are good and already in your style, but they read as prints lying on a desk.
- **The laptop's hand-off is lost.** In the room, the little terminal window rises out of the laptop and types "Things I've built". When Work opens, the panel slides over the laptop, so nobody sees the terminal. The laptop promises something the panel doesn't continue.
- **Work still carries pieces of the old "map".** Each caption still names an area of focus for a map that no longer appears, so captions are uneven. The tiles also wait about 1.2 to 1.6 seconds for that map before they show up. Five tiles in two columns leave Rights Intelligence alone in its row. The intro is set larger than the project titles, so on first view you see mostly title and intro.
- **Contact is a well-set page, not a coffee.** The room's painted mug is only a 56px sticker. Three large serif blocks compete for attention: "Say hello" at 74px, a 4 to 5 line lede, and "Let's chat" at 74px again. On a phone the call to action sits below the middle of the screen.
- **Contact's small parts feel unfinished.** Nothing shows that "Let's chat" opens an email. The steam hover is barely visible at 56px and never happens on touch. The "Elsewhere" band holds a single link, LinkedIn, and its handle is never shown.
- **Strengths to keep in both sections:** the drawings and their one-time gestures, honest statuses, solid accessibility (real buttons, focus order, screen-reader text), the copy-email button with its "Copied" message, and reuse of the room's own painted mug.

---

## 2. Work: recommended concept

### "Her desktop": your grid, on the laptop's screen

**The idea.** The panel shows the laptop, drawn front-on and standing on the same walnut board as the record crate and the Experience pile. Its screen holds the grid you built. Each project is a file lying on a quiet desktop, so the drawings now have a reason to be on a screen: they are previews of documents. Opening a project opens it as a cream paper window on that screen, and "Put it back" returns it. The closed laptop is the overview, and the detail opens on the object itself, the way every other section works.

**What the visitor sees on desktop**
- **Header:** counter, the title "What I've built", the rule, then the intro at a smaller reading size (about 18px, 3 lines). The project titles now outrank the intro, and the laptop's screen appears in the first view.
- **The laptop:** drawn in code with no photo, so it stays sharp and light.
  - Matte champagne aluminium rim with a thin highlight on its right edge, because the lamp is upper right.
  - Dark ink bezel and a tiny camera dot.
  - A thin hinge and base, standing on the walnut board, with the usual shadow falling down and to the left.
  - No logo, menu bar or Apple-style dock.
- **The screen:** a warm dark desktop, not black or violet. A low band of three flat hills runs along the bottom in walnut, terracotta and rose. This echoes the painted laptop's sunset wallpaper, translated into room colours with no gradient.
- **The files:** the screen grows with its content, so nothing scrolls inside it. The five projects sit in two rows.
  - Row 1 holds the two live, public projects at a larger size: Interactive chord builder and PM frameworks guidebook.
  - Row 2 holds Licensing engine, Apartment studio and Rights Intelligence at a smaller size.
  - Each file shows its existing drawing, the title in Newsreader underneath, and a small status line.
  - The orphan tile goes away, and the work you can try gets top billing.
- **An open project:** a cream paper window fills the screen.
  - Title bar: three tiny dots in the room terminal's muted colours (decorative only), the project title, and "Put it back" on the right.
  - Body: the drawing on the left. On the right: status, title, the one-line description, the summary, topics where the project has them, and the external link where one exists.

**What the visitor sees on a phone**
- The board and base drop away. The lid becomes a full-width frame with a thin bezel, the camera dot and a hinge line underneath, so it still reads as a laptop.
- The hills shrink to a thin strip.
- Files stack in one column, each with the drawing beside its title and status. This is today's phone layout, now inside the screen.
- Tapping a file opens its detail in place beneath it, full width, the same "page opens under the book" pattern as Experience. Nothing scrolls sideways, and text never sits inside a drawing.

**What the visitor does**
- Hovering or focusing a file lifts it 2px and plays its drawing's gesture once: the chord plays C-E-G, the tabs slide out, the ledger checks itself off, the furniture slides into place, the pencil draws the edges.
- Click, Enter or Space opens the window, one at a time. The other files dim and can't be reached with the keyboard while the window is open.
- "Put it back", Escape, or choosing the same file again closes the window. Escape closes the window first and the panel only on a second press. Focus returns to the file.
- Arrow keys move between files, and Home and End jump to the first and last.

**Motion**
- **Arrival:** the 1-second wait goes. The laptop arrives with the panel. The screen "wakes": the wallpaper fades in, then the files rise and fade in a soft stagger. Everything is in place by about 0.8s instead of 1.6s.
- **Open:** the window grows out of its file in a short, simplified echo of the room's genie (about 0.45s). Width leads height, so it feels poured out rather than zoomed. The window's text fades in as it lands.
- **Close:** the same path in reverse (about 0.3s). If the visitor changes their mind mid-way, the motion reverses smoothly and never jumps.
- **Reduced motion:** every state stays, but nothing travels or scales. The files are simply there, the window cross-fades in place (about 0.15s), and the drawings show their end state with no gesture.

**How each real project appears.** Text comes from content.ts word for word. Vermilion is used only for "Live".
| File | Status line | Window adds |
|---|---|---|
| Interactive chord builder (keys) | Live, vermilion dot | Link "Try it on Skoove" |
| PM frameworks guidebook (guide) | Live, vermilion dot | Link "Open the guidebook" |
| Licensing engine (ledger) | Internal tool, plain ring | Topics: Rights data, Clearance, Rules as data |
| Apartment studio (plan) | Personal, plain ring | (no link, no topics) |
| Rights Intelligence (network) | Exploration in progress, plain ring | Topics: Work identification, Ownership data, Contract coverage, Reconciliation |

Area-of-focus names are no longer shown. The map and themes stay in content.ts, unused. No menu-bar words, clock, file extensions or app names are added.

**Why this one.** It does what you asked: it keeps your grid and drawings and gives them a laptop to live in. It's the only option that is both a strong allusion (as clear as the crate or the shelves) and true to the grid. It sits on the shared walnut board, uses room colours only, and carries the room's genie gesture into the panel without painting over the room's laptop.
- **Runner-up, "The Dock":** one project open at a time with a dock of icons. It's elegant, but it hides four of the five projects and loses the grid. Borrowed: the idea that live work leads.
- **Runner-up, "Windows on the desktop":** very close to this plan. Borrowed: the two-then-three row arrangement chosen by data, the hollow ring for non-live statuses, the in-place fold on phones, and the decision to fade the other files while one is open.
- **Runner-up, "The open file":** an explorer list plus an editor. It's calm and simpler to build, but it turns the drawings into 28px icons, which loses the grid you built. It can also read as a code editor. Borrowed: a light paper document as the open view, and coloring the open project with its own ground colour.

---

## 3. Contact: recommended concept

### "The note under the mug"

**The idea.** Contact becomes the room's own mug standing on the corner of a small paper note card, on a strip of the walnut desk. When the panel opens, the note slides out from under the coaster, as if Susana had tucked a note under her coffee for you. The note is the contact: her invitation, one clear "Let's chat", the copy button and the LinkedIn line. The mug stops being a sticker and becomes the paperweight holding the note down.

**What the visitor sees on desktop**
- The counter, the title "Say hello" and the hairline stay. Below them sits one composed still life:
  - The shared walnut board runs along the bottom as the desk edge, the same board Music and Experience stand on.
  - On it lies an index card, a slightly warmer paper than the panel with paper grain and a soft lamp shadow falling down-left. Only the paper is turned a little (about -1°). The text stays straight and crisp.
  - The painted mug, now about 8.5rem wide (about 136px) and drawn from a sharper version of the same painting, stands on the card's top-right corner with its coaster resting on the card.
- On the card, from top to bottom:
  - The intro in Newsreader at a calm reading size, not the giant lede: "I'd love to hear from you if you'd like to chat about music, learning, licensing, or product ideas. And if you have a song you think I'd enjoy, I'm always happy to discover something new."
  - "Let's chat" as the one clear action. It is large, but smaller than the title, so there's a single landing point. It keeps its vermilion underline.
  - Just under it, a small, clearly visible "Copy email address" button. It is darker and larger than today.
  - A dotted line forms the foot of the card. Below it: the LinkedIn mark, "LinkedIn", and for the first time its handle, "linkedin.com/in/susana-pepo-pm".
- The lonely full-width "Elsewhere" band goes away. One link reads naturally as a line on a note.

**What the visitor sees on a phone**
- The board and card are full width, and the card is turned only half as much.
- The mug is smaller (about 5.5rem) and stands just above the card's corner, so it never overlaps text.
- The intro is set smaller again, and "Let's chat" lands well above the middle of the screen (about y=640 at 390×844, instead of below the fold today).
- Every control is at least 44px tall.

**What the visitor does**
- "Let's chat" opens an email to her address. The address stays unprinted, as today. Screen readers still hear "write an email to…".
- On hover or focus the underline inks in vermilion and the mug's steam rises. At this size the steam is visible, so the hover finally delivers what it promises.
- "Copy email address" copies the address and changes to "Copied", announced to screen readers as today.
- LinkedIn opens in a new tab.
- Nothing opens in place, so Escape simply closes the panel.

**Motion**
- **Arrival:** after the panel slides in, the mug settles (a short fade and a 6px drop). Then the note slides out from under the coaster and turns to its slight angle while its text fades in (about 0.45s). The board doesn't move.
- **Hover (mouse only):** the underline draws in and the steam fades in.
- **Touch:** the steam plays one loop (about 10s) after the note arrives, then returns to the still. Nothing loops forever.
- **Press:** a tiny 0.98 press on "Let's chat".
- **Reduced motion:** the card and mug are already in place and fade in (about 0.15s). The steam animation is never loaded. The underline changes colour without travelling.

**How the real content appears.** Everything is taken from content.ts as it is:
- Title "Say hello" (sections.contact.title).
- The current intro, word for word.
- The call to action "Let's chat" (contact.cta) → an email to contact.email.
- Copy email address → contact.email.
- LinkedIn → contact.links[0], with its existing handle now shown.
- Location is not set, so nothing shows.
- pendingNote appears on the card only if the email is ever removed.
- The Instagram icon stays unused, because there is no Instagram link.

**Why this one.** It has the clearest "object becomes the structure" logic: a note held down by her cup, like records in a crate or roles in a pile. It also fixes all four audit problems at once: the mug becomes the anchor, there is one clear hierarchy, the copy action is easier to find, and the LinkedIn row no longer looks unfinished. It needs no new words unless you want them.
- **Runner-up, "Coffee on the desk":** almost the same still life, but without the note, so it is less of a story. Borrowed: the walnut board as the desk, and a sharper hero version of the mug.
- **Runner-up, "The cup comes with you":** the mug flies from the room into the panel. It's lovely, but it means a larger build touching the room and the panel, which other sessions are editing right now. Borrowed: showing the LinkedIn handle. The flight is kept as a possible later step (see Build plan, step 8).
- **Runner-up, "A postcard to write back to":** charming, but the mug shrinks to a stamp and loses its steam. That weakens the allusion to the coffee, and it needs new copy ("Write back"). Nothing borrowed.

---

## 4. Build plan

Several other sessions are editing these files, so each step should land on its own after checking with the work-section and panel-upgrade sessions.

1. **Clean up Work (S).** Stop printing area names, remove the 820ms "after the map" wait, drop the unused map code and props, and trim work-map.css down to the few fold rules still in use. Give the vermilion dot to "Live" only and a plain ring to the other statuses. Update DESIGN.md §4 so it no longer describes the map.
   *Files:* `sections/WorkSection.tsx`, `work/ProjectGrid.tsx`, `work/project-grid.css`, `work/work-map.css`, `work/field.ts`, `DESIGN.md`.
2. **Draw the laptop frame (M).** A new `work/LaptopFrame.tsx` and `laptop-frame.css`: lid, bezel, hinge and base, the flat room-colour hills, and a phone version with the lid only. It reuses `books/ShelfBoard.tsx` and `ShelfDefs.tsx`, and keeps the laptop as a single top-level child so the panel's entrance cascade still applies.
3. **Put the grid on the screen (M).** Turn ProjectGrid into the desktop: live projects first and larger in row 1, the other three in row 2, light labels on the dark screen, keyboard arrows plus Home and End, and the intro at a smaller size. The drawings stay exactly as they are.
   *Files:* `work/ProjectGrid.tsx` (or a new `WorkDesktop.tsx`), `project-grid.css`, `thumbs/work-thumbs.css` (sizes only).
4. **The project window (M).** A paper window with dots, the title, "Put it back", drawing plus text, topics and link. The other files fade and become unreachable. Escape closes the window before the panel, using the pattern from BookshelfSection. On phones the existing fold opens in place.
   *Files:* `work/ProjectWindow.tsx`, `project-grid.css`.
5. **The genie open and close (M).** A short, transform-only path from the file to the window that can reverse mid-way, with a reduced-motion cross-fade. It can come after step 4 is live.
6. **Sharper mug still (S).** Build a larger still from the original high-resolution mug, using `scripts/build-coffee.py` with a larger width. Optionally make a lighter steam crop, because the current one is 3.4MB.
   *Files:* `public/media/scene/coffee/`, `contact/ChatMug.tsx`.
7. **The note under the mug (M).** The new Contact layout: board, card, mug on its corner, intro, "Let's chat", a more visible copy button, and the LinkedIn line with its handle. Add the slide-out entrance, the steam on hover or one loop on touch, and the reduced-motion version. Remove the socials band.
   *Files:* `sections/ContactSection.tsx`, `contact/ChatMug.tsx`, `panel-sections.css`.
8. **Optional later (L):** the mug flying from the room into the note, if the static version feels like it needs it.
   *Files:* `HeroScene.tsx`, `music/flight.ts` (pattern), ContactSection.

**What to test, on the stable copy (localhost:5175)**
- At 1440×900, 1024px (the panel at 88vw) and 390×844: no sideways scroll, the laptop screen and Rights Intelligence are visible without hunting, and "Let's chat" sits above the middle of the screen on a phone.
- The longest summary (Licensing engine) grows the screen and never scrolls inside it. A long title wraps cleanly.
- Keyboard only: arrows, Home and End move between files; Escape closes the window first and the panel second; focus returns to the file; links and the copy button are reachable.
- Screen reader: file names and statuses are announced, the drawings are skipped, and "Copied" is announced.
- Reduced motion: no travel, no gestures, and the steam is never requested.
- Contrast: labels and statuses on the dark screen, and the card against the panel paper.
- The first screen of Work at 1440×900 stays in balance next to the Music turntable.
- Dark-mode emulation: the mug and card stay readable.
- The mailto link opens, and the copy button fills the clipboard.

---

## 5. Decisions for you

1. **Which projects lead Work?** My proposal puts the two live, public projects (chord builder and PM guidebook) larger in the first row. Do you want a different order, or all five at the same size?
2. **One name for Work.** The room says "Things I've built", the panel title says "What I've built", and an internal label says "Things I've made". Which wording should all three use?
3. **Contact's quiet extras.** Should the email open with the subject "Let's chat" already filled in? And would you like a small line under the button saying it opens your email app? Both are new behaviour or wording, so they need your yes.
4. **Show the email address?** It is copy-only today. On a note card, writing it out would feel natural. Keep it hidden, or print it?
5. **Anything missing from Contact?** Only LinkedIn exists right now. There's an Instagram icon ready but no handle, and no location. Add either, or leave the note as it is?