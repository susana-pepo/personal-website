# Animating the cat and the record player: tools research (Nov 2026)

Researched with live web sources; prices and features change, so re-check the links before buying.

**Recommendation: rig the cat in Rive, spin the vinyl in CSS, and do the layer prep by hand with AI inpainting**

No tool in Nov 2026 can take the flat cat PNG and auto-split it into a rig. The layer prep is unavoidable, whichever tool you choose.

**Cat, best option: Photoshop or Krita prep, then Rive**

Why Rive:
- Mesh and bones deform painted fur in place, so it is not the CSS scaling you rejected.
- A visual state machine handles idle → pet → back to sleep, plus hover listeners.
- It renders to a transparent canvas, so Safari works and there is no VP9-alpha problem.
- The runtime is MIT licensed.
- Docs: https://rive.app/docs/editor/manipulating-shapes/meshes

Cost:
- The Free plan adds a splash screen to exports.
- Cadet removes it. The pricing page lists Cadet at $9/seat/mo, but the docs say $17 monthly or $108/yr (https://rive.app/pricing, https://rive.app/docs/account-admin/pricing.md). This conflict is unresolved.
- Exports keep working after you downgrade (https://rive.app/blog/rive-s-new-9-mo-plan), so one paid month can be enough.
- Photoshop costs about $23/mo, with 25 generative credits (https://www.adobe.com/creativecloud/pricing). Krita plus AI Diffusion is the free alternative if you have a GPU (https://github.com/Acly/krita-ai-diffusion).

Effort for a beginner: about 15–25 h in total.
- 2–4 h of prep
- 1–2 days learning Rive
- 3–6 h for breathing
- 3–6 h for the reaction and state machine

Pipeline:
1. **Prep.** Cut the cat into body, head, ear L, ear R and tail. Use Generative Fill to paint the hidden ruff and neck under the head and the body behind the tail. Paint an eyes-open head variant. Gemini image editing can draft a raised head (https://deepmind.google/models/gemini-image/pro/), but expect the stripes to drift.
2. **Rig and animate.** Auto-trace a mesh on each layer and put 2–3 bones through the torso. Breathing is a slow 3.5–4.5 s loop.
   - Reaction: tilt the head about 8–12° and lift it slightly, flick an ear, swap to the open eyes, then blend back to Idle.
   - Hover: a small head turn or ear twitch through a Pointer Move listener.
   - Keep triangle stretch under about 15%, or the fur turns rubbery.
3. **Export** a .riv file with a 1920x1080 artboard that matches your scene, with the cat placed at its painted position.
4. **Integrate.** Use @rive-app/react-webgl2 (about 648 KB brotli, mostly a one-time WASM download, per https://rive.app/docs/runtimes/runtime-sizes.md). Put one absolutely positioned canvas over the video with Fit.Cover and center alignment, matching the video's object-fit so the coordinates line up.
   - Drive it from JS with `useStateMachineInput` (a `pet` trigger and a `reduced` boolean).
   - Listen for Rive events to talk back to React.
   - Reduced motion: check `matchMedia('(prefers-reduced-motion: reduce)')`, then pause or set the static input. It is not automatic.

**Cat, runner-up: PixiJS breathing mesh plus an AI "pet" clip**

- **Breathing:** a PixiJS v8 MeshPlane (https://pixijs.com/8.x/guides/components/scene-objects/mesh) driven by a hand-painted grayscale mask moves the ribcage 1–3 px. It is MIT licensed, about 1 day of JS work, and loops forever without seams.
- **Pet clip:** Adobe Firefly Video with Transparent background mode, using the sleeping PNG as both the first and last frame (https://helpx.adobe.com/firefly/web/work-with-audio-and-video/work-with-video/generate-videos-with-transparent-backgrounds.html).
- **Delivery:** stacked-alpha AV1 + HEVC (https://jakearchibald.com/2024/video-with-transparency/). Swap between the PNG and the video in `requestVideoFrameCallback`.
- **Uncertain:**
  - Firefly's current pricing (launch price was $9.99/mo) and how well it holds a painterly style.
  - Budget 5–15 generations.
  - Kling 3.0 is the fallback, but it has no alpha.

**Vinyl, best option: CSS "flatten, spin, re-squash"**

It costs nothing, adds 0 KB and takes 2–4 h, and an affine squash is indistinguishable from true perspective at this size.

1. **Prep** four layers in Photopea or Photoshop: the static player body, the disc un-squashed to a true circle, the static sheen (`public/media/scene/glow/vinyl-sheen.png` already exists), and the tonearm. Use Remove to rebuild the platter under the arm. The label must be asymmetric, or the spin won't read.
2. **Animate.** Rotate the disc inside a parent set to `perspective() rotateX(~62deg) rotateZ()`, tuned until it sits on the painted ellipse. Spin with the Web Animations API (1.8 s per turn is 33⅓ rpm) and ease `playbackRate` up over about 0.8 s and down over about 1.5 s. Rotate the tonearm 18–25° from its pivot.
3. **Integrate.** A React `playing` state toggled by a click. Start Web Audio on that same click later, when you add opt-in music.
4. **Reduced motion:** no spin.

If the disc is strongly keystoned, use a PixiJS PerspectiveMesh instead. Putting the vinyl inside the Rive file is also fine (one runtime), but it is not needed.

**Avoid**

- **Spine Essential ($69):** it has no meshes. Spine Professional ($379, https://esotericsoftware.com/spine-purchase) is a valid alternative to Rive if you want physics on the tail, but you would script the states in JS.
- **Lottie:** it cannot mesh-warp raster art, so you get the CSS look again (https://docs.lottiefiles.com/en/integrations/after-effects/09_lottie-compatibility).
- **Live2D:** only worth it if you commission a rigger (about $120–250).
- **Discontinued or immature tools:** DragonBones, Creature, Inochi2D, Meta Animated Drawings.
- **Auto layer-split tools on the cat:** See-through, Canva Magic Layers and Qwen-Image-Layered. Qwen is worth one $0.05 test on the record player only.
- **AI video for the vinyl.**
- **WebM alpha on its own:** it only works in the Safari 27 beta.
