# Bookshelf study

Open `bookshelf-prototype.html` in a browser. It is self-contained; only Funnel Display and Funnel Sans load from Google Fonts.
Every title, author and note in it is an invented sample. The author names are deliberately placeholder words (Muster, Beispiel, Ejemplo, Probe, Platzhalter), so they cannot be mistaken for Susana's books.

## The idea

Today the shelf is a row of flat CSS spines. This study makes it a real shelf in the lamplight of the painting, while the panel around it stays as quiet as the rest of the site.

- **Books drawn from data.** Each book is an SVG generated from `title`, `author`, `shelf` and two optional fields, `kind` (cloth, leather, jacket or paperback) and `colour` (one of the room's colours). Its height, thickness, lettering layout, sun-fade, edge wear and reading creases all come from a hash of the title, so a book always looks the same and a new one needs no artwork.
- **Four bindings with their own lettering.**
  - Cloth: gilt double rules, a dark lettering piece, or a blind-stamped title.
  - Leather: raised bands with gilt fillets and a contrasting label.
  - Jacket: printed type with a colour block.
  - Paperback: a series band at the head and creases on the spine.
  Spines show the surname only, as most real spines do. When a name does not fit, it is left off rather than cut short.
- **Material and light.** Shared SVG filters give the cloth weave, paper tooth, leather grain and walnut grain. Head and tail edges are rubbed, and the lettering sits pressed into the cover. In the painting the lamp stands to the right of the bookcase, so the light here comes from the upper right as well. Spines catch it on their right shoulder, books further from the lamp are slightly darker, shadows fall to the left, and a faint warm pool lights the wall.
- **Composition per shelf.**
  - *Reading now*: the first book stands face out, and books in progress have a pale paper slip showing above them. A small ceramic sleeping cat nods to the cat on the desk.
  - *Books I love*: upright books held by a travertine block.
  - *I'd recommend*: one book leans on its neighbour, and two lie flat in a pile with a pebble on top.
  Each shelf has a default layout. Any book can override it with `pose`.

## Interaction

- **Hover** (fine pointers only): the book comes about 8px off the shelf, tips 1.4° toward the lamp and grows by 1.5%. Its wall shadow moves out and softens, and the contact shadow fades. A face-out book straightens up; a book in the pile slides out sideways. The motion is 280ms on `--ease-out`.
- **Choose**: the book stays pulled out and a vermilion slip rises from its top edge. This is the only use of the spot colour on the shelf. Under the shelf, a drawer opens (`grid-template-rows` 0fr to 1fr, 420ms on the drawer curve) with a CSS 3D copy of the book, its cover, spine, page block and top. The book turns from spine-on to cover-on over 1s on `--ease-out`. Next to it are the shelf name, the book's position on the shelf ("02 of 07" with a vermilion numeral), the title, the full author name, the note, "More about this book" and "Put it back". Choosing another book on the same shelf swaps the detail and turns the new book. Choosing the same book again puts it back.
- **Keyboard**: books are real buttons with `aria-expanded` and `aria-controls`. Arrow keys and Home/End move along a shelf. Escape puts the book back and returns focus to its spine.
- **Reduced motion**: there is no lift, tilt or turn. The book appears at its resting angle, and every change is a 120–160ms fade.
- **Phones**: the book unit shrinks from 1.1px (wide panel) to 0.84px. A shelf scrolls sideways inside itself, never the page, and the detail stacks the book above its text.

## How it maps onto the code

| Prototype | Real code |
| --- | --- |
| `specFor(book)` | `src/content/bookGeometry.ts`: a pure function (hash to spec) that is easy to unit-test. It reuses the FNV hash already in `BookshelfSection.tsx`. |
| `spineSVG`, `coverSVG` | `BookSpine.tsx` and `BookCover.tsx`, returning JSX instead of strings. |
| Shared `<defs>` (filters, gilt, light) | `ShelfDefs.tsx`, rendered once at the top of `BookshelfSection`. |
| Detail drawer and 3D book | `BookDetail.tsx`, replacing today's `.book-note` (same single `open` state and `aria-live`). |
| Cat, travertine block, pebble | `ShelfObjects.tsx`. The `object` field on each shelf picks one. |
| Styles | A new block in `sections.css`. Every size is a plain number times `--u`. |

Changes to `types.ts` are additive and all optional: `kind`, `colour` (a room colour key), `pose`, `heightMm`, `thicknessMm` (real sizes win over the hash) and `spineAuthor`. `SAMPLE_BOOKS` can stay as it is, because unset kinds and colours are derived.

Implementation notes:
- Measure lettering after `document.fonts.ready` using `getComputedTextLength()`, in a `useLayoutEffect`.
- In the real `<dialog>`, prevent `cancel` while a book is out, so Escape closes the book first and the panel second.
- Clip-path ids must be unique per instance; use `useId`.
- Motion uses transform and opacity only. The `blur()` on the wall shadows is static.

**Effort:** about 1.5–2 days for a polished version. That is roughly half a day for the geometry and spine/cover components, half a day for the detail and 3D book, and half a day for accessibility, reduced motion, phones and tuning against real titles.

## Open questions for Susana

1. Should spines read top to bottom (English convention, used here) or bottom to top (German)?
2. Is the sleeping-cat figurine charming or one thing too many? The travertine block works on any shelf instead.
3. Do you want the vermilion slip, or should the chosen book only lift?

Note on the desk books: making the books on the desk open Experience is a change to the room and its hotspots in `src`, so it is outside this study. It already looks in progress there: `content.ts` has a `deskbooks: 'My experience'` tooltip. If the Experience panel ever wants a small illustration of its own, the "flat pile" pose here can draw the desk stack from data.
