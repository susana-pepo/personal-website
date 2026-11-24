# Music: the record crate

Prototype: [`record-crate.html`](./record-crate.html). Open it directly in a browser. It needs no build step and loads nothing from the network except the Funnel fonts. Every record, track and note in it is **sample** content.

## The idea

The Music panel stops being a grid of thumbnails and becomes the corner of the room it opens from:

1. **The deck: "What I'm listening to"**. This is a small top-down drawing of the room's record player: the same honey walnut plinth, a black record, and the cover art printed on the label where the painting has its vermilion one. The tonearm shows the state without any extra text. When she is listening now, the arm swings onto the record and it turns at 33⅓ rpm. When the track was "last played", the arm rests and the record stays still. Loading shows a flat card-shade block, as it does today.
2. **The crate: "On my shelf of records"**. Sleeves stand on the same 6px walnut board the Bookshelf uses, overlapping like records in a cubby. Moving the pointer along them (or dragging a finger, or using the arrow keys) flips through the crate. The sleeve under the pointer opens to its full face, rises 8px, and its record peeks out of the top. One caption line under the board names the record in focus, so the sleeves don't need small labels of their own.
3. **The desk: liner notes and an opt-in player**. Choosing a sleeve takes it out of the crate. It flies down to the desk, the record slides out to the right and rolls as it goes (44% of its width works out to about 48° of turn), and the liner notes settle in 40ms apart: kind and year, title, artist, her note, then "Start with" (a vermilion track number) and the length. Spotify's player loads only after a click on **Play here**, and a line underneath says that it sets Spotify's cookies. While the player is open, the record on the desk turns. **Put it back** reverses the whole sequence and returns focus to the sleeve in the crate.

Why it fits: the room is still the cover and the panel is the printed insert. The section only uses things that are already in the painting (walnut, black vinyl, the vermilion label), so nothing new needs explaining. Vermilion stays rare: the live dot, the "Start with" numeral, the play disc and the focus ring. There are no boxed buttons, no tracked capitals, no italics, and nothing loops unless music is actually playing.

## Motion

| Moment | Duration / easing | Reduced motion |
|---|---|---|
| Flip (sleeves part) | 340ms `--ease-out` | instant |
| Record peeks on hover | 340ms `--ease-out` | instant |
| Take out (sleeve flies to desk) | 620ms `--ease-drawer` | no flight; the record is shown already half out |
| Record slides out and rolls | 760ms `--ease-out` | static |
| Notes settle | 240ms, 40ms stagger | fade only |
| Tonearm swing | 900ms `--ease-in-out` | static |
| Record spin | 1.8s linear (33⅓ rpm), only while playing | none |

The lamp's reflection on the vinyl is drawn on a separate layer that does not rotate, so the light stays still while the grooves turn underneath it.

## Mapping onto the code

- **`MusicSection.tsx` → `Listening`**: keep `useNowPlaying`. Swap the 72px art for a `<Turntable art={imageUrl} playing={isPlaying} />` built in CSS plus one inline SVG for the arm. The markup stays a single link to the track.
- **`SpotifyCollection.tsx`**: `Cover` becomes `Sleeve` (the same `<button aria-expanded aria-controls>`). The grid becomes a `<ul class="crate">` whose `--x` offsets come from a small `useCrateLayout(count, activeIndex, width)` hook (`ResizeObserver` and about 30 lines, already written in the prototype's `layout()`). `Booth` becomes `Desk`. It renders after the crate, and the flight is a clone sleeve animated with WAAPI from the crate rect to the desk rect, positioned inside the panel article so it scrolls with the panel. **It must be appended inside the `<dialog>`, because the panel lives in the top layer.**
- **Playback sync**: switch the iframe to Spotify's iFrame API (`onSpotifyIframeApiReady`, then `controller.addListener('playback_update', …)`) so that the desk record turns only while `isPaused` is false. Until that is in place, turning while the player is open is a fair stand-in.
- **Content (`types.ts`, `SpotifyPick`)**: add optional `year?`, `startWith?: { number: string; title: string }` and `length?`. `note` already exists. Any field left empty is hidden, so nothing is invented, which follows rule 4 of the brief.
- **Covers**: real covers come from oEmbed as they do now, so only the sample art in the prototype is drawn. The dev-only `CollectionPreview` could reuse the prototype's SVG sample covers.
- **CSS**: about 300 lines in `sections.css`, replacing `.collection` / `.record` / `.booth`. Turntable colours sit in tokens next to the Bookshelf walnut.
- **The "On the turntable" music card** becomes redundant once the crate carries liner notes. Consider retiring it.

**Effort:** about 1.5 to 2 days. That covers half a day for the turntable and states, a day for the crate layout, keyboard and touch, the flight, and the desk, and half a day for the iFrame API sync, reduced motion, and QA on phones.

## Accessibility

- Each sleeve is a real button labelled with its title, artist and kind, with `aria-expanded` pointing at the desk.
- Roving tabindex: Tab enters the crate once, the arrow keys and Home/End flip through it, and Enter takes a record out. Escape on the desk puts the record back. In the real `<dialog>`, call `stopPropagation` so Escape doesn't also close the panel.
- On touch, a horizontal drag flips through the crate (`touch-action: pan-y` keeps vertical scrolling) and a tap takes the record out.
- Reduced motion keeps every state and drops all travel.

## Open questions

- Should the crate show 14 or more records? It still works at that count (strips of about 1.6rem on desktop), but 8 to 10 feels most like a cubby.
- Should the deck spin at all? If even 33⅓ feels like too much movement, the tonearm alone can carry the "live" state.
