"""Build the woman's web animation (her clips) and her chair, from the original exports.

Usage: python3 scripts/build-woman.py [--clip NAME] [--width 1024] [--quality 72] [--chair-only] [--breath]
       (or: npm run scene:woman)   --clip builds one clip (run one per clip in parallel to save time);
       the "writing" clip also writes the chair, the still and her box in scene-layout.json.
Requires Pillow and numpy. Reads (never changes):
  portfolio-website-assets/public/media/woman-*.json         her clips (Lottie exports of transparent frames)
  portfolio-website-assets/public/media/originals/chair.png  the armchair with its throw
Writes public/media/scene/woman/:
  woman-<clip>.webp   each clip, without the chair (the chair is drawn over it)
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
    her_first = next(ImageSequence.Iterator(Image.open(OUT / f'woman-{HOME}.webp'))).convert('RGBA')
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


def fill_hair_gaps(img):
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
    out_rgb = np.where(recolour[..., None], col, rgb)
    out_a = np.maximum(a, np.maximum(fix * 255.0, soft * 255))
    return Image.fromarray(np.dstack([out_rgb, out_a]).round().clip(0, 255).astype(np.uint8))


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
    out = []
    for f, cr, (dx, dy, deg), w_t in zip(frames, crops, poses, trust):
        if w_t < 0.01:
            out.append(f)
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
    print(f'  pen steadied in {sum(1 for w in trust if w > 0.5)}/{len(frames)} frames', flush=True)
    return out


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


def calm_shimmer(frames):
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
        for k in range(1, CALM_REACH + 1):
            for s_ in (t - k, t + k):
                if s_ < 0 or s_ >= n:
                    continue
                f_ts = flow(greys[t], greys[s_])
                back = warp(flow(greys[s_], greys[t]), f_ts)
                fb = np.hypot(f_ts[..., 0] + back[..., 0], f_ts[..., 1] + back[..., 1])
                warped = warp(pm(s_), f_ts)
                d = np.abs(warped - pm(t)).mean(-1)
                w = CALM_WEIGHTS[k] * np.exp(-(d / CALM_SIGMA) ** 2) * (fb < 0.75)
                acc += warped * w[..., None]
                wsum += w
        p = acc / wsum[..., None]
        a = p[..., 3:4]
        rgb = np.where(a > 0.5, p[..., :3] * 255.0 / np.maximum(a, 1e-6), frames[t][..., :3])
        out.append(np.dstack([rgb, a]).round().clip(0, 255).astype(np.uint8))
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

    def finished(img):  # the source frame is already prepared (pen, light, hair, shimmer)
        return edge_finish(np.asarray(to_box(img, WOMAN), np.float32), k, room, WRAP['woman'])

    layers = source_layers(CLIPS[name])
    holds_src = [h for _, h in layers]
    home_src = source_layers(CLIPS[HOME])[0][0]
    # the home frame itself, prepared the same way (steady pen and hair; it's its own light)
    home_ready = np.asarray(fill_hair_gaps(steady_pen([home_src], home_src)[0]))
    srcs = steady_pen([f for f, _ in layers], home_src)  # 1. one clean pen
    srcs, gains = hold_light([np.asarray(f) for f in srcs], home_ready)  # 2. the light held to the home frame
    print(f'  light held: gains {gains.min():.3f}-{gains.max():.3f}', flush=True)
    srcs = [np.asarray(fill_hair_gaps(Image.fromarray(f))) for f in srcs]  # 3. hair gaps filled
    srcs = calm_shimmer(srcs)  # 4. the shimmer calmed
    layers = [(Image.fromarray(f), h) for f, h in zip(srcs, holds_src)]
    del srcs
    home = finished(Image.fromarray(home_ready)) if name != HOME else None
    out, holds = [], []
    for i, (img, hold) in enumerate(layers):
        out.append(finished(img))
        holds.append(hold)
        if i % 30 == 0:
            print(f'{name}: {i}/{len(layers)} frames finished', flush=True)
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
    anim = OUT / f'woman-{name}.webp'
    tmp = OUT / f'.woman-{name}.tmp.webp'  # written aside, then swapped in: the live file is never half-written
    # Played once per turn (loop=1): if the page is a moment late starting the next clip, she
    # simply rests on the shared first frame, which the bridge ends on.
    frames[0].save(tmp, save_all=True, append_images=frames[1:], duration=ms, loop=1, lossless=False,
                   quality=quality, alpha_quality=100, method=6, exact=True, minimize_size=True)
    os.replace(tmp, anim)
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
    home = next(ImageSequence.Iterator(Image.open(OUT / f'woman-{HOME}.webp'))).convert('RGBA')
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
    anim = OUT / 'woman-breath.webp'
    tmp = OUT / '.woman-breath.tmp.webp'
    frames[0].save(tmp, save_all=True, append_images=frames[1:], duration=ms, loop=1, lossless=False,
                   quality=quality, alpha_quality=100, method=6, exact=True, minimize_size=True)
    os.replace(tmp, anim)
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
