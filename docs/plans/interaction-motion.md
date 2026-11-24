# Interaction motion: audit and upgrade plan

Four reviews looked at every interaction animation on the stable site (http://localhost:5175). Each used one installed skill: **motion-design**, **emil-design-eng**, **optimize/audit** (performance and accessibility) and **delight**. The pre-rendered clips and PNG artwork were left out. Nothing in the project was changed. The probe scripts are in `/private/tmp/claude-501/-Users-susanapepo-Documents-Apps-personal-website/5844dcb0-010c-480c-9449-9afad5d8c470/scratchpad/wf/motion-map/`.

> **Which code this applies to.** :5175 serves a snapshot (`/private/tmp/claude-501/-Users-susanapepo-Documents-Apps-personal-website/5844dcb0-010c-480c-9449-9afad5d8c470/scratchpad/stable-site`), not the live `src/`. The two now differ. In the live code Work has been redesigned (`WorkDesktop`, `ProjectWindow` and `laptop.css` replace `ProjectGrid`, `project-grid.css` and `work-map.css`), and the bookshelf, music, `panel-sections.css` and content files have also changed. Line numbers below refer to the snapshot unless marked *live*. Re-anchor each item on live `src/` before editing.

---

## 1. Where it stands

- **The foundation is good.** The motion has one calm, warm character. Entrances ease out, presses take a consistent 160ms, and with reduced motion on almost everything becomes a short fade. A keyboard visitor gets everything a mouse visitor gets in the room. The panel can be reversed mid-way without glitches.
- **Three of the most-seen moments don't play as designed, and two share one cause.** A finished entrance animation keeps holding its final values (`animation-fill-mode: both`), which stops the planned transition from running. As a result, the room's lean-back when a page opens **snaps** by about 10–14px at the edges, on open and again on close. Hover speech labels **vanish in one frame** instead of drifting up and fading. The "Explore the room" chip has a separate cause: `.credits > :nth-child(3)` (SiteFooter.css) has the same specificity as `.credits > .discovery-hint`, comes later and overrides its delay, so it **arrives at 0.38s instead of 2.4s**. The held animations also keep some layers on the GPU permanently. (`.cover .stage { transform: translateZ(0) }` in App.css is a deliberate room-sized layer for Safari's rounded clip. It stays, so don't count it as a saving.)
- **The hand-off from the room to a page is the weakest moment.** On the first open of each section, the sheet shows "Opening…" for about 300ms. Cause: `React.lazy` always suspends on its first render, even after `preloadSections()` has fetched the chunk, and React 19 then holds the fallback for about 300ms. The sheet travels about 70% of its slide while still nearly transparent. On close it is cut off part-way (29% of its travel on desktop, 57% on phone) because the removal timer (`--folio-exit` + 20ms) starts before React commits `closing`. Then it pops away.
- **Some responses are too slow for how often people see them.** A speech label takes about 1.1s to become readable. The laptop terminal shows nothing for about 240ms and settles after 1.2–1.45s. *(Work tiles waiting 820ms for the map: already fixed in the live Work redesign, where files rise at 260ms + 45ms each.)*
- **The site carries more graphics weight than it needs.** At idle (1440×900, Retina) the GPU holds about 25M CSS px² of layer bounds. The two rain layers' bounds are about 6.6× larger than the glass they show through (bounds, not raster: Chrome only rasterises tiles inside the clip, so the real memory cost is smaller). Changing the time of day causes single-frame stalls of 100–983ms. The cause (still decode vs animated-loop decode) is not yet attributed.
- **The system has drifted.** There are about 10 easing curves and more than 15 hard-coded durations, and the code copies JS timers from CSS values by hand (`Desk.tsx` DRAWER_MS 420, `RecordCrate.tsx` DESK_FOLD_MS 440, `ShelfRow.tsx` 440/320, `flight.ts` EASE_DRAWER, `SectionPanel.tsx` LEAVE_MS 280). DESIGN.md §6 no longer matches the code: it still describes a 6px blur on the room and 560ms cascades. Three UI loops break its "no perpetual micro-loops" rule, and there is one bounce. halo-breathe is switched off by configuration (every `invite` in scene-layout.json is 0), not dead code. The work-map choreography is already gone in the live code.

---

## 2. Motion language

| | Proposal | What it replaces today |
|---|---|---|
| **Signature easing: enter and feedback** (about 80% of motion) | `--ease-out` (0.23, 1, 0.32, 1), already in tokens.css | Also covers `--ease-time` / `--lt-in` / the speech literal (0.22, 1, 0.36, 1), which look identical, and the marks curve (0.25, 0.6, 0.3, 1) |
| **Exit** | Movement on a new, gentle `--ease-exit` (0.4, 0, 1, 1), starting on the first frame. Opacity runs over the whole exit (linear), so the element is still visible while it moves | The panel's steep local `--ease-in` (0.55, 0, 1, 0.45) |
| **Sheets, drawers, flights** | `--ease-drawer` (0.32, 0.72, 0, 1), unchanged | The copy hard-coded in `flight.ts` |
| **The room** (crossfades, ambient, cat lean, lamp colour) | `--ease-sine` (0.45, 0, 0.55, 1), the CSS twin of `easeInOut()` in lib/motion.ts | About 10 literals, `--weather-ease`, the cat curve (0.4, 0, 0.2, 1), the lamp colour (0.65, 0, 0.35, 1). `--ease-in-out` (0.77, 0, 0.175, 1) stays for the turntable arm or folds into sine; decide in 2.7 |
| **Floating words** | `--ease-drift` (0.33, 0, 0.2, 1) | Speech exit and cat-text literals |
| **Durations: 3-step UI palette** | Use the **existing** tokens: **`--dur-quick` 160ms** (press, colour, focus) · **`--dur-soft` 240ms** (hover, labels, tooltips, small exits, tab ink) · **`--dur-panel` 460ms** (sheet, drawers, page cascade; today 420) · **`--dur-panel-exit`** 260ms (today 240) | 180/200 → quick; 200/220/260/280/320 → soft; 420, 440, 460, 520 → panel. Changing `--dur-panel` also moves the music and bookshelf drawers, so their JS timers must change in the same commit (2.7). Separate from the UI palette, the room keeps its own clock: 900ms scene, 1800ms view |
| **Entrance pattern** | Fade plus a 6–12px rise. Opacity finishes within 200ms, so anything that travels is solid while it moves. Stagger 45ms, capped at 6 items | Mixed. Some fades run as long as the slide (460ms) |
| **Exit pattern** | Moves from the first frame and takes about 60% of the entrance time (panel 260ms, 320ms on phone; small items 200ms). An element is removed **when its motion ends**, never on a fixed timer alone | `setTimeout` removal; exits that are cut off or missing |
| **Hover rules** | Visible response within about 100ms. Magnify 1.5–6%, 260ms in and 200ms out. Labels wait 320ms the first time, then appear almost at once while the visitor keeps exploring. No overshoot. Loops only inside the painting (cursor, ambient); UI cues play once | Labels wait every time, the genie starts slowly, one bounce, three UI loops |
| **Reduced motion** | Every movement becomes a 120–160ms opacity fade. Nothing scales, blurs or slides. The first room fade takes 400ms. (Note: `--dur-quick` is 1ms under reduced motion. Keep it for presses, but don't use it for fades that should stay visible) | Already true almost everywhere; six gaps listed in 1.5 |

---

## 3. Upgrades

### Phase 1: Quick wins (low risk, high impact)

**1.1 Let the designed exits and the room lean actually play**
- *What:* Entrance animations stop holding their final state once they finish: change `both` to `backwards` where the last keyframe equals the resting state, which is `speech-in`, `room-in` on `.cover`, `rise-in` on `.credits > *` and the masthead. **Exceptions:**
  - `greet-float` and the reduced-motion `greet-fade` end at opacity 0, and the greeting stays `data-visible` 100ms longer than its float (GREETING_FOR_MS 4700 vs 4.6s). Keep `both` on these, or the greeting flashes back to full opacity.
  - **The chip:** `.discovery-hint` rests at `opacity: 0`. Changing `hint-in` to `backwards` alone would make the chip **disappear** once it has arrived. Set its base opacity to 1 in the same change; the backwards fill hides it during the delay.

  Hover labels then drift up and fade as designed, and the room eases back over 460ms. **No `will-change` on `.cover`.** The transition promotes it while it runs. A standing hint would add a second layer the size of the room plus its 100px shadow, on top of `.stage`'s existing translateZ(0) layer, which is exactly the heavy pattern to avoid on the large Retina screen. Add a hint only if the Retina check shows a re-raster hitch at the end of the lean, and then on hover intent, not at open.
- *Optional, same mechanism:* the panel cascade (`.panel__page[data-enter] > .section > *`, `animation-fill-mode: both`, SectionPanel.css about line 350) holds transform and opacity on every content block for as long as the page is open. `backwards` is safe here (`folio-rise` and `folio-turn` only have `from` keyframes).
- *Where:* `HotspotSpeech.css:31`, `SiteFooter.css:322-332`, `Masthead.css:17`, `DiscoveryHint.css:23-24` (opacity and fill together), `SectionPanel.css:79-97`
- *Why:* An animation that holds its values blocks the transitions meant to follow it. The fix was injected live and works: the label fades 1.00 → 0 over about 600ms, and the room scales 1 → 0.985 over about 450–526ms.
- *Risk:* None for the labels, masthead and footer. Low for the chip once the base-opacity change is included. **Medium for the room lean:** it scales the whole room, and the lean has never actually animated on the large Retina screen. During the lean the backdrop also repaints its colour across the full screen every frame, so ship the backdrop-opacity change from 2.8 in the same change. Fallback: drop the lean and deepen the backdrop from 0.52 to 0.56. The snap goes away either way.

**1.2 The panel arrives solid and leaves completely**
- *What:*
  - **Open:** opacity takes 200ms (140ms on phone) while the slide keeps its 460ms on `--ease-drawer`. The backdrop may trail the sheet by 40ms on open.
  - **Close:** movement takes 260ms (320ms on phone, set as a phone-only `--folio-exit` so the existing `readDuration` backup still reads the right value) on `--ease-exit`. Opacity runs linear over the same time, so the sheet is still visible while it moves.
  - **Removal:** the dialog closes on the sheet's own `transitionend`. Filter on `event.target === sheet` because transitions inside the sheet (ink, progress, links) bubble up. Use `propertyName` `transform`, or `opacity` under reduced motion, where the sheet doesn't move. The existing timer stays as a backup. Clear the listener in the effect cleanup so a mid-close reversal still works.
  - **Backdrop on close:** it must end **no later than** the sheet. `dialog.close()` removes `::backdrop` at once, so a backdrop that lags the sheet on close would pop.
- *Where:* `SectionPanel.css:59-70, 113-133, 499-501`; `SectionPanel.tsx:118-127`
- *Why:* The measured problems: the slide is spent while the sheet is invisible, the exit is truncated and then pops, and the backdrop leads the sheet.
- *Risk:* Low. Routing, Escape, backdrop click and the close button keep working the same way. Only the moment the dialog is removed changes. Caveat: Chromium closes a modal at once on a first Escape that has no user activation inside the dialog (the code already handles this through the `close` listener). That path has no exit animation, and this change cannot add one.

**1.3 No "Opening…" flash**
- *What:* When a section's module has already been preloaded, render it without suspending. For example, `preloadSections()` stores each resolved `default` in a synchronous map, and `FolioPage` uses the plain component when it exists and the `lazy` one otherwise. The Suspense fallback is kept only for cold loads (deep links, a slow network). The word "Opening…" fades in only after 400ms (a CSS delay on `.panel__loading`).
- *Where:* `sections/registry.ts:13-20`, `SectionPanel.tsx:329, 359`, `SectionPanel.css:478`
- *Why:* Verified: "Opening…" showed from about 33ms to 341ms on every first open, even with the modules preloaded. `lazy()` suspends on its first render no matter what, and React 19 holds the fallback for about 300ms. With the fix, the header and body arrive together as one cascade.
- *Risk:* Low. Check every section through an object click, the masthead, a deep link and a page turn.

**1.4 The discovery chip arrives on time and leaves gracefully**
- *What:* Give its delay a rule that wins over the footer stagger, such as `.credits > .discovery-hint:nth-child(n)`, or move the delay into its own declaration after SiteFooter.css (the exact time is set in 2.1). Add a 200ms exit (fade plus a 4px drop). `useDiscoveryHintVisible()` unmounts the chip at once, so `DiscoveryHint.tsx` needs a local "leaving" state that stays mounted until `animationend`. The glint plays once on arrival instead of forever.
- *Where:* `DiscoveryHint.css:24, 50, 148-158`; `SiteFooter.css:341-343`; `DiscoveryHint.tsx:12-14`
- *Why:* It currently arrives with the chrome and competes with the greeting, it vanishes in one frame, and its loop breaks DESIGN.md.
- *Risk:* Low. Depends on the base-opacity change in 1.1.

**1.5 Close the reduced-motion gaps**
- *What:* With reduced motion on:
  - The cat no longer leans, also on touch. Cause: `.scene-object.cat { --hover-scale: 1.025 }` at about line 1428 comes later than the reduced-motion and touch overrides and has the same specificity.
  - Highlighted objects get no `will-change` (the transition and scale are already removed).
  - Generic tags lose their 4px settle and keep only a 120ms fade.
  - Player icons fade only, with no scale or blur.
  - The lamplight wash and lamp hover glow take 120ms.
  - The first room fade takes 400ms.
- *Where:* `HeroScene.css` (~497-512, 569-580, 620-645, 1428-1434); `SiteFooter.css:187-196, 274-298, 345-357`; `LampLiquid.tsx:266-280`
- *Why:* Verified: the cat still leans (scale 1.025) with reduced motion on. The site's own rule says movement becomes fades.
- *Risk:* None.

**1.6 Work drawings: nothing vanishes on hover** *(owned by the work-section session)*
- *What:* The tile cascade delay is **already done** in the live redesign (`desktop.css`: 260ms + 45ms each), so drop that part. What remains in live `work-thumbs.css` (lines 50-101): the drawings rest on their finished state, so hovering doesn't wipe them first. The chord notes do a small 1 → 1.06 → 1 "played" pulse instead of popping from 0.2 to 1.25. The stroke redraws stay as they are. Also note `wdesk-rise … both` on `.wdesk__file`: it is the same held-animation pattern as 1.1 and may block the file's own transform transitions.
- *Where:* live `work/thumbs/work-thumbs.css:50-101`, `work/desktop.css:457-460`
- *Why:* The notes are the site's only bounce, and quick sweeps across the files flicker.
- *Risk:* None. **Hand this to the work-section session; don't edit the Work files from here.**

**1.7 Keyboard parity in the panels**
- *What:* Use 2px focus outlines on the masthead links and time pills (today 1.5px). The desk-pile book nudges on focus. (The Work thumbnail lift on focus goes to the work-section session; in the live code the tile is `.wdesk__file`.)
- *Where:* `Masthead.css:131-136`, `SceneControl.css:154-158`, `desk-pile.css:81-85`
- *Risk:* None.

### Phase 2: Craft (medium effort)

**2.1 One introduction, one focal point at a time**
- *What:* Sequence the first visit like one sentence. The room settles (0–0.9s). The greeting follows (0.55s to about 4.2s): its float shortens from 4.6s to 3.6s, and **`GREETING_FOR_MS` must shrink with it** (keep it at least the float length). The halo sweep starts as the greeting fades: `DISCOVERY_DELAY_MS` goes from 1100 to about 1900, since it counts from `settled` (entered + 1300ms), so the sweep starts at about 3.2s. Objects are 180ms apart instead of 260ms; change both the CSS `calc(var(--discover-order) * 260ms)` and the JS `DISCOVERY_TOTAL_MS`. The chip lands as the last halo peaks (about 4.5s after `data-entered`; its CSS delay counts from there because the animation stays paused until entered) and glints once.
- *Where:* `HeroScene.tsx:70-84, 118-158`; `HotspotSpeech.css:80-130`; `HeroScene.css:263-275`; `DiscoveryHint.css`
- *Why:* Today three cues compete between 2.3s and 4.6s. Choreography works best with one focal point at a time.
- *Risk:* Low. Only start times change. The entrance gate is untouched, and reduced motion still skips the sweep (the chip simply shows).

**2.2 Faster answers on hover**
- *Speech labels:* The first one still waits 320ms (keyboard stays immediate), but its rise shortens from 760ms to 480ms. After a label has shown, the next one within about 600ms is "warm": 0–120ms wait and a 320ms rise. This needs a new data attribute from `HotspotLayer`, alongside `data-immediate`. Generic tags get the same warm rule. The exit shortens from 620/820ms to 360/480ms. The idle float plays once instead of looping.
- *Laptop terminal:* Opening goes from 1200ms on a sine curve to 800ms ease-out, so it visibly pours out at once. This needs an `easeOut()` next to `easeInOut()` in lib/motion.ts. Closing goes from 900ms to 600ms; the `typed` reset timer uses `CLOSE_MS` and follows automatically. Typing starts at about 700ms instead of 1050ms (`lt-type` delay in CSS). The reversal logic and the reduced-motion fade stay as they are.
- *Time/weather pills:* The thumb slides in 280ms instead of 420ms (`--dur-time`; it also times the icon scale, which is fine). Tooltip names appear at once as the pointer moves across neighbouring options. CSS alone can't tell a first hover from a later one, so this needs a small "warm" attribute on the group.
- *Cat:* A slow lean in (520ms) and a quick settle back (260ms).
- *Where:* `HotspotSpeech.css`; `HotspotLayer.tsx:77-85, 155`; `HeroScene.css:620-645, 1389-1397, 1428-1434`; `LaptopTerminal.tsx:53-54, 105-122`; `lib/motion.ts`; `SceneControl.css:14-15, 207-213`
- *Why:* Measured: about 1.1s until a label is readable, and the genie is only 10% open 325ms after hover. The first delay should guard against accidental triggers; later ones should feel instant.
- *Risk:* Low.

**2.3 Room objects acknowledge a press**
- *What:* On pointer-down, the object sinks 0.015 below its hover size in 120ms, and releases on pointer-up, cancel or leave. On touch, where `--hover-scale` is 1, it goes to 0.985. Not on Enter/Space, and not with reduced motion. Pointer events arrive on the SVG `<a>` paths in `HotspotLayer`, but the scale lives on `.scene-object` in `HeroScene`. A `pressed` id has to travel up (like `onActiveChange`) and be set as an attribute. **`.power-light` copies the record player's hover scale separately**, so it needs the same press state, or the red light slides off its button. The laptop terminal follows on its own because it sits inside the laptop's box.
- *Where:* `HeroScene.css:221-227` and the `.power-light[data-highlighted]` rule (about line 1449); pointer handlers in `HotspotLayer.tsx`; attribute plumbing in `HeroScene.tsx`
- *Why:* The room's main navigation gesture currently gives no "heard you". Click to first sheet motion measures 160–350ms.
- *Risk:* Low. It adds a state only; hit areas and destinations are unchanged.

**2.4 A cheap first frame for every opening** *(only after measuring on real hardware)*
- *What:* Keep `showModal()` where it is. Between it and the existing `requestAnimationFrame(() => setState('open'))`, wait for the first visible images to decode (at most 120ms) and two frames, then open. Start those decodes on hover intent. Apply the same idea to the record take-out (sleeve and vinyl art before the flight) and the book drawer (cover before the turn).
- *Where:* `SectionPanel.tsx:84-95`; `music/RecordCrate.tsx`, `music/flight.ts`; `bookshelf/BookDetail.tsx`
- *Why:* Measured first-frame stalls: 67ms on desktop open, 133ms on phone open, 233ms on the take-out and 383ms on the book drawer. These were measured headless, on Chrome's software rasteriser, so they are inflated. Re-measure on the Retina machine and do this only where a real stall over about 20ms remains.
- *Risk:* Low to medium. The room is inert and the sheet invisible during the wait, so pair it with 2.3 so the press still answers. In the worst case an opening waits 120ms longer.

**2.5 A smooth time-of-day change (timing only)**
- *What:*
  - **Diagnose first.** Trace whether the 100–983ms frames come from decoding the incoming still or from the animated loop that mounts 350ms in (`LOOP_DELAY_MS`).
  - **If it's the still:** decode it before the crossfade starts (at most 160ms, hidden by the thumb slide). If the visitor retargets mid-wait, cancel the pending decode so the existing freeze-and-retarget logic still runs from the current opacities.
  - **Pre-decode when idle:** only the next likely view, not all of them. Each decoded view stays in memory, which adds up on Retina.
  - **If it's the loop:** delaying its swap changes the clip swap logic, which the guardrails protect and the scope excludes. Keep the 350ms fetch debounce. Change when the loop is *shown* only with the owner's explicit OK.
- *Where:* `window/WindowView.tsx:126-137, 160-164`
- *Why:* This is the biggest stall on the site (single frames of 100–983ms).
- *Risk:* Low for the still path. What the control does, the 1800ms fade and the mid-fade retargeting all stay the same.

**2.6 GPU headroom, with no visible change**
- *What:*
  - **Rain:** tighten the two rain sheets (`inset: -30% -15%`, rotated 10°) to the smallest box that still covers the glass after the rotation, plus one tile of travel. Measure raster memory (DevTools Layers → memory estimate), not layer bounds, before and after. Chrome already skips tiles outside the `overflow: hidden` clip, so expect less than the 11M device px estimate.
  - **Hidden layers:** take invisible full-room light layers (`.time-light`) and hidden glass tooltips (`backdrop-filter`) off the GPU once their fade ends, with `visibility: hidden` delayed by the fade duration.
  - **Lamp glare:** shrink `.lamp-colour--glare` (today `inset: 0`, a full-room screen-blend layer with a 1080ms opacity transition) to a box around the bulb, and re-base `--bulb-x/--bulb-y` to that box.
  - **Phone:** pause the rain and tower animations behind an open page with CSS (`html[data-panel] …`), not through the player. Check first that the window isn't in the strip of room left visible above the phone sheet; if it is, the frozen rain would show.
- *Where:* `HeroScene.css:1163-1170, 1224-1256, 1524-1555`; `SceneControl.css:172-217`
- *Why:* The Retina screen dropped layers once before. This also makes room for the lean in 1.1.
- *Risk:* Low. Compare screenshots at 1440, 1920 and 390 for every time and weather.

**2.7 One motion system in code and docs**
- *What:*
  - **Tokens:** put the section 2 table in `tokens.css`, extending the existing `--dur-*` and `--ease-*` tokens rather than adding parallel names, and replace the literals.
  - **JS timing:** JS stops copying CSS timings and either reads the tokens or waits for the motion to finish, through one small "after motion" helper. That covers the bookshelf's 440/320ms against the CSS 420/300ms, `Desk.tsx` DRAWER_MS and `RecordCrate.tsx` DESK_FOLD_MS (both tied to `--dur-panel`, which moves to 460ms here), the page-leave timer and the flight curve.
  - **Page turn:** the tab ink and the number roll start together.
  - **halo-breathe:** either remove it together with its switch (`INVITE`, `data-inviting` in HeroScene.tsx, the `invite` field in scene-layout.json and layout.ts), or keep it as a documented option. Don't delete only the CSS.
  - **Docs:** update DESIGN.md §6 (blur on the room, 560ms cascade, 420ms panel).
  - *(The work-map removal is already done by the Work redesign.)*
- *Where:* `styles/tokens.css:59-79`, `SectionPanel.css:18-21`, `SceneControl.css:14-15`, `music/flight.ts:15`, `bookshelf/ShelfRow.tsx` (*live* 27-29), `music/Desk.tsx:8`, `music/RecordCrate.tsx:12-19`, `HeroScene.tsx:60-61, 287`, `DESIGN.md`
- *Risk:* Low; mostly no visible change. Ship it as its own change and compare before and after.

**2.8 Lighter panel internals**
- *What:*
  - **Job page:** enters with fade plus rise and no blur (`cv-page-in` animates `filter: blur(2px)`).
  - **Backdrop:** fades by opacity instead of transitioning `background-color`. Today the whole screen repaints every frame on open and close. **Move this into Phase 1 with 1.1.**
  - **Drawers:** the bookshelf, desk and player drawers animate `grid-template-rows`, which by nature reflows everything below them, and `contain` cannot isolate a change in the drawer's own height. What is achievable: `contain: layout paint` on each `__inner` to cut the cost inside it. A clip or transform reveal would remove the reflow, but it changes how the drawers look, so it is a design decision, not a free optimisation.
  - *(Dropped: replacing the cat yawn's letter-spacing with a transform. The span is absolutely positioned, so its relayout is already tiny, and `scaleX` would visibly stretch the glyphs instead of spacing them.)*
- *Where:* `panel-sections.css:808-820`, `SectionPanel.css:59-70`, `bookshelf.css` (*live* drawer rules about 420-440), `music.css:491-498, 750-760`
- *Why:* DESIGN.md says "no blur inside the scrolling panel", and these animations currently repaint or relayout on every frame.
- *Risk:* None to low.

### Phase 3: Signature moments

**3.1 The room remembers where you were.** The object you opened keeps its halo lit while the page enters, then lets it fade. When the page closes, that object swells its halo once. `halo-discover` today is driven by `.scene[data-discovering]` for every object, so it needs a per-object attribute. This links cause and effect with no new artwork or layers. Skipped with reduced motion. *Where:* `HotspotLayer.tsx`, `HeroScene.tsx`, `SectionPanel.tsx` (on close), `HeroScene.css:263-275`. *Risk:* low.

**3.2 Swipe the phone sheet away.** Drag down with resistance, from a dedicated grab handle or from vertically dominant drags only. The top bar holds the sideways-scrolling tab row (`.panel__nav`), and a drag on it must not steal horizontal tab scrolling. Past 25% of the height, or with a quick flick, the sheet leaves through the normal close; otherwise it springs back on `--ease-drawer`. *Where:* `SectionPanel.tsx/.css` (phone only). *Risk:* medium. It must not fight page or tab scrolling, and the Close button and Escape stay.

**3.3 The section number rolls in on first open too,** with the same 460ms counter roll that page turns already use, so opening and turning share one signature. This needs a TSX change: `rolls` is true only when turning with a previous number (`SectionPanel.tsx:328`), so add a roll-in-only variant with no `__num-from`. *Where:* `SectionPanel.tsx:328-349`, `SectionPanel.css:433-464`. *Risk:* none.

**3.4 Work drawings come alive on phones.** Each file's drawing plays its one small motion once, when it is 60% in view on touch screens; it is skipped with reduced motion. Target the live `WorkDesktop.tsx` (`.wdesk__file.wtile[data-play]`); `ProjectGrid.tsx` no longer exists. *Owned by the work-section session.* *Risk:* low.

**3.5 (Optional) A genie with momentum.** A spring drives the laptop terminal, so moving in, out and back in reverses smoothly without stopping. It stays a main-thread tween either way: `clip-path` isn't composited. *Where:* `LaptopTerminal.tsx`, `lib/motion.ts`. *Risk:* low to medium.

### Where the reviews disagreed, and the call

| Question | Views | Decision |
|---|---|---|
| Panel exit curve | Accelerate away (motion-design) vs "never ease-in for UI" (Emil) | Movement on gentle `--ease-exit`, starting on the first frame, so it still leaves. Opacity runs linear over the whole exit, so the sheet is not invisible while it moves (the same fault this plan fixes on open). Removal happens on the sheet's own transition end. |
| Phone sheet opacity | None / 140ms / 200ms | 140ms: solid in flight, with only the edge softened. |
| Speech label timing | 460, 480 or 520ms rises; DESIGN.md says 180–220ms | Keep the 320ms guard on the first label, a 480ms rise, then the warm path. The exit lands in the middle (360/480ms) to keep the drift character. The float plays once rather than being removed. |
| Genie | Spring vs ease-out at 700, 800 or 900ms | 800ms ease-out now (smallest change); the spring is the optional 3.5. |
| Work notes | Notes at 1.05, as a pulse, or from 0.6 to 1 | A pulse to 1.06 that rests on the finished drawing, the only option where notes never vanish. Tile delay: already done in the live redesign. |
| Chip exit and glint | Ease-in vs ease-out; one glint vs two | `--ease-exit` at 200ms, matching the panel. One glint. |
| Pausing the room behind a page | Through the room's motion switch vs CSS pause | CSS pause, phone only, and only if the window isn't in the visible strip. The motion switch also drives the clips and the player label, which are core. |
| `will-change` on the room during the lean | Promote while open vs let the transition promote | No standing hint (see 1.1); add it only if the Retina check shows a hitch. |
| **Dropped** | — | Weather filter crossfade (re-architects the weather rendering; medium risk). Origin-offset sheet and adaptive quality sentinel (speculative). Permanent layer promotion on hover objects (works against the GPU headroom). Genie blur removal and lamp-glare timing (marginal). Cat yawn letter-spacing → transform (visible change, negligible gain). Work tile delay and work-map removal (already done). |

---

## 4. Guardrails

**Must not change**
- **The entrance gate:** wait for images and fonts (3.5s cap), `data-entered`, settle after 1300ms, heavy clips deferred, and no full-room blur or filter. The `animation-play-state: paused` gate on `.cover`, `.masthead` and `.credits > *` stays.
- **Clip players and artwork:** the woman, cat, coffee and window WebPs, their swap logic (including `LOOP_DELAY_MS`; see 2.5), and the PNGs.
- **Hotspots:** hit shapes, what each object opens, keyboard order and label text.
- **Panel routing:** hash routes, deep links, Escape, backdrop and Close, focus returning to the object, and page-turn direction.
- **Time and weather:** what each pill does, the 1800/2600ms fades, retargeting, and the hour change from the visitor's clock.
- **Reduced motion:** it may only be extended, never reduced.
- **Deliberate layers:** `.cover .stage { transform: translateZ(0) }` (Safari rounded clip) and the clip layers' `will-change`.

**How each phase is checked**

| Check | Phase 1 | Phase 2 | Phase 3 |
|---|---|---|---|
| **Frame-by-frame probes** (existing scratchpad scripts) | Lean eases about 0.985 over 460ms; label exit fades over at least 300ms; chip's computed delay is correct **and it stays visible after arrival**; greeting ends at opacity 0 with no flash; panel close reaches its end before removal | Plus stall probe on panel open, take-out, book drawer and time switch (p95 ≤ 20ms), on real hardware, not headless | Plus a swipe gesture trace |
| **Reduced motion** (emulated `reduce`) | No transform, blur or scale transitions on the cat, labels, tags, player or panel; entrance animations release after finishing | Warm labels and press feedback absent | Halo memory and number roll absent |
| **Retina / GPU** (the large screen) | Open and close each section 10× at night in rain; any dropped layer means using the lean fallback. Confirm no extra room-sized layer while a page is open | Layer budget at 1440×900 Retina: idle ≤ about 18M CSS px² of bounds, raster memory recorded, no animated layer > 1.5M; pixel compare at 1440, 1920 and 390 | Same budget |
| **Keyboard** | Tab through the room (magnify, outline, immediate label, genie); Enter opens; Escape closes with a full exit **after any interaction inside the panel** (a first Escape with no interaction may close at once, which is Chromium behaviour); focus returns; 2px rings | Warm path doesn't delay focus labels; no press scale on Enter | Halo memory works after Escape |
| **Mobile** (390×844 and tablet) | Sheet solid in flight; close completes; no "Opening…" | Tap press feedback; rain pauses only behind the sheet and isn't visible frozen | Swipe vs vertical and tab scroll on a real phone; file drawings play once |
| **Tests** | `npm run typecheck`, `npm test` | Same | Same |

**Process:** ship each phase, and 2.7 on its own, as separate changes. Check on :5173 and compare against the stable :5175. :5175 is a snapshot, so expect the Work section and some section internals to differ. Several sessions are editing the same files: panel-upgrade works on `SectionPanel`, and work-section on the Work section and its CSS (1.6, the Work part of 1.7, and 3.4 belong to them). Coordinate with them before touching those files.

---

## Checked against the code

Files read: SectionPanel.tsx/.css, registry.ts, App.tsx/App.css, HotspotSpeech.css, HotspotLayer.tsx, HeroScene.tsx/.css, entrance.ts, SiteFooter.css, Masthead.css, DiscoveryHint.tsx/.css, lib/discovery.ts, lib/motion.ts, LaptopTerminal.tsx, WindowView.tsx, SceneControl.css, tokens.css, the music, bookshelf and desk-pile CSS and timers, work-thumbs.css, desktop.css, DESIGN.md §6, and a diff of live `src/` against the :5175 snapshot.

**Would break core behaviour**
1. **1.1, the chip:** `.discovery-hint` has a base `opacity: 0`, so "change `both` to `backwards`" would make it vanish after arriving. Added the base-opacity change.
2. **1.1, the greeting:** `greet-float` and `greet-fade` end at opacity 0, and the greeting stays visible 100ms past its float. Excluded them, or the greeting flashes back.
3. **1.2, closing on `transitionend`:** child transitions bubble up to the sheet. Added a target and property filter, plus the reduced-motion case where only opacity transitions.
4. **1.2, the backdrop on close:** a backdrop that lags the sheet on close would be cut off by `dialog.close()`. It must end no later than the sheet on close.
5. **2.5, the loop swap:** changing when the loop swaps in contradicts the plan's own guardrail and the scope. Reduced to "diagnose first; the still path only, unless the owner agrees". Pre-decoding limited to the next view because of memory.
6. **2.3, the press state:** pointer events live in the SVG layer and the scale lives on `.scene-object` in HeroScene, so the state needs plumbing. `.power-light` copies the hover scale and must also get the press state, or it drifts off its button.

**Wrong or already done**
1. **Work is redesigned in live `src/`:** `ProjectGrid.tsx`, `project-grid.css` and `work-map.css` no longer exist, the tile delay is already 260ms + 45ms, and the work-map is gone. 1.6, 1.7 (Work part), 2.7 (work-map) and 3.4 were re-scoped to the live files and handed to the work-section session.
2. **2.7, durations:** the duration tokens already exist (`--dur-quick` 160, `--dur-soft` 240, `--dur-panel` 420, `--dur-panel-exit` 240). The plan now extends them, and notes that moving `--dur-panel` to 460 moves the drawers and the `Desk.tsx` and `RecordCrate.tsx` timers.
3. **halo-breathe** is not dead code: it is switched off through `invite: 0` and `INVITE` / `data-inviting`. Removing it means removing the switch.
4. **2.8, drawers:** "contain the relayout" isn't possible for a `grid-template-rows` height change. Rewritten.
5. **2.8, cat yawn:** dropped. The span is absolutely positioned, so the gain is negligible, and `scaleX` visibly changes the glyphs.
6. **1.3:** added the real cause (`lazy` always suspends; React 19's roughly 300ms fallback hold) and a concrete fix.
7. **3.3:** needs a TSX change (`rolls` is only true when turning), not CSS only.
8. **2.1:** the coupled JS constants (`GREETING_FOR_MS`, `DISCOVERY_DELAY_MS`, the `* 260` in `DISCOVERY_TOTAL_MS`) are now named.
9. **2.2:** the new `easeOut()` in lib/motion.ts is now named.
10. **Escape check:** Chromium closes the dialog at once on a first Escape with no activation inside it, so "Escape closes with a full exit" is now conditional.
11. **Line numbers** come from the :5175 snapshot; live HeroScene.css is offset by one after line 1301, and the bookshelf, music and panel-sections files differ.

**Retina performance**
1. **No `will-change` on `.cover`:** it would add a second room-sized layer (plus the 100px shadow) on top of `.stage`'s translateZ(0) layer, and applying it at open gives no head start.
2. **Backdrop to opacity, moved into Phase 1:** the `background-color` backdrop transition repaints the full screen on every frame, at the same moment the new full-room lean runs.
3. **Rain and layer savings:** these were computed from layer bounds. Chrome culls tiles outside the clip, so budgets must use raster memory. The rain sheet can't shrink below the rotated cover plus one tile of travel.
4. **2.4 stall figures:** these are headless (software raster) numbers. The work is gated on re-measuring on real hardware, and paired with press feedback because the room is inert during the wait.
5. **1.2, exit opacity:** an ease-out opacity on exit would make the sheet invisible for most of its travel, the same fault the plan fixes on open. Opacity now runs over the whole exit.
6. **Phone rain pause:** the phone sheet leaves a strip of room visible, so check the window isn't in it before freezing the rain.