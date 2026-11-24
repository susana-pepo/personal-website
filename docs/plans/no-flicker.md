# Never flickers: clean-up plan for the room’s animations

The goal for the whole site: **no frame ever blinks, goes black or drops out.** Every change below is judged against that first, and size and polish second.

## What the room actually plays

The Lotties in `portfolio-website-assets/public/media` are image-sequence Lotties: 178 embedded WebP frames at 1288×1608, 30 fps, 12–15 MB each. The site doesn’t play them. The build scripts render them to **animated WebP**, and that’s what the browser decodes:

| Clips | Size on screen | Frames | Files |
|---|---|---|---|
| Woman: writing, page, calm | 1024×1035 | ~186 each | 7.0–7.3 MB each |
| Woman: breath | 1024×1035 | 64 | 1.5 MB |
| Cat: sleep, tail, head-turn, stretch, breathing | 480×311 | ~185 each | 3.9–4.3 MB each |
| Window: dawn, midday, night | 957×695 | ~210 each | 1.3–3.5 MB each |
| Coffee steam | 180×385 | 260 | 3.3 MB |

That’s about **52 MB of animation**, most of it the woman and the cat.

**Does a smaller file mean less flicker?** Only partly. Download size isn’t what blinks. What blinks is decoding and painting: an animated WebP is decoded on the processor, one full RGBA frame at a time (about 4 MB of pixels for each of her frames, 30 times a second), and nothing keeps the last frame safe if the browser falls behind. Making the files smaller by lowering quality wouldn’t fix that. Changing *how* the clips are played would.

## Likely causes of the blinks

1. **Hovering the woman puts her on her own layer.** `.scene-object[data-highlighted]` sets `will-change: transform` and scales her to 1.015 (`HeroScene.css`). The motion plan measured exactly this setup: on her own layer, Chrome dropped her for single frames on Retina (22 times in 10 minutes, 0 without). The clips’ own `will-change` was removed then, but the hover rule brings it back whenever she’s hovered.
2. **The handover between clips is timed, not confirmed.** `WomanOverlay` adds the next clip, then removes the last clip *and* the still after a fixed 300ms (`SETTLE_MS`). `img.decode()` only promises the first frame. If a big animated frame hasn’t been painted by then, there is a frame with nothing under the chair. The cat uses the same pattern.
3. **Animated WebP at this size is at the edge of what the decoder keeps up with**, especially with the window loop, the cat and the steam all decoding at once. When it falls behind, Chrome can paint a blank tile.

Step 1 below proves which of these each blink is, before anything is changed.

## The plan

### Phase 1: measure, then the quick fixes (low risk)

1. **A flicker probe.** A dev-only script that records the room through the Chrome DevTools screencast at 60 fps and flags any frame where the woman’s, cat’s, window’s or mug’s box suddenly goes dark or empty. Run it on the Retina screen for 10 minutes idle, 50 hovers across the objects and 20 panel opens and closes, at night in rain (the heaviest scene). This sets the baseline and becomes the check for every later step. Target: **0 blinks**.
2. **No layer for the woman on hover.** Her hover becomes the halo and light only: `--hover-scale: 1` and no `will-change` for her, so she stays painted with the room. Check the cat the same way.
3. **Confirmed handovers.** Remove the old clip only once the new one has actually been painted: two `requestAnimationFrame` ticks after it has been decoded *and* has painted, instead of a fixed 300ms. Keep the still underneath until then.

### Phase 2: from animated WebP to video (the real fix, and 5–10× smaller)

Video is decoded by the graphics chip, a `<video>` always keeps showing its last frame instead of blanking, and `requestVideoFrameCallback` says exactly when a frame is on screen, so handovers can be exact.

- **Format:** WebM (VP9 with alpha) for Chrome, Edge and Firefox. HEVC with alpha (`.mov`) for Safari, encoded on this Mac with VideoToolbox. The current animated WebP stays as the fallback.
- **Quality:** same size on screen, same 30 fps, every frame of the export kept. Encoded from the Lotties’ original frames, not from the WebPs, so nothing is compressed twice.
- **Expected size:** roughly 0.5–1 MB per woman clip instead of 7 MB, and 0.3–0.6 MB per cat clip instead of 4 MB. Measured, not promised, in the first test encode.
- **Players:** the woman and cat players keep their logic (random clips, rests and breaths, reactions). Only the element changes: two stacked `<video>` elements, the next one primed on its first frame and swapped in on `requestVideoFrameCallback`.
- **Needs:** `ffmpeg` with `libvpx` (`brew install ffmpeg`). Nothing is downloaded or installed without your go-ahead.
- **Order:** the woman first (largest and most visible), then the cat, then the window, then the steam. Each one is checked with the probe before moving on.

### Phase 3: smaller files without losing quality (whatever stays a picture)

- Still PNGs that could be WebP: `vinyl.png` 884 KB, `laptop.png` 623 KB, `woman-halo.png` 334 KB, `laptop-sheen.png` 314 KB, `books.png` 295 KB and the halos. Lossless or near-lossless WebP usually saves 50–70% with no visible change. Check each one at 2× zoom against the original.
- Check that nothing in `public/media/scene` is unused (for example `woman.webp`, if the clips replaced it), and remove it from the build.
- The slow motions (her breath, the window rain) may not need 30 fps: test 20 fps side by side. Use it only if you can’t tell the difference.

## The cat: a reaction on every hover

Why it reacts only every third hover or so today:

1. **“Stay asleep” is one of the answers.** `nextReaction` picks from *asleep, head-turn, stretch* and never repeats the last one, so about half of all hovers just purr.
2. **The reaction clips arrive late.** They load 12 seconds after the room settles, one after another, behind the woman’s clips (about 28 MB ahead of them). Until they arrive, every hover purrs.
3. **A hover while a reaction plays is ignored.** Each reaction lasts about 6.3 seconds, so a quick second hover does nothing.

Fix:
- Once a reaction clip is ready, every hover plays one (head-turn and stretch take turns). “Stay asleep, purr and z’s” remains only for the moment before they’ve loaded.
- Fetch the two reactions right after the sleeping loop, before the woman’s extra clips. After Phase 2 they’re small enough to arrive in a second or two.
- A hover during a reaction gets a small purr and z’s, so it never feels ignored, without stacking clips.

## A quiet pulse on the objects that open a section

The room already has a switched-off version (`data-inviting`, `halo-breathe`, `invite: 0` for every object in `scene-layout.json`). In that version every halo breathes at once on a 3.6s loop. That would feel busy, so instead:

- **One object at a time.** A slow swell of its amber halo, then the next object, left to right in the discovery order (laptop, desk books, shelf books, record player, mug, the woman). The light seems to wander around the room rather than everything blinking.
- **Very slight.** The halo goes from its resting 0.6 to about 0.75 (hover is 0.9), over about 1.6s in and 2.2s out, with a rest before the next object. That’s about a 9-second walk around the room, then a pause of a few seconds.
- **Opacity only, on the halo picture.** No scale, no movement, no filter, and no new layers, so it can’t cause a blink (checked with the probe).
- **When it stops:** while any object is hovered or focused, while a page is open, and while the tab is hidden. It stops for the rest of the visit once a first section has been opened (recommended), or keeps going until every section has been seen.
- **Not the cat or the lamp:** they don’t open a section.
- **Reduced motion:** the steady resting glow only, as now.
- **Phones:** the same pulse. It matters most there, since there is no hover.

## Who touches what

- This work: `src/components/HeroScene/overlays/*` (woman, cat, coffee players), `HeroScene.css` (hover layer, pulse), `HeroScene.tsx`, `src/scene/catReaction.ts`, `src/scene/clipFiles.ts`, `scene-layout.json` (`invite`), the `scripts/build-*.py` encoders, and `public/media/scene`.
- The mobile and responsive session works on the sections and the panel, and only room *layout* for small screens. It was asked to stay out of the files above.
- Guardrails from `interaction-motion.md` still apply: no transform, scale or filter on `.cover` or the room while a page is open; reduced motion may only be extended; the entrance gate stays.

## Phase 1 results (24 November)

Measured with the probe: a real Chrome window at Retina scale, filmed at about 93 fps, the pointer moving onto the woman and the cat and away every 4.5 seconds.

- **The clip files** have no black frames at the pen. They do have small one-frame specks (mostly brighter, from the export), larger in the cat’s reaction and tail clips. These are baked in, and Phase 2 re-encodes from the Lotties’ original frames.
- **Live site, before:** 5 blinks in 108 s, all but one on hovering the cat or the woman.
- **With Phase 1:** 2 blinks in 516 s across three films (1 in 108 s, 0 in 108 s, 1 in 306 s). The small hover blinks are gone. What’s left is one kind: **the whole woman drops out for a single frame**, about once every four minutes, with or without a hover or a clip change. That’s the animated-WebP decode and paint limit described above. Only Phase 2 (video) removes it.
- **Done in Phase 1:** no layer, growth or press for the woman and the cat; old clips are removed only after the new one has been painted (`afterPainted` in `src/scene/clipFiles.ts`); the cat reacts on every hover once its clips have arrived, and they load first. A hover during a reaction gets no extra purr: the reaction itself is the answer, and extra text over “mrrp?” would crowd it.
- **Phase 2 needs** `ffmpeg` built with `libvpx` (and VideoToolbox for Safari’s HEVC). Neither Homebrew nor `ffmpeg` is installed on this Mac.

## Order and checks

1. Phase 1 (probe, woman hover layer, confirmed handovers) and the cat fix. Small and safe.
2. The pulse.
3. Phase 2 for the woman, probe, then the cat, window and steam.
4. Phase 3.

Each step: probe at 0 blinks on Retina, `npx tsc -b`, `npx vitest run`, `npm run build`, and a check at 1440 and 390 wide, with reduced motion on and off. Nothing is committed; Susana commits and pushes.
