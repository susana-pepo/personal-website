"""Build the woman's web animation (her clips) and her chair, from the original exports.

Usage: python3 scripts/build-woman.py [--clip NAME] [--width 1024] [--quality 72] [--chair-only] [--breath]
       (or: npm run scene:woman)   --clip builds one clip (run one per clip in parallel to save time);
       the "writing" clip also writes the chair, the still and her box in scene-layout.json.
Requires Pillow and numpy. Reads (never changes):
  portfolio-website-assets/public/media/woman-*.json         her clips (Lottie exports of transparent frames)
  portfolio-website-assets/public/media/originals/chair.png  the armchair with its throw
Writes public/media/scene/woman/:
  woman-<clip>.webm   each clip, without the chair (the chair is drawn over it), as transparent
  woman-<clip>.mov    video (what the page plays; scripts/clip_video.py); its animated WebP, which
                      later steps read back, is kept in portfolio-website-assets/built/
  chair.webp          the chair, drawn over her
  woman-still.webp    the shared first frame with the chair on top: shown with reduced motion or a
                      paused room, and the source of her hover outline

  1. Every clip is placed on the 1920x1080 canvas the same way (WOMAN below), in one box shared
     with the chair, so the chair always sits over her and they magnify together on hover.
  2. Each clip is her animation exactly as exported: every frame, each shown for as long as the
     export shows it (30 frames a second; held frames stay held). Nothing is cut, smoothed,
     slowed or re-timed. (The other clips' first ENTRY frames ease in from the home clip's
     first frame, which theirs differ from by about one frame's movement.)
  3. All the clips start from the same picture of her (the exports were made from one still).
     After its last frame, each clip has a short bridge (BRIDGE frames) that eases her back to
     that shared first frame, so any clip can follow any other, or itself, without a jump. The
     page plays them in a calm random order (src/scene/womanClips.ts).
  4. Before anything else, each frame is prepared: one clean pen (steady_pen), the light held
     to the home frame (hold_light), the hair gaps filled (fill_hair_gaps), and the generated
     video's shimmer calmed along optical flow (calm_shimmer). Movement is never changed.
     Once finished, the export's one-frame specks are quieted (quiet_specks): small flecks that
     flash for a single frame in a still place, mostly on her outline.
  4d. Her neck (paint_neck_seq): the export left it out, so the room's curtain showed through;
     it's painted in her skin tone behind her hair, following her head, and the collar's top edge
     takes the sweater's own colour.
  4e. The notebook's outline (notebook_outline): the export's stair-stepped edge with a grey
     line on its steps is smoothed and redrawn as one continuous line.
  4c. Her hair's outer lock (hair_rim): the export left it a mottled grey-green, its old
     background mixed in; it takes the colour of the hair just inside, keeping its own light
     and shade.
  4a. The pen (steady_pen): the export's flickering pen is replaced in every frame by one clean
     pen, moved exactly as the frame's pen moves (wherever it can be followed).
  4b. Hair gaps (fill_hair_gaps): the export's see-through slivers between her outer strands,
     and the old background caught in them, take the colour of the hair around them.
  5. Edges (refine_edges): the export's background colour is repainted out of her outline and
     the chair's, stair-steps are softened, and a light wrap screens a touch of the room's light
     onto the outermost edge. Transparent pixels carry the figure's colour and the encoder keeps
     them exactly, so compression can't fringe.
"""
import argparse
import json
import os
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter, ImageSequence

from clip_video import kept, write_videos

ROOT = Path(__file__).resolve().parent.parent
# Her clips, in the order the page lists them. The first is the home clip: its first frame is the
# shared pose every bridge returns to, and the still.
CLIPS = {
    'writing': ROOT / 'portfolio-website-assets/public/media/woman-straight.json',  # writing
    'page': ROOT / 'portfolio-website-assets/public/media/woman-page.json',  # writing, then turning a page
    'calm': ROOT / 'portfolio-website-assets/public/media/woman-clip3.json',  # writing, more slowly
}
HOME = 'writing'
# Her breath, played at rest between clips (built from the home clip's first frame: --breath).
BREATH_LIFT = 0.0035  # her shoulders' rise at full breath in, as a fraction of the box's width
BREATH_SECONDS = (1.9, 0.25, 2.4)  # breathing in (a little quicker), a soft pause, breathing out
BREATH_FPS = 15  # the motion is slow: 15 frames a second are plenty
CHAIR_SRC = ROOT / 'portfolio-website-assets/public/media/originals/chair.png'
OUT = ROOT / 'public/media/scene/woman'
LAYOUT = ROOT / 'src/scene/scene-layout.json'

# Where each source sits on the canvas. WOMAN was fitted so her notebook and writing hand land
# where the earlier export's did, on the desk (the wavy-haired one sat at scale 0.70396, x 349.29, y 11.34).
WOMAN = {'scale': 0.75882, 'x': 348.94, 'y': -36.36}  # moved and resized with the sandbox (?sandbox=1)
CHAIR = {'scale': 0.42709, 'x': 366.85, 'y': 751.94}  # moved with her (they share one box)
SOURCE_FPS = 30  # the exports' frame rate: kept exactly
BRIDGE = 10  # frames (1/3 s) after a clip's end that ease her back to the shared first frame
ENTRY = 6  # frames at the start of the other clips that ease in from the shared first frame (theirs
           # differ from it by about one frame's movement: this makes the change invisible)
HAIR_ZONE = (0, 780, 600, 1500)  # source px x0, y0, x1, y1: the hair down her back (below the jaw,
                                 # left of the sweater's front), where the export leaves gaps
HAIR_CLOSE = 9  # source px: see-through slivers up to about twice this wide get filled
# The pen: the export redraws its gold bands and highlights a little differently in every
# frame (a painful flicker). It's rigid, so in every frame it's replaced by one clean pen (the
# home clip's first frame's), moved exactly as the pen moves in that frame. Source px, measured
# on that frame: the region it's tracked in, its barrel's centre, axis, and extent from cap to nib.
PEN_CROP = (660, 840, 1000, 1220)
PEN_CENTRE = (157.0, 204.0)  # within PEN_CROP
PEN_AXIS = (0.483, 0.876)
PEN_SPAN = (-76, 121, 10.5)  # from the centre along the axis: cap end, nib end; half its width
# The light: each export brightens slowly as it plays (about 10-15% by its end), so the jump
# back to the shared first pose read as the light changing. Every frame's exposure is held to
# the home frame's, measured where she hardly moves (source px boxes: her sweater's back, her hair).
LIGHT_PROBES = ((300, 850, 650, 1250), (80, 600, 280, 1000))
# The shimmer: the generated video redraws fine detail (hands, hair strands, the face) a little
# differently every frame. Each frame is blended with its matches in the CALM_REACH frames either
# side, followed by optical flow and only where the match is confirmed both ways, so it calms
# without blurring or ghosting any movement (needs OpenCV: pip install opencv-python-headless).
CALM_REACH = 3
CALM_SIGMA = 7.0
CALM_WEIGHTS = (1.0, 0.85, 0.65, 0.45)
# Source px per frame: calming fades out where things really move (her hand lifting the pen to
# turn the page). Shimmer sits on still or slow parts; on fast, thin things (the nib in flight)
# the flow can't line neighbours up exactly, and blending them speckles instead of calming.
CALM_MOTION = 3.0
# Her outline (alpha) is calmed on its own: the generated video's edge wavers from frame to frame
# even where she is still, and there the colours of neighbouring frames disagree too much for the
# colour calming to touch it. Matches are judged by how close the edge is, not by colour.
CALM_ALPHA_SIGMA = 90.0  # alpha levels (of 255)
MARGIN = 6  # canvas px around everything


def premul(img):
    x = np.asarray(img, np.float32)
    return np.dstack([x[..., :3] * x[..., 3:4] / 255.0, x[..., 3:4]])


def unpremul(x):
    a = x[..., 3:4]
    rgb = np.where(a > 0.5, x[..., :3] * 255.0 / np.maximum(a, 1e-6), 0)
    return np.dstack([rgb, a]).clip(0, 255)


def fill_transparent(rgba, edges=False):
    """Fully transparent pixels a few px out take the colour of the figure (so lossy
    compression can't bring a fringe back). With edges=True the soft edge pixels are
    recoloured from the solid figure just inside them too (for the moving hand area;
    the rest of the outline is handled by refine_edges)."""
    rgb, a = rgba[..., :3].copy(), rgba[..., 3]
    w = (a >= 250 if edges else a > 0).astype(np.float32)
    H, W = w.shape
    for _ in range(6):
        pad = np.pad(rgb * w[..., None], ((1, 1), (1, 1), (0, 0)), mode='edge')
        wp = np.pad(w, ((1, 1), (1, 1)), mode='edge')
        s = sum(pad[1 + dy:H + 1 + dy, 1 + dx:W + 1 + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1))
        n = sum(wp[1 + dy:H + 1 + dy, 1 + dx:W + 1 + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1))
        grow = (w == 0) & (n > 0)
        rgb[grow] = s[grow] / n[grow][:, None]
        w = np.where(grow, 1.0, w)
    return np.dstack([rgb, a]).round().clip(0, 255).astype(np.uint8)


# Edges. Light wrap: a little of the light behind her spills round her outermost edge,
# the way it does round a real subject, so the outline sits in the painting instead of
# looking cut out. It only ever adds light (a screen blend, mostly of the background's
# brightness, so a warm room doesn't muddy her teal sweater), skips features thinner
# than THIN (the throw's tassels), and is left off the hand area (it moves).
WRAP = {'band': 1.6, 'blur': 9.0, 'woman': 0.18, 'chair': 0.26, 'chroma': 0.65}  # canvas px; strengths
THIN = 3.0  # canvas px half-width below which a feature gets no wrap
FEATHER = 0.7  # output px: softens stair-stepped outlines (alpha only)


def room_in_box(box, size):
    """The painted room behind a box on the canvas, at the box's output size."""
    layout = json.loads(LAYOUT.read_text())
    frame = layout['media']['frame']
    room = Image.open(ROOT / 'public' / layout['media']['poster'].lstrip('/')).convert('RGBA')
    room = room.resize((round(frame['width']), round(frame['height'])), Image.LANCZOS)
    canvas = Image.new('RGBA', (1920, 1080), (0, 0, 0, 255))
    canvas.paste(room, (round(frame['x']), round(frame['y'])))
    bx0, by0, bx1, by1 = box
    pad = Image.new('RGBA', (round(bx1 - bx0), round(by1 - by0)), (0, 0, 0, 255))
    pad.paste(canvas.crop((round(bx0), round(by0), round(bx1), round(by1))), (0, 0))
    return pad.resize(size, Image.LANCZOS)


def luma(rgb):
    return rgb @ np.array([0.2126, 0.7152, 0.0722], np.float32)


def _min(a_u8, px):
    return np.asarray(Image.fromarray(a_u8).filter(ImageFilter.MinFilter(2 * max(1, round(px)) + 1)), np.float32)


def _max(a_u8, px):
    return np.asarray(Image.fromarray(a_u8).filter(ImageFilter.MaxFilter(2 * max(1, round(px)) + 1)), np.float32)


def bleed_from(rgb, seed, steps):
    """Spread the colour of `seed` pixels outwards, `steps` px. Returns the colours and
    where they reached (pixels the spread never reached must not be repainted)."""
    col = np.where(seed[..., None], rgb, 0.0).astype(np.float32)
    w = seed.astype(np.float32)
    H, W = w.shape
    for _ in range(steps):
        pad = np.pad(col * w[..., None], ((1, 1), (1, 1), (0, 0)), mode='edge')
        wp = np.pad(w, ((1, 1), (1, 1)), mode='edge')
        s = sum(pad[1 + dy:H + 1 + dy, 1 + dx:W + 1 + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1))
        n = sum(wp[1 + dy:H + 1 + dy, 1 + dx:W + 1 + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1))
        grow = (w == 0) & (n > 0)
        col[grow] = s[grow] / n[grow][:, None]
        w = np.where(grow, 1.0, w)
    return col, w > 0


def refine_edges(rgba, k, behind, keep_off=None, matte=True, repaint=True):
    """Clean, soften and light-wrap the outline of a straight-alpha RGBA picture.

    - the old background's colour is repainted out of the outline: semi-transparent edge
      pixels, and (matte=True: her export only) pale near-opaque ones close to the edge,
      take the colour from a few px inside, never where no inside colour reaches (thin
      features keep their own);
    - the alpha is feathered very slightly where it isn't solid (no stair-steps);
    - a wrap of `behind` (blurred) is screened onto the outermost band, except on thin
      features and wherever `keep_off` (0-1) says.
    """
    x = rgba.astype(np.float32)
    rgb, a = x[..., :3], x[..., 3]
    a8 = a.round().clip(0, 255).astype(np.uint8)
    deep = _min(a8, 4 * k / 1.2) >= 250
    inner_col, reached = bleed_from(rgb, deep, round(12 * k) + 4)
    soft_edge = (a > 0) & (a < 250) & repaint
    fix = soft_edge
    if matte:
        near = _min(a8, 4 * k / 1.2) < 250
        mx, mn = rgb.max(2), rgb.min(2)
        sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0)
        lighter = luma(rgb) - luma(inner_col)
        bluer = rgb[..., 2] - inner_col[..., 2]
        # pale, greyish leftovers of the export's background, and (on skin) edge pixels
        # noticeably bluer than the skin just inside
        fix = fix | (near & (a > 0) & (((lighter > 28) & (sat < 0.35)) | ((bluer > 22) & (lighter > 6))))
    fix &= reached
    rgb = np.where(fix[..., None], inner_col, rgb)
    if repaint:  # feather: soften the alpha's stair-steps, outside the solid body only
        soft = np.asarray(Image.fromarray(a8).filter(ImageFilter.GaussianBlur(FEATHER)), np.float32)
        solid = _min(a8, 2) >= 250
        a = np.where(solid, a, np.minimum(a, soft))  # only ever inwards: no darker line outside
    a8 = a.round().clip(0, 255).astype(np.uint8)
    # light wrap on the outermost band, where the feature is thick enough
    band = np.clip(a / 255 - _min(a8, WRAP['band'] * k) / 255, 0, 1) * (a / 255)
    thick = _max(( _min(a8, THIN * k) > 128).astype(np.uint8) * 255, THIN * k + 1) / 255
    band *= thick
    if keep_off is not None:
        band *= 1 - np.clip(keep_off, 0, 1)
    return rgb, a, band


def screen_wrap(rgb, behind_blur, strength):
    """Screen a mostly-luminance version of the background's light onto `rgb` (only adds light)."""
    lum = luma(behind_blur)[..., None]
    light = lum + (behind_blur - lum) * WRAP['chroma']
    return 255 - (255 - rgb) * (255 - light * strength) / 255


def edge_finish(rgba, k, behind, strength, keep_off=None, matte=True, repaint=True):
    rgb, a, band = refine_edges(rgba, k, behind, keep_off, matte, repaint)
    blur = np.asarray(behind.filter(ImageFilter.GaussianBlur(WRAP['blur'] * k)), np.float32)[..., :3]
    wrapped = screen_wrap(rgb, blur, strength)
    rgb = rgb * (1 - band[..., None]) + wrapped * band[..., None]
    out = np.dstack([rgb, a])
    return fill_transparent(out)


def finish_chair(chair_box, her_first, room, k):
    """The chair (a clean export: light wrap only, never where it overlaps her), and the still."""
    behind_chair = room.copy()
    behind_chair.alpha_composite(her_first)
    her = _max(np.asarray(her_first.getchannel('A')), 2 * k) / 255
    finished = edge_finish(np.asarray(chair_box, np.float32), k, behind_chair, WRAP['chair'], keep_off=her, matte=False, repaint=False)
    a = finished[..., 3]
    a[a >= 249] = 255  # the export's solid parts are 251, not 255: she'd show through faintly
    done = Image.fromarray(finished)
    done.save(OUT / 'chair.webp', quality=92, alpha_quality=100, method=6, exact=True)
    still = her_first.copy()
    still.alpha_composite(done)
    still.save(OUT / 'woman-still.webp', quality=92, alpha_quality=100, method=6, exact=True)


def chair_only():
    """Redo just the chair and the still from the built loop (seconds, not minutes)."""
    o = next(o for o in json.loads(LAYOUT.read_text())['overlays'] if o['id'] == 'woman')
    W, H = o['intrinsic']
    k = W / o['width']
    box = (o['x'], o['y'], o['x'] + o['width'], o['y'] + H / k)
    chair = Image.open(CHAIR_SRC).convert('RGBA')
    s = CHAIR['scale'] * k
    im = chair.resize((round(chair.width * s), round(chair.height * s)), Image.LANCZOS)
    chair_box = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    chair_box.paste(im, (round((CHAIR['x'] - box[0]) * k), round((CHAIR['y'] - box[1]) * k)), im)
    her_first = next(ImageSequence.Iterator(Image.open(kept(OUT / f'woman-{HOME}.webp')))).convert('RGBA')
    finish_chair(chair_box, her_first, room_in_box(box, (W, H)), k)
    print('chair.webp and woman-still.webp rebuilt')


def placed_box(size, place):
    w, h = size
    return place['x'], place['y'], place['x'] + w * place['scale'], place['y'] + h * place['scale']


def source_frames(path):
    """The export's frames in playback order, each repeated for as long as it's held."""
    if path.suffix == '.json':
        import base64
        import io
        doc = json.loads(path.read_text())
        images = {a['id']: a['p'] for a in doc['assets']}
        frames = []
        for layer in sorted(doc['layers'], key=lambda l: l['ip']):
            data = base64.b64decode(images[layer['refId']].split(',', 1)[1])
            frames += [Image.open(io.BytesIO(data)).convert('RGBA')] * max(1, round(layer['op'] - layer['ip']))
        return frames
    return [f.convert('RGBA') for f in ImageSequence.Iterator(Image.open(path))]


def _hair_fill(img, nape=False):
    """Fill the export's see-through slivers between the outer strands of her hair, and the
    pale or grey bits of its old background caught there, with the colour of the hair around
    them, so the room never shows through her hair. Only within HAIR_ZONE, and only pixels
    that were see-through (or that grey/pale matte): her outline elsewhere is untouched."""
    x = np.asarray(img, np.float32)
    rgb, a = x[..., :3], x[..., 3]
    H, W = a.shape
    zone = np.zeros((H, W), bool)
    x0, y0, x1, y1 = HAIR_ZONE
    zone[y0:y1, x0:x1] = True
    # never at the back of her neck: the room showing past its thin strip, above the collar, isn't
    # a gap in her hair (filled, it was the brown spot and the specks where the strip meets the collar)
    # (only the strip's own skin and the room past it: gaps in her hair beside it are still filled)
    at = nape_anchor(np.asarray(img)) if nape is False else nape
    if at is not None:
        import cv2
        xb, yb = at
        B = (slice(max(0, yb - NAPE_SPARE[1]), min(H, yb + NAPE_SPARE[3])), slice(max(0, xb - NAPE_SPARE[0]), min(W, xb + NAPE_SPARE[2])))
        r_, g_, b_ = [x[..., i][B] for i in range(3)]
        skin = ((a[B] > 200) & (r_ > 160) & (g_ > 100) & (r_ - b_ > 40)).astype(np.uint8)
        _, lab = cv2.connectedComponents(skin, connectivity=8)
        ay, ax = yb - B[0].start, xb - B[1].start
        neck = (lab == lab[ay, ax]) & (skin > 0) if 0 <= ay < skin.shape[0] and 0 <= ax < skin.shape[1] and skin[ay, ax] else np.zeros(skin.shape, bool)
        clear = (a[B] < 128).astype(np.uint8)
        _, lab = cv2.connectedComponents(clear, connectivity=8)
        room = np.isin(lab, np.unique(lab[:, -1][clear[:, -1] > 0])) & (clear > 0)  # the room, open to the right
        spare = cv2.dilate((neck | room).astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
        zone[B] &= ~spare
    lum = rgb @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    mx, mn = rgb.max(-1), rgb.min(-1)
    sat = (mx - mn) / np.maximum(mx, 1)
    hair = (a >= 250) & (lum < 120) & (sat >= 0.22) & (rgb[..., 0] >= rgb[..., 2])  # brown, not the grey matte

    def grow(m, px):
        return np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(2 * px + 1))) > 0

    solid = Image.fromarray(((a >= 128) * 255).astype(np.uint8))
    r = HAIR_CLOSE
    closed = np.asarray(solid.filter(ImageFilter.MaxFilter(2 * r + 1)).filter(ImageFilter.MinFilter(2 * r + 1))) > 0
    col, reach = bleed_from(rgb, hair, r + 4)
    near_hair = grow(hair, 4)
    holes = closed & (a < 128) & reach & zone  # only see-through pixels the closing bridges
    pale = (a > 40) & (((lum > 120) & (sat < 0.35)) | (sat < 0.22)) & near_hair & reach & zone
    fix = holes | pale
    recolour = (fix | (grow(fix, 2) & ((a < 250) | (lum > 120)))) & reach & zone
    soft = np.asarray(Image.fromarray((fix * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7)), np.float32) / 255
    return rgb, a, col, np.maximum(fix, soft), recolour.astype(np.float32), (reach & zone).astype(np.float32)


def fill_hair_gaps(img):
    """One frame's hair gaps filled (see _hair_fill)."""
    rgb, a, col, fill, recolour, _ = _hair_fill(img)
    return _hair_filled(rgb, a, col, fill, recolour)


def _hair_filled(rgb, a, col, fill, recolour):
    out_rgb = rgb * (1 - recolour[..., None]) + col * recolour[..., None]
    out_a = np.maximum(a, fill * 255.0)
    return Image.fromarray(np.dstack([out_rgb, out_a]).round().clip(0, 255).astype(np.uint8))


HAIR_STEADY = 1.2  # frames: how much the gap filling is evened out over time


def fill_hair_gaps_seq(frames):
    """Every frame's hair gaps filled, the filling evened out over neighbouring frames. Found
    frame by frame it differs a little each time, and the filled strands' edges flickered
    (measured: 77% more than the export's own). Her hair down her back hardly moves, so a short
    average over time is enough and doesn't trail."""
    parts = [_hair_fill(f, at) for f, at in zip(frames, nape_anchors([np.asarray(f) for f in frames]))]
    k = np.exp(-0.5 * (np.arange(-3, 4) / HAIR_STEADY) ** 2)
    out = []
    for t, (rgb, a, col, _, _, here) in enumerate(parts):
        fill = np.zeros_like(a)
        recolour = np.zeros_like(a)
        wsum = 0.0
        for j, w in zip(range(t - 3, t + 4), k):
            if 0 <= j < len(parts):
                fill += parts[j][3] * w
                recolour += parts[j][4] * w
                wsum += w
        # only where this frame's own hair colour reaches (elsewhere it has none to fill with)
        out.append(_hair_filled(rgb, a, col, fill / wsum * here, np.clip(recolour / wsum, 0, 1) * here))
    return out


def _barrel(rgba):
    x = rgba.astype(np.float32)
    lum = 0.2126 * x[..., 0] + 0.7152 * x[..., 1] + 0.0722 * x[..., 2]
    return ((lum < 70) & (x[..., 0] >= x[..., 2]) & (x[..., 3] > 200)).astype(np.float32)


def _skin(rgba):
    x = rgba.astype(np.float32)
    r, g, b = x[..., 0], x[..., 1], x[..., 2]
    return ((r > 170) & (g > 115) & (b > 85) & (r - b < 130) & (r > g)).astype(np.float32)


def _turn(arr, deg, c, dx=0.0, dy=0.0):
    im = Image.fromarray(arr.astype(np.float32), 'F')
    return np.asarray(im.rotate(deg, resample=Image.BICUBIC, center=c, translate=(dx, dy)), np.float32)


def _blurred(m, r):
    return np.asarray(Image.fromarray((np.clip(m, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r)), np.float32) / 255


def steady_pen(frames, ref):
    """frames (source RGBA images) with the pen replaced, wherever it can be followed, by the
    clean pen of `ref` moved exactly as the frame's own pen moves: the writing motion stays, the
    shimmer goes. Never over skin (fingers in front stay the frame's own). Where the pen can't
    be followed (her hand lifts it to turn a page) the frame keeps its own pen, the change easing
    in and out over a few frames."""
    x0, y0, x1, y1 = PEN_CROP
    c = PEN_CENTRE
    crops = [np.asarray(f.crop(PEN_CROP)) for f in frames]
    rc = np.asarray(ref.crop(PEN_CROP)).astype(np.float32)  # float: 8-bit maths would wrap round and blacken the pen
    H, W = rc.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    near = np.hypot(xx - c[0], yy - c[1]) < 120
    ref_barrel = _barrel(rc) * near
    refs = _blurred(ref_barrel, 1.2)
    ax = np.array(PEN_AXIS)
    t0, t1, hw = PEN_SPAN
    px, py = xx - c[0], yy - c[1]
    t = np.clip(px * ax[0] + py * ax[1], t0, t1)
    cap = (np.hypot(px - t * ax[0], py - t * ax[1]) <= hw).astype(np.float32)
    cap_soft = _blurred(cap, 1.2)
    ref_skin = _skin(rc)
    pm = np.dstack([rc[..., :3] * rc[..., 3:4] / 255.0, rc[..., 3:4]]).astype(np.float32)
    poses, trust = [], []
    for cr in crops:
        ms = _blurred(_barrel(cr) * near, 1.2)
        best = None
        for deg in np.arange(-10, 10.01, 0.25):
            tpl = _turn(refs, deg, c)
            cc = np.fft.irfft2(np.fft.rfft2(ms - ms.mean()) * np.conj(np.fft.rfft2(tpl - tpl.mean())), s=ms.shape)
            i = np.unravel_index(np.argmax(cc), cc.shape)
            if best is None or cc[i] > best[0]:
                def sub(arr, k, n):
                    a0, a1, a2 = arr[(k - 1) % n], arr[k], arr[(k + 1) % n]
                    den = a0 - 2 * a1 + a2
                    return k + (0.5 * (a0 - a2) / den if abs(den) > 1e-9 else 0)
                dy = sub(cc[:, i[1]], i[0], H)
                dx = sub(cc[i[0], :], i[1], W)
                best = (cc[i], dx - W if dx > W / 2 else dx, dy - H if dy > H / 2 else dy, deg)
        _, dx, dy, deg = best
        moved = _turn(ref_barrel, deg, c, dx, dy) > 0.5
        here = _barrel(cr) * near > 0.5
        iou = (moved & here).sum() / max(1, (moved | here).sum())
        poses.append((dx, dy, deg))
        trust.append(float(np.clip((iou - 0.45) / 0.2, 0, 1)) if abs(dx) < 40 and abs(dy) < 40 else 0.0)
    # ease the trust over time, so the change between steadied and original never pops
    k = np.exp(-0.5 * (np.arange(-6, 7) / 2.0) ** 2)
    k /= k.sum()
    tr = np.array(trust)
    trust = np.convolve(np.pad(np.minimum.accumulate(tr) * 0 + tr, 6, mode='edge'), k, mode='valid')
    out, masks = [], []
    for f, cr, (dx, dy, deg), w_t in zip(frames, crops, poses, trust):
        if w_t < 0.01:
            out.append(f)
            masks.append(None)
            continue
        wp = np.dstack([_turn(pm[..., i], deg, c, dx, dy) for i in range(4)])
        w = _turn(cap_soft, deg, c, dx, dy) * (1 - _blurred(_skin(cr), 0.8)) * (1 - _blurred(_turn(ref_skin, deg, c, dx, dy), 0.8))
        w = (np.clip(w, 0, 1) * w_t)[..., None]
        xf = cr.astype(np.float32)
        fp = np.dstack([xf[..., :3] * xf[..., 3:4] / 255.0, xf[..., 3:4]])
        o = fp * (1 - w) + wp * w
        a = o[..., 3:4]
        rgb = np.where(a > 0.5, o[..., :3] * 255.0 / np.maximum(a, 1e-6), xf[..., :3])
        patch = Image.fromarray(np.dstack([rgb, a]).round().clip(0, 255).astype(np.uint8))
        g = f.copy()
        g.paste(patch, (x0, y0))
        out.append(g)
        full = np.zeros((f.height, f.width), np.float32)
        full[y0:y1, x0:x1] = w[..., 0]
        masks.append(full)
    print(f'  pen steadied in {sum(1 for w in trust if w > 0.5)}/{len(frames)} frames', flush=True)
    return out, masks


PEN_REACH = (600, 620, 1120, 1180)  # source px x0, y0, x1, y1: where the pen can be, also lifted to turn a page


def own_pen(rgba):
    """The frame's own pen (its dark barrel and gold fittings) within PEN_REACH, as a soft 0-1
    mask: where the clean pen can't be followed, the edge clean-up must still leave the pen
    alone, or it smears the barrel and dulls the nib."""
    x = np.asarray(rgba).astype(np.float32)
    r, g, b, a = x[..., 0], x[..., 1], x[..., 2], x[..., 3]
    lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    barrel = (lum < 70) & (r >= b) & (a > 200)
    gold = (r > 140) & (g - b > 60) & (r - b > 90) & (r - g < 90) & (a > 200)  # not skin in shadow
    reach = np.zeros_like(barrel)
    x0, y0, x1, y1 = PEN_REACH
    reach[y0:y1, x0:x1] = True
    m = _max(((barrel | gold) & reach).astype(np.uint8) * 255, 5) > 0
    return _blurred(m.astype(np.float32), 1.5)


def hold_light(frames, ref):
    """frames (straight RGBA arrays) with each one's exposure held to `ref`'s, per colour channel
    in linear light, measured in LIGHT_PROBES; eased over time so it never flickers itself."""
    def means(x):
        acc, n = np.zeros(3), 0
        for x0, y0, x1, y1 in LIGHT_PROBES:
            r = x[y0:y1, x0:x1].astype(np.float32)
            m = r[..., 3] > 250
            acc += ((r[..., :3][m] / 255.0) ** 2.2).sum(0)
            n += int(m.sum())
        return acc / max(n, 1)
    target = means(ref)
    gains = np.array([target / np.maximum(means(f), 1e-6) for f in frames])
    k = np.exp(-0.5 * (np.arange(-8, 9) / 3.0) ** 2)
    k /= k.sum()
    gains = np.stack([np.convolve(np.pad(gains[:, c], 8, mode='edge'), k, mode='valid') for c in range(3)], 1)
    out = []
    for f, g in zip(frames, gains):
        lin = (f[..., :3].astype(np.float32) / 255.0) ** 2.2 * g
        rgb = np.clip(lin, 0, 1) ** (1 / 2.2) * 255.0
        out.append(np.dstack([rgb.round().astype(np.uint8), f[..., 3]]))
    return out, gains


HAIR_RIM_ZONE = (0, 700, 400, 1500)  # source px: the hair down her back whose outer lock the export left grey
                                     # (not her nape, collar or jaw)
HAIR_RIM = 22  # canvas px: how far in from her outline the outer lock reaches
HAIR_RIM_CALM = 0.45  # how much of the lock's mottle is calmed towards the hair just inside


# Her neck: the export leaves it out (under her jaw the room's curtain shows, between her hair and
# her collar). A painted-in neck was tried and read as a flat pink triangle stuck outside her, so
# it's off: her jaw sits over her collar, as drawn. The painting below stays for reference. Source px.
NECK_PAINT = False
NECK_X = (520, 700)  # columns where the neck can be
NECK_Y = (700, 900)
THROAT_TOP = 0.62  # where the throat leaves the jaw: this far from the back of the jaw to the chin
THROAT_LEAN = 0.18  # how far forward the throat runs, per px down
NECK_SHADOW = 0.12  # how much deeper the neck is right under the jaw (a soft shadow, about 10 px deep)
NECK_TINT = (1.0, 1.0, 1.0)  # the neck's colour against the skin around it (below 1: deeper, in shade)
NECK_LINE = 0.0  # the throat's thin line, in the chin's line colour (0: none, 1: full)
NECK_MELT = 0.85  # how far the export's cut-out outline and grey leftovers around the hole melt into the neck


def _neck_masks(a):
    rgb, al = a[..., :3].astype(np.int32), a[..., 3]
    skin = (al > 200) & (rgb[..., 0] > 160) & (rgb[..., 1] > 100) & (rgb[..., 0] - rgb[..., 2] > 40)
    sweater = (al > 200) & (rgb[..., 2] > rgb[..., 0] + 8)
    return skin, sweater


def _neck_measure(a):
    """The jaw's underside and the collar's top per column of the neck (-1 where none), the jaw's
    back and chin, and the neck's skin tone (the lighter half of the jaw a little above its underside)."""
    skin, sweater = _neck_masks(a)
    (x0, x1), (y0, y1) = NECK_X, NECK_Y
    jaw = np.full(x1 - x0, -1.0)
    col = np.full(x1 - x0, -1.0)
    for i, x in enumerate(range(x0, x1)):
        s = np.nonzero(skin[y0:y1, x])[0]
        if len(s):
            jaw[i] = s.max() + y0
        w = np.nonzero(sweater[y0:y1 + 120, x])[0]
        if len(w):
            col[i] = w.min() + y0
    have = np.nonzero(jaw >= 0)[0]
    back, chin = (have.min() + x0, have.max() + x0) if len(have) else (x0, x1)
    top_x = back + THROAT_TOP * (chin - back)
    i_top = int(round(top_x)) - x0
    jy = jaw[i_top] if 0 <= i_top < len(jaw) else -1
    tone = None
    if jy > 0:
        # the lit skin along the front of the jaw (behind it, near the ear, it's in shadow and
        # made the neck read grey against her face)
        sx0, sx1 = int(top_x), int(chin) - 12
        samp = a[int(jy) - 45:int(jy) - 15, sx0:sx1, :3].astype(np.float32)
        ok = skin[int(jy) - 45:int(jy) - 15, sx0:sx1]
        px = samp[ok]
        if len(px):
            lum = luma(px)
            tone = px[lum >= np.median(lum)].mean(0)
    return {'jaw': jaw, 'col': col, 'top_x': top_x, 'jy': jy, 'tone': tone}


def _neck_paint(a, m):
    """One frame (RGBA array) with the neck painted behind whatever is there, in the colour of
    the skin around it, and the export's cut-out edges around the hole melted into it."""
    import cv2
    if m['jy'] <= 0 or m['tone'] is None:
        return a
    a = a.astype(np.float32).copy()
    H, W = a.shape[:2]
    x0, x1 = NECK_X
    top_x, jy, jaw, col = m['top_x'], m['jy'], m['jaw'], m['col']
    LEAN = THROAT_LEAN
    fill = np.zeros((H, W), np.float32); under = np.full((H, W), 999.0, np.float32)
    for i, x in enumerate(range(x0, x1)):
        if jaw[i] < 0 and x > top_x: continue
        ytop = jaw[i] if jaw[i] >= 0 else jy
        ybot = col[i] if col[i] >= 0 else ytop + 60
        for y in range(int(ytop) - 2, min(H, int(ybot) + 3)):
            front = top_x + (y - jy) * LEAN
            if x > front + 1: continue
            fill[y, x] = np.clip(front + 1 - x, 0, 1)
            under[y, x] = max(0, y - ytop)
    fill = cv2.GaussianBlur(fill, (0, 0), 0.8)
    # the neck's colour: the skin around the hole, carried smoothly into it (no seam with the
    # skin at the back of her neck or under her jaw)
    skin, sweater = _neck_masks(a.astype(np.uint8))
    src = (skin & (fill < 0.05)).astype(np.float32)
    rgb = a[..., :3]
    field = None
    for s in (40, 14, 5):
        num = cv2.GaussianBlur(rgb * src[..., None], (0, 0), s); den = cv2.GaussianBlur(src, (0, 0), s)
        f = num / np.maximum(den, 1e-4)[..., None]
        if field is None: field = f
        else:
            w = np.clip(den * 6, 0, 1)[..., None]; field = field * (1 - w) + f * w
    # a soft shadow under the jaw, the neck a step deeper than her face (it's in the chin's shade),
    # and the throat drawn with the chin's own thin line, so it never melts into the wall
    shade = 1 - NECK_SHADOW * np.exp(-np.minimum(under, 60) / 10)
    Y, X = np.mgrid[0:H, 0:W]
    front = top_x + (Y - jy) * LEAN
    neck = field * shade[..., None] * np.array(NECK_TINT, np.float32)
    if NECK_LINE > 0:
        ink = m['tone'] * np.array([0.78, 0.66, 0.6], np.float32)
        line_w = np.clip(1 - np.abs(X - (front - 0.6)) / 1.1, 0, 1) * (Y > jy + 2) * NECK_LINE
        neck = neck * (1 - line_w[..., None]) + ink * line_w[..., None]
    al = a[..., 3:4] / 255
    junk = (a[..., 3] < 200) & (fill > 0.5)
    al = np.where(junk[..., None], 0, al)
    # the neck goes behind what's there (straight alpha: a half-covered edge pixel takes the
    # neck's colour, never the export's hidden background colour)
    cov = (1 - al) * fill[..., None]
    a_new = al + cov
    a[..., :3] = np.where(a_new > 1e-3, (a[..., :3] * al + neck * cov) / np.maximum(a_new, 1e-3), a[..., :3])
    a[..., 3] = a_new[..., 0] * 255
    # the collar's top edge against the new neck takes the sweater's own colour (no old-background fringe)
    _, sweater = _neck_masks(a.astype(np.uint8))
    near = cv2.dilate((fill > 0.3).astype(np.uint8), np.ones((3, 3), np.uint8), iterations=4).astype(bool)
    deep = cv2.erode(sweater.astype(np.uint8), np.ones((3, 3), np.uint8), iterations=5).astype(bool)
    num = cv2.GaussianBlur(a[..., :3] * deep[..., None], (0, 0), 6); den = cv2.GaussianBlur(deep.astype(np.float32), (0, 0), 6)
    inner = num / np.maximum(den, 1e-4)[..., None]
    rim = near & (a[..., 3] > 0) & (den > 0.05) & ~(fill > 0.5) & (a[..., 2] + 30 > a[..., 0])
    t = inner + ((luma(a[..., :3]) - luma(inner)) * 0.5)[..., None]
    a[..., :3] = np.where(rim[..., None], t, a[..., :3])
    (bx0_, bx1_), (by0_, by1_) = NECK_X, NECK_Y
    sub = (slice(by0_, min(H, by1_ + 120)), slice(bx0_, bx1_))
    Ys, Xs = Y[sub], X[sub]; fl = front[sub]
    skin_now, sweater_now = _neck_masks(a.astype(np.uint8))
    clear = (Xs > fl + 2) & (fill[sub] < 0.05) & ~skin_now[sub] & ~sweater_now[sub] & (a[sub][..., 3] < 245)
    a[sub][clear] = 0
    # the export's pale cut-out edge where the hole was: behind the throat it melts into the neck
    # (no outline), in front of it (the chin's underside) it's the chin's own warm line
    k3 = np.ones((3, 3), np.uint8)
    inside = (fill > 0.5).astype(np.uint8)
    ring = cv2.dilate(inside, k3, iterations=3).astype(bool) & ~inside.astype(bool)
    rgb = a[..., :3]; mx, mn = rgb.max(2), rgb.min(2); sat = (mx - mn) / np.maximum(mx, 1)
    pale = ring & (a[..., 3] > 40) & ~sweater_now & (luma(rgb) > 110) & ((sat < 0.32) | (luma(rgb) > luma(m['tone'][None, None, :])[..., 0] + 6))
    behind = X <= front + 1
    contour = m['tone'] * np.array([0.78, 0.66, 0.6], np.float32)
    a[..., :3] = np.where((pale & behind)[..., None], neck, np.where((pale & ~behind)[..., None], contour[None, None, :], a[..., :3]))
    a[..., 3] = np.where(pale, 255, a[..., 3])
    # the export's own outline along the hole's back and the jaw's underside (now inside her skin),
    # softened into the neck: a line there only says "cut out"
    L_ = luma(a[..., :3])
    gx = cv2.Sobel(L_, cv2.CV_32F, 1, 0, ksize=3); gy = cv2.Sobel(L_, cv2.CV_32F, 0, 1, ksize=3)
    reach = cv2.dilate(inside, k3, iterations=6).astype(bool) & ~cv2.erode(inside, k3, iterations=1).astype(bool)
    not_hair = L_ > 85
    zone = (reach | (fill > 0.3)) & behind & ~sweater_now & (a[..., 3] > 200) & (L_ > 70) & (X < top_x)
    # the export's outline down the back of the neck (running up and down: it says "cut out")
    upright = cv2.dilate(((np.abs(gx) > 1.0 * np.abs(gy)) & (np.abs(gx) > 40)).astype(np.uint8), k3, iterations=1).astype(bool)
    line = zone & upright & (L_ < luma(neck) - 25)
    # and the export's grey-green leftovers between the back of the neck and the collar
    r_, g_, b_ = a[..., 0], a[..., 1], a[..., 2]
    grey = zone & ~skin_now & (g_ >= r_ - 45) & (L_ < luma(neck) - 15)
    melt = cv2.GaussianBlur((line | grey).astype(np.float32), (0, 0), 0.7) * NECK_MELT
    melt = np.maximum(melt, (line | grey) * NECK_MELT)
    a[..., :3] = a[..., :3] * (1 - melt[..., None]) + neck * melt[..., None]
    # the jaw's underside keeps its line, but softer: under it there's a shadow now
    jawline = reach & behind & ~sweater_now & (a[..., 3] > 200) & not_hair & ~line & (np.abs(a[..., :3] - neck).sum(2) > 30) & (X >= top_x - 40) & (X < front - 2.5)
    a[..., :3] = np.where(jawline[..., None], a[..., :3] * 0.6 + neck * 0.4, a[..., :3])
    rgb = a[..., :3]; mx, mn = rgb.max(2), rgb.min(2); sat = (mx - mn) / np.maximum(mx, 1)
    fringe = (fill > 0.5) & ~sweater_now & ((sat < 0.3) | (luma(rgb) > luma(m['tone'][None, None, :])[..., 0] + 6)) & (luma(rgb) > 90)
    a[..., :3] = np.where(fringe[..., None], neck, a[..., :3])
    near_front = (np.abs(Xs - fl) < 5) & (Ys > jy)
    tip = np.zeros((H, W), bool)
    tip[sub] = near_front & sweater_now[sub] & (a[sub][..., 3] < 210)
    soft_tip = np.zeros((H, W), bool)
    soft_tip[sub] = near_front & (a[sub][..., 3] > 0) & (a[sub][..., 3] < 210) & ~skin_now[sub] & (fill[sub] < 0.5)
    tip |= soft_tip & (a[..., 2] > a[..., 0])
    a[..., :3] = np.where(tip[..., None], np.array([28, 38, 46], np.float32), a[..., :3])
    a[..., 3] = np.where(tip, np.where(a[..., 3] > 60, 255, 0), a[..., 3])
    return np.clip(a, 0, 255).round().astype(np.uint8)


def throat_keep(shape, m):
    """The throat's line, from under the jaw to just past where it meets the collar, as a soft 0-1
    mask. The edge clean-up must leave it alone: it took the collar's last pixels for leftovers of
    the old background and repainted them in the sweater's blue, a small grey nub at the throat."""
    H, W = shape[:2]
    keep = np.zeros((H, W), np.float32)
    if m['jy'] <= 0:
        return keep
    x0, x1 = NECK_X
    top_x, jy, col = m['top_x'], m['jy'], m['col']
    y_meet = None  # where the throat's line reaches the collar
    for y in range(int(jy), min(H, NECK_Y[1] + 120)):
        i = int(round(top_x + (y - jy) * THROAT_LEAN)) - x0
        if 0 <= i < len(col) and col[i] >= 0 and y >= col[i]:
            y_meet = y
            break
    if y_meet is None:
        return keep
    y0, y1 = int(jy) + 4, min(H, y_meet + 7)
    Y, X = np.mgrid[y0:y1, x0:x1]
    d = np.abs(X - (top_x + (Y - jy) * THROAT_LEAN))
    keep[y0:y1, x0:x1] = np.clip((4.5 - d) / 1.5, 0, 1)
    mx = top_x + (y_meet - jy) * THROAT_LEAN
    Y, X = np.mgrid[0:H, 0:W]
    keep = np.maximum(keep, np.clip((10 - np.hypot(X - mx, Y - y_meet)) / 3, 0, 1))
    return _blurred(keep, 1.0)


NAPE = (495, 640, 740, 880)  # where the back of her neck can be (source px)
NAPE_DOWN, NAPE_BACK, NAPE_FWD = 50, 8, 14  # the strip's box from the back corner of her jaw
NAPE_UP = 30  # and up from it, to where her hair meets the corner (the brown spot itself)


NAPE_X_OK = (495, 565)  # where the back corner of her jaw is found in every clip (source px)
NAPE_SPARE = (16, 40, 44, 8)  # where the hair-gap filling looks for the strip and the room past it: back, up, forward, down (source px)
NAPE_FOOT = 7  # a gap up to this tall (source px) between the strip's foot and the collar is filled
NAPE_SPECK = 5  # specks and thin sprigs narrower than this (source px) go from where the strip meets the collar


def nape_anchor(a):
    """(x, y) of the back corner of her jaw, above the strip at the back of her neck, or None
    where it isn't found (or lands somewhere it never is, like under her chin)."""
    import cv2
    x0, x1, y0, y1 = NAPE
    r, g, b, al = [a[..., i].astype(np.float32) for i in range(4)]
    skin = ((al > 200) & (r > 160) & (g > 100) & (r - b > 40)).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(skin, 8)
    if n < 2:
        return None
    # her face and neck: the skin most in the box (her arm, raised to turn a page, can be bigger)
    inside = np.bincount(lab[y0:y1, x0:x1].ravel(), minlength=n)
    inside[0] = 0
    face = lab == int(np.argmax(inside))
    rows = [y for y in range(y0, y1) if face[y, x0:x1].any()]
    if not rows:
        return None
    yb = rows[-1]
    xb = x0 + int(np.nonzero(face[yb, x0:x1])[0].min())
    return (xb, yb) if NAPE_X_OK[0] <= xb <= NAPE_X_OK[1] else None


def nape_anchors(frames):
    """Each frame's anchor (nape_anchor); a frame where it isn't found borrows its nearest
    neighbour's, so the strip is looked after in every frame, and each is the median of five."""
    found = [nape_anchor(f) for f in frames]
    have = [i for i, p in enumerate(found) if p is not None]
    if not have:
        return found
    filled = [p if p is not None else found[min(have, key=lambda j: abs(j - i))] for i, p in enumerate(found)]
    # evened over neighbouring frames: where it's found can hop a few px, and the strip mustn't
    return [tuple(int(v) for v in np.median(np.array(filled[max(0, i - 2):i + 3]), 0).round()) for i in range(len(filled))]


def tidy_nape(a, anchor=None):
    """(frame, keep mask) for the thin strip of skin at the back of her neck, under the back corner
    of her jaw. The edge clean-up took it for an edge and repainted it brown from her hair (a brown
    spot): the mask lets it through untouched. Where it meets the collar, the export's specks,
    sprigs and khaki or grey edge pixels go, so what's let through is clean."""
    import cv2
    H, W = a.shape[:2]
    keep = np.zeros((H, W), np.float32)
    if anchor is None:
        anchor = nape_anchor(a)
    if anchor is None:
        return a, keep
    xb, yb = anchor
    keep[max(0, yb - NAPE_UP):yb + NAPE_DOWN, max(0, xb - NAPE_BACK):xb + NAPE_FWD] = 1
    a = a.copy()
    r, g, b, al = [a[..., i].astype(np.float32) for i in range(4)]
    skin = (al > 200) & (r > 160) & (g > 100) & (r - b > 40)
    lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    sweater = (al > 200) & (b > r + 8)
    # the junction: the strip's foot, the collar's top and the bit of room between them
    jy0, jy1 = max(0, yb - 8), min(H, yb + NAPE_DOWN)  # from the strip's side only: never into her hair,
    jx0, jx1 = max(0, xb - 1), min(W, xb + NAPE_FWD + 16)  # whose pale shine would go see-through
    J = (slice(jy0, jy1), slice(jx0, jx1))
    fleck = (al > 0) & (lum > 80) & (g > 85) & (r - g < 52) & ~sweater & ~skin
    a[..., 3][J] = np.where(fleck[J], 0, a[..., 3][J])
    # the strip's foot is skin to the end: its pale highlight there reads as a light dot
    near = skin[max(0, yb - 30):max(1, yb - 6), max(0, xb - NAPE_BACK):xb + NAPE_FWD]
    tone = neck = None
    if near.sum() > 20:
        tone = np.median(a[max(0, yb - 30):max(1, yb - 6), max(0, xb - NAPE_BACK):xb + NAPE_FWD][near][:, :3], 0)
        tl = 0.2126 * tone[0] + 0.7152 * tone[1] + 0.0722 * tone[2]
        F = (slice(max(0, yb - 8), min(H, yb + 10)), slice(max(0, xb - NAPE_BACK - 4), min(W, xb + NAPE_FWD + 16)))
        fr, fg, fb_ = [a[F][..., i].astype(np.float32) for i in range(3)]
        fl = 0.2126 * fr + 0.7152 * fg + 0.0722 * fb_
        # too light, or the export's khaki: a pale line where the strip meets the collar
        light = (a[F][..., 3] > 0) & ((fl > tl + 22) | ((fl > 90) & ((fr - fb_) / np.maximum(fr, 1) < 0.3))) & ~(fb_ > fr + 8)
        # only on the strip itself (touching its skin), never the shine on her hair beside it
        _, lab = cv2.connectedComponents(skin.astype(np.uint8), connectivity=8)
        neck = (lab == lab[yb, xb]) if skin[yb, xb] else np.zeros_like(skin)
        light &= cv2.dilate(neck[F].astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
        a[F][..., :3][light] = tone.round().astype(np.uint8)
    # specks and sprigs: what an opening takes off her outline, and bits not joined to her
    solid = (a[..., 3][J] > 100).astype(np.uint8)
    disc = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (NAPE_SPECK, NAPE_SPECK))
    body = cv2.morphologyEx(solid, cv2.MORPH_OPEN, disc)
    body = body | (solid & cv2.dilate(body, np.ones((3, 3), np.uint8)))
    n, lab, st, _ = cv2.connectedComponentsWithStats(body, 8)
    edge = np.zeros_like(body, bool)
    edge[0, :] = edge[-1, :] = edge[:, 0] = edge[:, -1] = True
    joined = np.isin(lab, np.unique(lab[edge & (body > 0)])) & (body > 0)  # her, carrying on outside the box
    near = cv2.dilate(joined.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
    a[..., 3][J] = np.where(near, a[..., 3][J], 0)
    # grey, lilac or khaki pixels left on the strip's edge take the nearest clean colour (skin or collar)
    sub = a[J].astype(np.float32)
    sr, sg, sb, sal = [sub[..., i] for i in range(4)]
    slum = 0.2126 * sr + 0.7152 * sg + 0.0722 * sb
    rim = cv2.dilate((sal < 50).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0  # her outline, not the hair's shine inside
    pale = rim & (sal > 0) & (slum > 85) & ((sr - sb) / np.maximum(sr, 1) < 0.36) & ~(sb > sr)
    good = (sal > 200) & ~pale & (slum > 60)
    if pale.any() and good.any():
        _, nl = cv2.distanceTransformWithLabels((~good).astype(np.uint8), cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
        gy, gx = np.nonzero(good)
        col = np.zeros((nl.max() + 1, 3), np.uint8)
        col[nl[gy, gx]] = a[J][gy, gx, :3]
        py, px = np.nonzero(pale)
        a[jy0 + py, jx0 + px, :3] = col[nl[py, px]]
    # and it reaches the collar: what's left between its foot and the collar's dark edge (part
    # see-through, so the lit room showed as a pale line there) is filled with its skin
    if tone is not None and neck.any():
        for x in range(F[1].start, F[1].stop):
            ys = np.nonzero(neck[F[0].start:yb + 6, x])[0]
            if not len(ys):
                continue
            ys_ = F[0].start + ys[-1]
            if ys_ < yb - 1:  # only under the foot itself: never a wedge past its slanting edge
                continue
            below = np.nonzero(a[ys_ + 1:ys_ + 1 + NAPE_FOOT, x, 3] > 200)[0]
            if not len(below) or below[0] == 0:
                continue
            gap = slice(ys_ + 1, ys_ + 1 + below[0])
            a[gap, x, :3] = tone.round().astype(np.uint8)
            a[gap, x, 3] = 255
    return a, np.clip(cv2.GaussianBlur(keep, (0, 0), 2.0), 0, 1)


def nape_foot(f, ox, oy, k):
    """A finished frame (uint8 RGBA, the box's pixels) with the strip's foot reaching the collar:
    any see-through or pale pixel with the strip's skin just above it and the collar just below
    takes the skin's colour. Done last, on what's shown: steps that smooth over time had left it
    part see-through there, a pale line of the lit room between her neck and her collar."""
    H, W = f.shape[:2]
    r0 = max(0, oy - round(10 * k)); r1 = min(H, oy + round(10 * k))
    c0 = max(0, ox - round(16 * k)); c1 = min(W, ox + round(16 * k))
    a = f[r0:r1, c0:c1].astype(np.float32)
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    skin = (al > 220) & (r - b > 40) & (lum > 100) & (lum < 215)
    if skin.sum() < 6:
        return f
    tone = np.median(a[skin][:, :3], 0)
    collar = (al > 200) & ((lum < 70) | (b > r + 8))
    pale = (lum > 0.2126 * tone[0] + 0.7152 * tone[1] + 0.0722 * tone[2] + 18) | ((r - b) / np.maximum(r, 1) < 0.3)
    out = f.copy()
    sub = out[r0:r1, c0:c1]
    hair = (al > 200) & (lum < 90) & ~collar & (r >= b)
    foot = np.zeros_like(skin)
    foot[max(0, oy - round(5 * k) - r0):, :] = True  # only at its foot, never the neck's own shine higher up
    low = np.zeros_like(skin)
    low[max(0, oy - round(9 * k) - r0):, :] = True
    for _ in range(6):  # a band a few px tall fills from the top down
        above = np.zeros_like(skin)
        below = np.zeros_like(skin)
        for d in (1, 2, 3):
            above[d:] |= skin[:-d]
        for d in range(1, 6):
            below[:-d] |= collar[d:]
        beside = np.zeros_like(skin)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                beside |= np.roll(np.roll(skin, dy, 0), dx, 1)
        # a see-through sliver between her hair and the strip shows the room too
        left = np.zeros_like(skin)
        right = np.zeros_like(skin)
        warm = (al > 200) & (lum >= 90) & ~collar & (r - b > 25)
        for d in range(1, 7):
            left[:, d:] |= hair[:, :-d]
            right[:, :-d] |= warm[:, d:]
        fill = ~collar & ~skin & ~hair & (((al < 250) & above & below) | (pale & (al > 40) & beside & below & foot)
                                          | ((al < 250) & left & right & low))
        if not fill.any():
            break
        sub[fill, :3] = tone.round().astype(np.uint8)
        sub[fill, 3] = 255
        al = np.where(fill, 255, al)
        skin = skin | fill
    # and a small see-through hole enclosed by her there (the room through it) is closed
    import cv2
    clear = (al < 128).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(clear, 4)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])))
    for i in range(1, n):
        if i not in edge and st[i, cv2.CC_STAT_AREA] <= round(40 * k * k):
            hole = (lab == i) & low
            sub[hole, :3] = tone.round().astype(np.uint8)
            sub[hole, 3] = 255
    return out


def paint_neck_seq(frames, keeps=None):
    """Every frame (RGBA arrays) with her neck painted in, following her head. The jaw, collar and
    throat are measured per frame, then evened out over neighbouring frames, so the neck never
    jitters; its tone is one for the whole clip. If `keeps` is a list, each frame's throat_keep
    mask is added to it. Off (NECK_PAINT False): only the back of her neck is tidied (tidy_nape)."""
    if not NECK_PAINT:
        out = []
        for f, at in zip(frames, nape_anchors(frames)):
            f2, keep = tidy_nape(f, at)
            out.append(f2)
            if keeps is not None:
                keeps.append(keep)
        return out
    ms = [_neck_measure(f) for f in frames]
    tones = [m['tone'] for m in ms if m['tone'] is not None]
    tone = np.median(np.stack(tones), 0) if tones else None
    out = []
    for t, m in enumerate(ms):
        near = ms[max(0, t - 2):t + 3]
        sm = dict(m)
        sm['tone'] = tone
        sm['top_x'] = float(np.median([n['top_x'] for n in near]))
        sm['jy'] = float(np.median([n['jy'] for n in near]))
        for key in ('jaw', 'col'):
            stack = np.stack([n[key] for n in near])
            med = np.median(np.where(stack >= 0, stack, np.nan), 0)
            sm[key] = np.where(np.isnan(med), -1.0, med)
        out.append(_neck_paint(frames[t], sm))
        if keeps is not None:
            keeps.append(throat_keep(frames[t].shape, sm))
    return out


def hair_rim(rgba, zone, rim, calm=HAIR_RIM_CALM):
    """rgba: a frame in the box (float RGBA, straight alpha); zone: 0-1, where the hair down her
    back is. The export left the outer lock of that hair a mottled grey-green (its old background
    mixed in, darker than the pale leftovers refine_edges repaints), which reads as a dirty outline
    against the warm bookshelf. Within `rim` px of her outline, each pixel takes the colour of the
    hair just inside, keeping its own light and shade (so the strands stay), its mottle calmed by
    `calm`. Everything else, and everything outside the zone, is left as it is."""
    import cv2
    rgb, a = rgba[..., :3], rgba[..., 3]
    dist = cv2.distanceTransform((a > 128).astype(np.uint8), cv2.DIST_L2, 5)
    L = luma(rgb)
    hairish = (L < 135) & (rgb[..., 0] >= rgb[..., 1]) & (rgb[..., 1] >= rgb[..., 2] - 4)
    seed = ((dist > rim + 2) & hairish & (zone > 0.5)).astype(np.float32)
    # the hair's colour nearby: a wide, smooth average of the hair inside, so no single lit
    # strand streaks into the rim
    sig = rim * 0.8
    num = cv2.GaussianBlur(rgb * seed[..., None], (0, 0), sig)
    den = cv2.GaussianBlur(seed, (0, 0), sig)
    inner = num / np.maximum(den, 1e-4)[..., None]
    Li = luma(inner)
    ramp = np.clip((rim - dist) / 8, 0, 1)  # all of it at the outline, easing off over 8 px inside
    ramp[(a > 0) & (a <= 128)] = 1
    # only pixels that are hair themselves (or its grey leftovers): never the teal sweater or skin
    own = cv2.GaussianBlur(((L < 140) & (rgb[..., 2] - rgb[..., 0] < 6)).astype(np.float32), (0, 0), 1.0)
    weight = (ramp * zone * (den > 0.02) * own)[..., None]
    Lout = L * (1 - calm) + Li * calm  # the rim's own light and shade, its mottle calmed
    # the hair's hue at that light: its colour offset, never made stronger where the rim is lighter
    target = Lout[..., None] + (inner - Li[..., None]) * np.clip(Lout / np.maximum(Li, 1), 0.4, 1.0)[..., None]
    out = rgba.copy()
    out[..., :3] = np.clip(rgb * (1 - weight) + target * weight, 0, 255)
    return out


NOTEBOOK_ZONE = (714, 1000, 1288, 1400)  # source px: the open notebook on the desk (right of the pen)


def notebook_outline(rgba, zone, sigma=1.8, line=1.6, ink=0.58):
    """rgba: a frame in the box (float RGBA); zone: 0-1, where the notebook is. The export drew the
    notebook's outer edge stair-stepped (its coverage jumps from clear to solid within a pixel along
    a slanted line) with a thin grey line on the steps, a dotted, saw-toothed outline against the
    desk. The outline is smoothed (the coverage blurred and re-sharpened to a clean anti-aliased
    edge), and the edge redrawn as one continuous line: the paper's or the cover's own colour, a
    little darker at the very edge, like the paper's thickness. Inside, nothing changes."""
    import cv2
    rgb, a = rgba[..., :3], rgba[..., 3] / 255
    new_a = np.clip((cv2.GaussianBlur(a, (0, 0), sigma) - 0.5) * 1.9 + 0.5, 0, 1)
    dist = cv2.distanceTransform((new_a > 0.5).astype(np.uint8), cv2.DIST_L2, 5)
    deep = ((dist > 3.5) & (a > 0.98)).astype(np.float32)
    num = cv2.GaussianBlur(rgb * deep[..., None], (0, 0), 3)
    den = cv2.GaussianBlur(deep, (0, 0), 3)
    inner = num / np.maximum(den, 1e-4)[..., None]
    edge_line = np.clip((line + 0.6 - dist) / 1.2, 0, 1)  # the outer ~1.6 px: the edge's line
    band = np.clip((3.5 - dist) / 1.5, 0, 1) * (den > 0.05)  # within 3.5 px of the edge
    target = inner * (1 - edge_line[..., None] * (1 - ink))
    w = (band * zone)[..., None]
    out = rgba.copy()
    out[..., :3] = np.clip(rgb * (1 - w) + target * w, 0, 255)
    out[..., 3] = (a * (1 - zone) + new_a * zone) * 255
    return out


def quiet_specks(frames, max_area=60, jump=24, back=14, still=6, pad=8):
    """frames: finished RGBA frames (uint8 arrays, changed in place). Removes the export's
    one-frame specks: a small patch (up to max_area px) that jumps away for exactly one frame and
    comes straight back, in a place where nothing else moves (the ring around it is still in the
    frames before and after). Mostly white flecks on her outline and faint ghosts in the clear
    area around her, which flash for a frame against the room. Real movement is never touched:
    a blink, the pen, a page edge or a moving arm all move their surroundings too.
    Returns how many pixels were replaced (by the average of the frames either side)."""
    import cv2
    k3 = np.ones((3, 3), np.uint8)

    def lum(x):
        a = x[..., 3:4].astype(np.float32) / 255
        return (x[..., :3].astype(np.float32).mean(-1, keepdims=True) * a + 128 * (1 - a))[..., 0]

    ls = [lum(f) for f in frames]
    src = [f.copy() for f in frames]
    fixed = 0
    for i in range(1, len(frames) - 1):
        m = (np.abs(ls[i] - ls[i - 1]) > jump) & (np.abs(ls[i + 1] - ls[i - 1]) < back)
        if not m.any():
            continue
        n, lab, stats, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8), connectivity=8)
        H, W = m.shape
        before, after = np.abs(ls[i] - ls[i - 1]), np.abs(ls[i + 1] - ls[i])
        fix = np.zeros_like(m)
        for c in range(1, n):
            x, y, w, h, area = stats[c]
            if area > max_area:
                continue
            x0, y0, x1, y1 = max(0, x - pad), max(0, y - pad), min(W, x + w + pad), min(H, y + h + pad)
            comp = (lab[y0:y1, x0:x1] == c).astype(np.uint8)
            near = cv2.dilate(comp, k3, iterations=2).astype(bool)
            ring = cv2.dilate(comp, k3, iterations=pad).astype(bool) & ~near
            if not ring.any():
                continue
            if np.percentile(before[y0:y1, x0:x1][ring], 90) > still or np.percentile(after[y0:y1, x0:x1][ring], 90) > still:
                continue  # something moves around it: that's motion, not a speck
            fix[y0:y1, x0:x1] |= near
        fix &= np.abs(ls[i + 1] - ls[i - 1]) < back
        if fix.any():
            mean = (src[i - 1][fix].astype(np.float32) + src[i + 1][fix].astype(np.float32)) / 2
            frames[i][fix] = np.round(mean).astype(np.uint8)
            fixed += int(fix.sum())
    return fixed


def calm_shimmer(frames, keep=None):
    """frames (straight RGBA uint8 arrays) with the generated video's shimmer calmed: each blended
    with its flow-followed matches in the CALM_REACH frames either side, only where the match is
    confirmed forward and back and the colours agree."""
    import cv2
    dis = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
    H, W = frames[0].shape[:2]
    gx, gy = np.meshgrid(np.arange(W, dtype=np.float32), np.arange(H, dtype=np.float32))

    def grey(f):
        a = f[..., 3:4].astype(np.float32) / 255.0
        rgb = f[..., :3].astype(np.float32) * a + (1 - a) * 128
        return cv2.cvtColor(np.clip(rgb, 0, 255).astype(np.uint8), cv2.COLOR_RGB2GRAY)

    def flow(a, b):
        a2 = cv2.resize(a, (W // 2, H // 2), interpolation=cv2.INTER_AREA)
        b2 = cv2.resize(b, (W // 2, H // 2), interpolation=cv2.INTER_AREA)
        return cv2.resize(dis.calc(a2, b2, None), (W, H), interpolation=cv2.INTER_LINEAR) * 2.0

    def warp(img, fl):
        return cv2.remap(img, gx + fl[..., 0], gy + fl[..., 1], cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)

    cache = {}

    def pm(i):  # premultiplied float, kept only for the frames in the window
        if i not in cache:
            f = frames[i]
            cache[i] = np.dstack([f[..., :3].astype(np.float32) * f[..., 3:4] / 255.0, f[..., 3:4].astype(np.float32)])
        return cache[i]

    greys = [grey(f) for f in frames]
    n = len(frames)
    out = []
    for t in range(n):
        for i in [i for i in cache if i < t - CALM_REACH]:
            del cache[i]
        acc = pm(t) * CALM_WEIGHTS[0]
        wsum = np.full((H, W), CALM_WEIGHTS[0], np.float32)
        acc_a = pm(t)[..., 3] * CALM_WEIGHTS[0]
        wsum_a = np.full((H, W), CALM_WEIGHTS[0], np.float32)
        for k in range(1, CALM_REACH + 1):
            for s_ in (t - k, t + k):
                if s_ < 0 or s_ >= n:
                    continue
                f_ts = flow(greys[t], greys[s_])
                back = warp(flow(greys[s_], greys[t]), f_ts)
                fb = np.hypot(f_ts[..., 0] + back[..., 0], f_ts[..., 1] + back[..., 1])
                warped = warp(pm(s_), f_ts)
                d = np.abs(warped - pm(t)).mean(-1)
                speed = np.hypot(f_ts[..., 0], f_ts[..., 1]) / k
                w = CALM_WEIGHTS[k] * np.exp(-(d / CALM_SIGMA) ** 2) * (fb < 0.75) * np.exp(-(speed / CALM_MOTION) ** 2)
                acc += warped * w[..., None]
                wsum += w
                if CALM_ALPHA_SIGMA:
                    da = np.abs(warped[..., 3] - pm(t)[..., 3])
                    wa = CALM_WEIGHTS[k] * np.exp(-(da / CALM_ALPHA_SIGMA) ** 2) * (fb < 0.75) * np.exp(-(speed / CALM_MOTION) ** 2)
                    acc_a += warped[..., 3] * wa
                    wsum_a += wa
        p = acc / wsum[..., None]
        a = p[..., 3:4]
        rgb = np.where(a > 0.5, p[..., :3] * 255.0 / np.maximum(a, 1e-6), frames[t][..., :3])
        if CALM_ALPHA_SIGMA:  # the colour stays the colour calming's; only how solid it is changes
            a = (acc_a / wsum_a)[..., None]
        calmed = np.dstack([rgb, a])
        if keep is not None and keep[t] is not None:  # the clean pen is steady already: kept as it is
            k_ = keep[t][..., None]
            calmed = calmed * (1 - k_) + frames[t].astype(np.float32) * k_
        out.append(calmed.round().clip(0, 255).astype(np.uint8))
        if t % 30 == 0:
            print(f'  calmed {t}/{n}', flush=True)
    return out


def source_layers(path):
    """The export's distinct frames in order, each with how many source frames it is shown for."""
    import base64
    import io
    doc = json.loads(path.read_text())
    images = {a['id']: a['p'] for a in doc['assets']}
    out = []
    for layer in sorted(doc['layers'], key=lambda l: l['ip']):
        data = base64.b64decode(images[layer['refId']].split(',', 1)[1])
        out.append((Image.open(io.BytesIO(data)).convert('RGBA'), max(1, round(layer['op'] - layer['ip']))))
    return out


def durations_ms(holds):
    """Frame durations that keep the source's exact timing (1000/30 ms per source frame), rounded
    to whole ms without drifting."""
    out, t = [], 0
    for h in holds:
        t_next = t + h
        out.append(round(t_next * 1000 / SOURCE_FPS) - round(t * 1000 / SOURCE_FPS))
        t = t_next
    return out


def clip_box(width):
    """The canvas box that holds every frame of every clip, and the chair."""
    union = None
    for path in CLIPS.values():
        for f, _ in source_layers(path):
            b = f.getchannel('A').point(lambda v: 255 if v > 6 else 0).getbbox()
            union = b if union is None else (min(union[0], b[0]), min(union[1], b[1]), max(union[2], b[2]), max(union[3], b[3]))
    wx0 = WOMAN['x'] + union[0] * WOMAN['scale']
    wy0 = WOMAN['y'] + union[1] * WOMAN['scale']
    wx1 = WOMAN['x'] + union[2] * WOMAN['scale']
    wy1 = WOMAN['y'] + union[3] * WOMAN['scale']
    chair = Image.open(CHAIR_SRC)
    cx0, cy0, cx1, cy1 = placed_box(chair.size, CHAIR)
    bx0, by0 = min(wx0, cx0) - MARGIN, min(wy0, cy0) - MARGIN
    bx1, by1 = max(wx1, cx1) + MARGIN, min(max(wy1, cy1) + MARGIN, 1080 + 60)
    k = width / (bx1 - bx0)  # output px per canvas px
    return (bx0, by0, bx1, by1), k, (width, round((by1 - by0) * k))


def build_clip(name, width, quality):
    box, k, (W, H) = clip_box(width)
    bx0, by0, bx1, by1 = box

    def to_box(img, place):
        s = place['scale'] * k
        im = img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))), Image.LANCZOS)
        canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        canvas.paste(im, (round((place['x'] - bx0) * k), round((place['y'] - by0) * k)), im)
        return canvas

    room = room_in_box(box, (W, H))

    # where her hair's outer lock gets its colour back (hair_rim), in the box's pixels, softly edged
    zx0, zy0, zx1, zy1 = HAIR_RIM_ZONE
    rim_zone = np.zeros((H, W), np.float32)
    rim_zone[max(0, round((WOMAN['y'] + zy0 * WOMAN['scale'] - by0) * k)):round((WOMAN['y'] + zy1 * WOMAN['scale'] - by0) * k),
             max(0, round((WOMAN['x'] + zx0 * WOMAN['scale'] - bx0) * k)):round((WOMAN['x'] + zx1 * WOMAN['scale'] - bx0) * k)] = 1
    rim_zone = np.asarray(Image.fromarray((rim_zone * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(12)), np.float32) / 255

    # where the notebook's outline is smoothed (notebook_outline), in the box's pixels, softly edged
    nx0, ny0, nx1, ny1 = NOTEBOOK_ZONE
    nb_zone = np.zeros((H, W), np.float32)
    nb_zone[max(0, round((WOMAN['y'] + ny0 * WOMAN['scale'] - by0) * k)):round((WOMAN['y'] + ny1 * WOMAN['scale'] - by0) * k),
            max(0, round((WOMAN['x'] + nx0 * WOMAN['scale'] - bx0) * k)):round((WOMAN['x'] + nx1 * WOMAN['scale'] - bx0) * k)] = 1
    nb_zone = np.asarray(Image.fromarray((nb_zone * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(6)), np.float32) / 255

    def finished(img, pen=None):  # the source frame is already prepared (pen, light, hair, shimmer)
        m = None
        if pen is not None:
            m = np.asarray(to_box(Image.fromarray((np.clip(pen, 0, 1) * 255).astype(np.uint8)).convert('RGBA'), WOMAN).getchannel('R'), np.float32)[..., None] / 255
        # what's kept (the pen, the back of her neck) never takes the hair's colour either
        raw = hair_rim(np.asarray(to_box(img, WOMAN), np.float32), rim_zone if m is None else rim_zone * (1 - m[..., 0]), HAIR_RIM * k)
        raw = notebook_outline(raw, nb_zone if m is None else nb_zone * (1 - m[..., 0]))  # never the pen
        done_ = edge_finish(raw, k, room, WRAP['woman'])
        if m is None:
            return done_
        # the clean pen goes through untouched: the edge clean-up would repaint its gold cap
        return (done_.astype(np.float32) * (1 - m) + raw * m).round().clip(0, 255).astype(np.uint8)

    layers = source_layers(CLIPS[name])
    holds_src = [h for _, h in layers]
    home_src = source_layers(CLIPS[HOME])[0][0]
    # the home frame itself, prepared the same way (steady pen and hair; it's its own light)
    home_steady, home_pen = steady_pen([home_src], home_src)
    home_throat = []
    home_ready = paint_neck_seq([np.asarray(fill_hair_gaps(home_steady[0]))], home_throat)[0]
    srcs, pens = steady_pen([f for f, _ in layers], home_src)  # 1. one clean pen
    srcs, gains = hold_light([np.asarray(f) for f in srcs], home_ready)  # 2. the light held to the home frame
    print(f'  light held: gains {gains.min():.3f}-{gains.max():.3f}', flush=True)
    srcs = [np.asarray(f) for f in fill_hair_gaps_seq([Image.fromarray(f) for f in srcs])]  # 3. hair gaps filled, evened over time
    throats = []
    srcs = paint_neck_seq(srcs, throats)  # 3b. her neck, which the export left out, painted in
    srcs = calm_shimmer(srcs, keep=pens)  # 4. the shimmer calmed (not the clean pen)
    feet = [(round((WOMAN['x'] + x * WOMAN['scale'] - bx0) * k), round((WOMAN['y'] + y * WOMAN['scale'] - by0) * k))
            if x is not None else None for x, y in ((p if p else (None, None)) for p in nape_anchors(srcs))]
    # 5. what the edge clean-up must leave alone: the clean pen, the frame's own pen wherever
    # that shows (lifted to turn a page, the clean pen can't follow it), and the throat's line
    keeps = [np.maximum(own_pen(f) if m is None else np.maximum(m, own_pen(f)), t) for f, m, t in zip(srcs, pens, throats)]
    layers = [(Image.fromarray(f), h, m) for f, h, m in zip(srcs, holds_src, keeps)]
    del srcs
    home_keep = home_throat[0] if home_pen[0] is None else np.maximum(home_pen[0], home_throat[0])
    home = finished(Image.fromarray(home_ready), home_keep) if name != HOME else None
    hf = nape_anchor(home_ready)
    if home is not None and hf is not None:
        home = nape_foot(home, round((WOMAN['x'] + hf[0] * WOMAN['scale'] - bx0) * k), round((WOMAN['y'] + hf[1] * WOMAN['scale'] - by0) * k), k)
    out, holds = [], []
    for i, (img, hold, pen) in enumerate(layers):
        out.append(finished(img, pen) if feet[i] is None else nape_foot(finished(img, pen), *feet[i], k))  # 5b. the strip's foot
        holds.append(hold)
        if i % 30 == 0:
            print(f'{name}: {i}/{len(layers)} frames finished', flush=True)
    print(f'{name}: {quiet_specks(out)} px of one-frame specks quieted', flush=True)  # 6. the export's specks
    if home is None:
        home = out[0]
    else:  # ease in from the shared first frame over the first ENTRY frames
        h = premul(Image.fromarray(home))
        for m in range(min(ENTRY, len(out))):
            t = m / ENTRY
            t = t * t * (3 - 2 * t)
            out[m] = fill_transparent(unpremul(h * (1 - t) + premul(Image.fromarray(out[m])) * t))
    # The bridge: her last frame eases into the shared first frame (premultiplied, smoothstep).
    last, first = premul(Image.fromarray(out[-1])), premul(Image.fromarray(home))
    for m in range(1, BRIDGE + 1):
        t = m / BRIDGE
        t = t * t * (3 - 2 * t)
        out.append(fill_transparent(unpremul(last * (1 - t) + first * t)))
        holds.append(1)
    ms = durations_ms(holds)
    # Wherever the chair (drawn over her) is solid, she can never be seen: those pixels become
    # transparent and one flat colour, so every frame is lighter to download and decode.
    chair_a = np.asarray(to_box(Image.open(CHAIR_SRC).convert('RGBA'), CHAIR).getchannel('A'))
    hidden = _min((chair_a >= 249).astype(np.uint8) * 255, 2 * k + 1) >= 255  # a little inside its edge
    for f in out:
        f[hidden] = (48, 36, 32, 0)
    frames = [Image.fromarray(f) for f in out]
    del out

    OUT.mkdir(parents=True, exist_ok=True)
    anim = kept(OUT / f'woman-{name}.webp')  # kept out of the site: the page plays the videos
    tmp = anim.with_name(f'.woman-{name}.tmp.webp')  # written aside, then swapped in: the live file is never half-written
    # Played once per turn (loop=1): if the page is a moment late starting the next clip, she
    # simply rests on the shared first frame, which the bridge ends on.
    # kept for the later steps to read back, not served: encoded quickly (method 4)
    frames[0].save(tmp, save_all=True, append_images=frames[1:], duration=ms, loop=1, lossless=False,
                   quality=quality, alpha_quality=100, method=4, exact=True)
    os.replace(tmp, anim)
    write_videos(frames, holds, OUT / f'woman-{name}')  # what the page plays (the WebP is the fallback)
    total = sum(ms)
    print(f'{anim}: {len(frames)} frames ({len(layers)} exported + {BRIDGE} bridge), {total / 1000:.2f} s, '
          f'{os.path.getsize(anim) / 1e6:.2f} MB, {W}x{H}')

    if name == HOME:
        finish_chair(to_box(Image.open(CHAIR_SRC).convert('RGBA'), CHAIR), frames[0], room, k)
        layout = json.loads(LAYOUT.read_text())
        for o in layout['overlays']:
            if o['id'] == 'woman':
                o.update(src='/media/scene/woman/woman-still.webp', intrinsic=[W, H], x=round(bx0, 1), y=round(by0, 1), width=round(bx1 - bx0, 1))
        clips = []
        for clip_name, path in CLIPS.items():
            n_holds = [h for _, h in source_layers(path)] + [1] * BRIDGE
            clips.append({'name': clip_name, 'src': f'/media/scene/woman/woman-{clip_name}.webp', 'ms': sum(durations_ms(n_holds))})
        layout['woman']['clips'] = clips
        layout['woman'].pop('animated', None)
        LAYOUT.write_text(json.dumps(layout, indent=2, ensure_ascii=False) + '\n')
        print(f'box on the canvas: x {bx0:.1f} y {by0:.1f} width {bx1 - bx0:.1f}; clips {[(c["name"], c["ms"]) for c in clips]}')



def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def breath_lift(W, H, amount):
    """How far each pixel rises at full breath in: her shoulders, upper back, head and the hair
    on them rise; nothing moves at her waist (behind the chair); her forearms, hands, pen and
    notebook stay planted on the desk, the upper arm between taking part of the lift. Smoothed,
    so nothing shears."""
    y = (np.arange(H) / H)[:, None]
    x = (np.arange(W) / W)[None, :]
    rise = smoothstep(0.72, 0.44, y)  # 0 at the waist, all of it from the shoulders up
    desk = smoothstep(0.49, 0.56, x) * smoothstep(0.46, 0.53, y)
    field = Image.fromarray((rise * (1 - desk) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(W * 0.015))
    return np.asarray(field, np.float32) / 255 * amount


def build_breath(quality):
    """woman-breath.webp: one calm breath from the home pose and back to it, exactly (played once
    or twice at rest between clips). Made by lifting her upper body a few px along breath_lift."""
    home = next(ImageSequence.Iterator(Image.open(kept(OUT / f'woman-{HOME}.webp')))).convert('RGBA')
    W, H = home.size
    pm = premul(home)
    lift = breath_lift(W, H, BREATH_LIFT * W)
    n_in, n_hold, n_out = (max(1, round(s * BREATH_FPS)) for s in BREATH_SECONDS)
    curve = np.concatenate([
        (1 - np.cos(np.pi * np.arange(n_in) / n_in)) / 2,
        np.ones(n_hold),
        (1 + np.cos(np.pi * np.arange(n_out) / n_out)) / 2,
    ])  # starts and ends at exactly 0: the home pose
    yy0 = np.arange(H, dtype=np.float32)[:, None]
    frames = []
    for c in curve:
        yy = np.clip(yy0 + lift * c, 0, H - 1)  # sample from lower down: she moves up
        y0 = np.floor(yy).astype(int)
        y1 = np.minimum(y0 + 1, H - 1)
        f = (yy - y0)[..., None]
        g = np.take_along_axis(pm, y0[..., None].repeat(4, -1), 0) * (1 - f) + np.take_along_axis(pm, y1[..., None].repeat(4, -1), 0) * f
        frames.append(Image.fromarray(fill_transparent(unpremul(g))))
    ms = [round((i + 1) * 1000 / BREATH_FPS) - round(i * 1000 / BREATH_FPS) for i in range(len(frames))]
    anim = kept(OUT / 'woman-breath.webp')
    tmp = anim.with_name('.woman-breath.tmp.webp')
    frames[0].save(tmp, save_all=True, append_images=frames[1:], duration=ms, loop=1, lossless=False,
                   quality=quality, alpha_quality=100, method=6, exact=True, minimize_size=True)
    os.replace(tmp, anim)
    write_videos(frames, [1] * len(frames), OUT / 'woman-breath', fps=BREATH_FPS)
    layout = json.loads(LAYOUT.read_text())
    layout['woman']['breath'] = {'name': 'breath', 'src': '/media/scene/woman/woman-breath.webp', 'ms': sum(ms)}
    LAYOUT.write_text(json.dumps(layout, indent=2, ensure_ascii=False) + '\n')
    print(f'{anim}: {len(frames)} frames, {sum(ms) / 1000:.2f} s, {os.path.getsize(anim) / 1e6:.2f} MB, lift {BREATH_LIFT * W:.1f} px')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--width', type=int, default=1024)
    ap.add_argument('--quality', type=int, default=72)
    ap.add_argument('--clip', choices=list(CLIPS), help='build only this clip (default: all, one after another)')
    ap.add_argument('--chair-only', action='store_true', help='redo just the chair and the still (fast)')
    ap.add_argument('--breath', action='store_true', help='redo just her breath, from the built home clip (fast)')
    a = ap.parse_args()
    if a.chair_only:
        chair_only()
    elif a.breath:
        build_breath(a.quality)
    else:
        for clip in [a.clip] if a.clip else list(CLIPS):
            build_clip(clip, a.width, a.quality)
