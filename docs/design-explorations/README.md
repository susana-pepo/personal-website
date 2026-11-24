# Design explorations

There are three proposals for raising the quality of the section panels. Each folder has a short README and one prototype. A prototype is a single self-contained HTML file: double-click it, or drag it into a browser. You don't need a build step or a server. Only the Funnel Display and Funnel Sans fonts load from Google Fonts. Every title, author, album and note in the prototypes is sample content and is labelled that way. Nothing under `src/`, `public/`, `scripts/` or the config files was changed.

## The request this serves

You asked to bring back the books on the desk as the way into Experience, with their interactive elements. The **panel (folio)** exploration covers that. The room side looks wired already: in `src/scene/hotspot-geometry.json` the `deskbooks` hotspot points to `section: "experience"`, and `content.ts` has the "My experience" tooltip. I have not checked this in the running app. What is still missing is the interactive stack inside the Experience panel.

## The explorations

**Panel system, "the folio"**: [README](./panel/README.md) · [folio-prototype.html](./panel/folio-prototype.html)
The panel becomes one sheet of uncoated card, with two pages showing beneath it as thin edges. Today's translucent double bezel goes. Every section shares one header, a fixed 8/24/48px rhythm and a pager that names the object each section lives in ("The books on the shelf"). Changing sections becomes a page turn that follows the direction of travel. A single vermilion mark moves between the tabs, and a 1px reading-progress line runs under the bar. Experience opens with the desk books drawn as a usable stack: choosing a spine pulls it out, scrolls to that entry and inks its rule. Every entry stays listed below, so readers never have to click. On phones the panel rises from the bottom. To try it, click the books on the desk in the placeholder room, choose a book, then turn to Work.

**Bookshelf, "procedural books on a lamplit shelf"**: [README](./bookshelf/README.md) · [bookshelf-prototype.html](./bookshelf/bookshelf-prototype.html)
Each book becomes an SVG built from its data: cloth, leather, jacket or paperback, with size, lettering, wear and fading derived from a hash of the title, so new books need no artwork. The light comes from the painting's lamp at the upper right. Each shelf has its own composition: a face-out book and a ceramic cat, a travertine bookend, or a leaning book and a pile with a pebble. When you choose a book it pulls out with a vermilion slip, and a drawer opens under the shelf with a 3D copy that turns from spine to cover. It works with arrow keys and Escape, and each shelf scrolls sideways on phones.

**Music, "the record crate"**: [README](./music/README.md) · [record-crate.html](./music/record-crate.html)
"What I'm listening to" becomes a top-down copy of the room's turntable. The tonearm shows whether it is playing now or was last played, and the record turns only while music plays. The collection becomes a crate of overlapping sleeves on the walnut board that you flip through with the pointer, a finger or the arrow keys. Choosing a sleeve sends it to a desk with liner notes. Spotify's player loads only after you choose "Play here". The prototype has switches for state, record count and motion. Its timing was judged in a slowed-down preview, so the motion still needs a look in a normal browser.

## Recommended order

| # | What | Why now | Effort |
| --- | --- | --- | --- |
| 1 | **Experience desk stack** (from the folio): `DeskStack` above the timeline, four spine-colour tokens, and the duplicated summary/lede fixed. Check that the `deskbooks` hotspot opens Experience. | This is what you asked for. It ships without the rest of the folio. | ~0.5 day |
| 2 | **Folio panel system**: single sheet and under-pages, page-turn transitions, tab ink, progress line, pager object line, phone bottom sheet | Every section sits inside it. Settle the frame before redesigning what goes in it. It also sets up the Escape handling the next two need. | ~1–1.5 days (1.5–2 including step 1) |
| 3 | **Bookshelf** | It shares the walnut board, spine colours and lighting with the desk stack, so do it while those are fresh. Content changes are additive and optional. | ~1.5–2 days |
| 4 | **Music crate** | It is the most independent of the four, but it has the most moving parts (the flight inside the `<dialog>` top layer, and the Spotify iFrame API sync). It reuses the board from step 3. | ~1.5–2 days |

**Total:** about 5–6.5 days. Steps 3 and 4 can run in either order or in parallel once step 2 is in.

## Decisions to make first

- **Folio:** Should paper edges replace the double bezel you chose? Should the Experience summary or lede be rewritten?
- **Bookshelf:** Should spines read top to bottom or bottom to top? Keep the cat figurine, or use only the travertine bookend? Keep the vermilion slip, or only lift the chosen book?
- **Music:** How many records should the crate hold (8–10 feels most like a cubby)? Should the record spin, or should the tonearm alone carry the "live" state?
