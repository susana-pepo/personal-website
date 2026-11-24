# Mobile and responsive pass: audit

Date: 24 November 2026. Checked at 375×812, 390×844, 430×932, 768×1024, 1024×768 and 1440×900, plus phone landscape (844×390 and 667×375). Every section was checked closed and with one item open (a Work file, an Experience book, a Bookshelf book and a record).

Screenshots are in the shared notes folder for this session, under `mobile-pass/`:

- `before/<size>-<section>.jpg`: the first screen of the room and each section.
- `before-scroll/<size>-<section>-sN.jpg`: each panel scrolled step by step. `-open` means one item was opened first.
- `after/` and `after-scroll/`: the same shots after the fixes.

The captures use touch emulation and reduced motion, so the room and the panel are at rest.

## Status
All P0 and P1 issues (1 to 8) are fixed. Each was checked at phone width and on desktop. At 1440×900, 1024×768 and 768×1024, every section is pixel-identical before and after (the room differs by 0.03%, which is the rain). `npx tsc -b`, `npx vitest run` (184 tests) and `npm run build` pass. The P2 and P3 items at the end are follow-ups.

Before and after side by side, in `mobile-pass/`:
- `compare-375-bookshelf.jpg`: closed, then with a book open (before, after).
- `compare-375-music.jpg`: Music and the room at 375 (before, after).
- `compare-landscape.jpg`: the room and About at 844×390 (before, after).
- `compare-667l.jpg`: the room and About at 667×375, and Experience after tapping a book at 375.
- `compare-desktop.jpg` and `compare-tablet.jpg`: regression checks.

Files changed: `App.css`, `SectionPanel/SectionPanel.css`, `SiteFooter/SiteFooter.css`, `Masthead/Masthead.css`, `sections/bookshelf/bookshelf.css`, `sections/music/music.css`, `sections/work/desktop.css` and `sections/ExperienceSection.tsx`. No HeroScene files were touched: the room's phone layout lives in `App.css`.

Severity: P0 is broken, P1 is clearly wrong or hard to use, P2 is worth fixing, P3 is polish.

## P0

### 1. Bookshelf runs off the right edge on every phone
At 375, 390 and 430 wide, the shelves are 551px wide inside a 311px page. "Books for work" is pushed off the right edge, and the bookend on "Books I love" is cut off. Opening a book scrolls the drawer into view, and that scrolls the whole panel sideways: the left padding disappears and the page title is pushed half off the screen.

Cause: `.bs-shelves` is a grid with one implicit `auto` column, so the long "Books I love" row (which should scroll inside itself) stretches the column.

Screens: `before/375-bookshelf.jpg`, `before-scroll/375-bookshelf-s1.jpg`, `before-scroll/375-bookshelf-open-s0.jpg`.

Fix: give the grid a `minmax(0, 1fr)` column. As a guard for every section, the panel's pages also clip sideways overflow (`overflow-x: clip`), so nothing can scroll the sheet sideways again.

## P1

### 2. On phones the room sits at the top, with a third of the screen empty below
At 375×812 the masthead, room and player end at about 500px, leaving the bottom 310px blank. On wider screens the block is centred, but phones were left out of that rule. The room is also cropped to 1.9:1, which on a phone only costs height.

Screens: `before/375-room.jpg`, `before/430-room.jpg`.

Fix: on tall phones the masthead, room and player are centred as one block, as on desktop, and the room shows the painting's full 16:9 height. That's about 14px taller at 375. Nothing is cropped, because the room box then matches the canvas.

### 3. Phone landscape: the masthead wraps onto three rows and the room shrinks
At 844×390 the masthead is only as wide as the room, about 384px. It wraps onto three rows, which leaves the room about 390px wide, with the player below the fold. At 667×375 it's the same.

Screens: `before/844l-room.jpg`, `before/667l-room.jpg`.

Fix: on short landscape screens (height under 500px) the masthead uses the full width on one row, and the room is sized to the height left beneath it. The player can sit below the fold here: the room is the first thing to see.

### 4. Phone landscape: the panel header fills most of the sheet
At 844×390, the tab bar, number, display title and rule take about 270px of the 374px sheet, so the content starts at the bottom edge.

Screens: `before/844l-about.jpg`, `before/844l-bookshelf.jpg`, `before/667l-about.jpg`.

Fix: on short screens the header is compact: a smaller title, a tighter top padding, and less space under the rule.

### 5. No safe areas, although the page asks for the full screen
`index.html` sets `viewport-fit=cover`, but nothing uses `env(safe-area-inset-*)`. On an iPhone in portrait, the phone panel's last lines and the copyright line sit under the home indicator. In landscape, the notch covers the left edge of the masthead and room, and the panel's right edge.

Fix: the page gutter, the footer and the panel's edges and bottom padding now add the safe-area insets.

### 6. Music: the track title and artists are squeezed into a narrow column on phones
The record player takes 8rem and the text gets about 167px, so a long classical title and its artists run to 13 lines beside a short turntable.

Screens: `before/375-music.jpg`, `before-scroll/375-music-s1.jpg`.

Fix: on phones the record player sits above the track text, and the text uses the full width.

### 7. Tap targets under 44px on touch screens
- Player: rain toggle and "Next track" are 28×28, and play/pause is 32×32. These are the most-used controls on the page.
- "Explore the room" hint: the dismiss × is 24×24.
- Masthead links on phones: 41px tall.
- Work desktop on touch tablets (768 and 1024): the previous and next arrows are 36×36, and "Explore project" is 25px tall.

The room's objects are fine: each has an invisible 14px margin for touch (`.hotspot__reach`). The scene control is also fine (44×44 through `::after`).

Fix: on coarse pointers, each control gets a larger invisible hit area through a pseudo-element, so nothing looks different. The masthead links get a little more padding on phones.

### 8. Experience on phones: choosing a book seems to do nothing
The role opens below the pile, which on a phone is below the fold. You tap a spine and the screen doesn't change.

Screen: `before-scroll/375-experience-open-s0.jpg` (the book was tapped; the role is off screen).

Fix: when a book is chosen by tap or click and its page starts below the visible part of the panel, the panel scrolls it into view (instantly with reduced motion). Keyboard choices don't scroll, so focus stays on the tab you are on.

## Second round (24 November, after Susana's review)
Susana's priorities were the bookshelf and the room's cues ("ugly"), then everything else.

### Bookshelf on phones
- **"Books I love" fits on two boards.** On a narrow shelf (under 480px), the upright books and the bookend stand on the first board, and the Han Kang pile lies on a board of its own beneath. Before, the shelf slid sideways with no cue, and the pile was hidden off the edge. The split is `shelfRows()` in `bookGeometry.ts`, with a test. Arrow keys walk across both boards. Wider shelves are unchanged.
- **An opened book sits beside its title,** at about three quarters of its size, as "Reading now" does. Before, a large cover stood alone, with its title underneath.
- **"Reading now" no longer names its book twice.** While that book is out, the title beside the shelf fades out, because the drawer names it. This applies at every width.

### The room's cues
- **The touch markers are small glints of lamplight** (a cream bead with a warm glow and a faint dark edge), not vermilion pins with grey rings. They stay steady. The idle pulse is the animations session's work.
- **The "Explore the room" chip is dark glass.** The shared glass took on the room's orange and read as an orange blob. Its type is larger: 15px for the title and 13px for the hint (14px on phones). Its timing is unchanged.
- Her greeting ("Hey there, I'm Susana") and its timing are unchanged.

### Smaller fixes
- **Experience:** on phones the supporting pile (degree, notebook) is drawn at the roles' size. The book on top of each pile has a 44px target on touch.
- **Panel tabs:** each tab answers across half the gap on either side, so "Work" is a 44px target. The ink still sits under the word.
- **Music:** "Last played" is 13px, and "Open in Spotify" is 14px and underlined, so it reads as a link. This is the one deliberate change on desktop, along with the chip.

### Checked
Phones (375, 390, 430), tablet (768) and landscape (1024×768, 844×390, 667×375): no sideways overflow anywhere. At 1440, 1024 and 768, the only pixel changes are the chip and Music's link. My tests (186) and the Vite build pass.

`npx tsc -b` and `npx vitest run` currently fail on `src/__tests__/clipFiles.test.ts`. That's the animations session's new test, for clip files it hasn't written yet. It isn't part of this pass. `npm run build` stops at that typecheck until that work lands.

Screens: `mobile-pass/round2/` (bookshelf), `mobile-pass/after2/` (every size) and `mobile-pass/compare-round2-phone.jpg`.

## The room on a phone pans (the P2, done 24 November)
The room was about 366×206 at 390. On a touch phone held upright it's now taller and pans sideways:

- **About twice the size.** The room is 351×404 at 375, 366×421 at 390 and 406×467 at 430, and 351×315 on a 375×667 phone. Its height is what the screen has left once the masthead and the player have their place, between three quarters of its width and 1.15 times it. The canvas fills that height and you swipe across it.
- **It opens on her and the desk.** The middle of the view is canvas x 990 (`ROOM_PAN` in `scene/layout.ts`). Her greeting is whole and clear of the edge, and the laptop, desk books and lamp are in view. The record player and the bookshelf are to the left, and the coffee and the cat are to the right. The shelf's edge and the coffee just show, as a hint.
- **The cue:** a soft dark fade on each edge that has more room beyond it. It fades out when you reach that end.
- **Swiping** pans the room only. The page never moves, and a swipe that reaches an end stops there (`overscroll-behavior-x: contain`). A tap still opens each section. A vertical swipe doesn't pan the room.
- **Keyboard focus** on an object pans it into view if it isn't already, with a short smooth scroll, or at once with reduced motion.
- **Unchanged:** hotspots, markers, labels and the overlays live in the canvas, so they move with it. The "Explore the room" chip is in the player row, as before. Turning the phone on its side shows the whole room as before. Turning it back returns to where you were.
- **Touch screens only** (`pointer: coarse`). A narrow desktop window with a mouse can't swipe, so it keeps the whole room.
- **Files:** `App.css` (the phone rules and the fades), `useCoverFit.ts`, the new `useRoomPan.ts`, `scene/layout.ts` (`ROOM_PAN`, `panFit`, `panScrollFor`, `panCentreAt`), `HeroScene.tsx` (the fades and focus) and `HotspotLayer.tsx` (`onFocusObject`), with tests in `scene.test.ts`. `HeroScene.css`, the overlays and `DiscoveryHint` are not touched.
- **Checked:** at 375×812, 390×844, 430×932 and 375×667 with a touch swipe both ways, taps on the record player and the coffee, and Tab through every object, with and without reduced motion. At 1440×900, 1280×800, 1024×768, 768×1024, 844×390, 667×375 and 568×320 the room is pixel-identical to before.

## Still open
- **P3. Middle books in the Experience piles are 39 to 43px tall on phones.** They touch, so their targets can't grow without overlapping. Only the top book was extended.
- **P3. Small editorial type in the chrome:** the masthead's disciplines line (11px), the "Scene" caption (10px) and the player's meta (11px). These are deliberate small caps and captions, and are left as they are.
- **Not a problem:** the scene control already shows an option's name on tap (`data-tapped`). The Bookshelf's hover "peek" is pointer-only, and a tap opens the book.

## Checked and fine
- About: the photo and text stack well at every size, and the line length stays within the 36rem measure.
- Contact: the note and mug scale down well, and the links are 44px tall.
- Work: the folded file list on phones and the tablet frame at 768 and 1024 both work. Opening a file unfolds it in place.
- The panel tab row scrolls sideways on phones, with a fade at the end, and the current tab is scrolled into view.
- Reduced motion: every fix here is layout only. The one scroll added is instant when reduced motion is on.

## Final check (24 November, after the swipeable phone room)
Checked at 360, 375, 390, 430, 768×1024, 1024×768, 1280, 1440, 1920, 844×390 and 667×375: the room, every section, and the open states. No page scrolls sideways at any size.

### Fixed
- **The room's arrows were too heavy.** They were 36px dark discs, about a tenth of the room's width, sitting on her hair and the window. They're now 30px, about a twelfth, in lighter glass, with a smaller icon. The tap target is still 44px.
- **On phones the player didn't line up with the room.** It was 320px under a 366px room, and its left edge was a few pixels in. It now runs edge to edge under the room at every phone width.
- **The panel's tab row cut a word in half at its left edge** ("'ork", "ience"). It used to centre the current tab. Now it rests on a tab's own edge, showing the tab before the current one (`tabRowScroll` in `folio.ts`, with tests). The row has a little more room at its end, so even Contact at 360 rests cleanly.

### Looked at and fine
- Balance on tall phones: the masthead, room and player sit centred as one block, with the player in thumb reach.
- Landscape phones: the masthead is one row at 800px and wider, and the room fills the height beneath it.
- Tablet and desktop: unchanged and balanced. The 768 portrait room still has wide bands above and below, which is the price of its width.
- The mug in the phone room: a pale box seemed to show around it in a compressed screenshot. At 3× it's only the mug's normal soft glow.

### Still open
- On a phone, the panel's first screen spends about 280px on the number, the display title and the rule before any content. It's elegant, but a smaller phone title (for example, the short-screen size) would show content sooner. That's a design decision for Susana.
- The Experience middle spines (39 to 43px) and the small editorial captions are as noted above.
