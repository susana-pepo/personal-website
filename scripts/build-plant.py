"""Build the hanging plant's sway (its leaves sway and settle: on their own, and on hover) from the original transparent export.

Usage: python3 scripts/build-plant.py [--width 320]   (or: npm run scene:plant)
Requires Pillow and numpy, and what scripts/clip_video.py needs. Reads (never changes):
  portfolio-website-assets/public/media/plant-transparent.webp   (8 s, 30 fps, 1384x1496)
Writes public/media/scene/plant/plant-stir.webm and .mov (what the page plays), plant-still.webp,
and the plant's box and clip in src/scene/scene-layout.json. Then run `npm run scene:trace` so its hover outline follows.

  1. Frame 0 of the export is the source picture pasted in, a little off the frames after it
     (a visible jump), so the rest pose is frame 1: that is the still.
  2. Only the sway itself: the leaves hardly move before frame ~40 (1.3 s) or after ~180, and a
     hover must answer at once. So the clip is frames FROM..TO: its first EASE_IN frames ease out of
     the rest pose, its last EASE_OUT ease back onto it (premultiplied, smoothstep; the leaves are
     nearly still there, so nothing ghosts). It starts and ends exactly on the still, so the page
     hands over with no jump, and can play it again straight after itself.
  3. One crop for every frame (all the leaves' reach, plus a margin), scaled down once.
  4. The export's cream matte is taken out of the leaves' edges (clean_edges), and transparent
     pixels around them carry their colour, so lossy compression can't fringe the outline.
  5. Light: 15 fps (every other frame; the sway is slow) at VP9 quality 34 and 320 px wide, about
     0.9 MB (WebM) and 0.6 MB (HEVC), like the cat's clips. It loads only after the room has
     settled (PlantOverlay), and the page never downloads an animated WebP.
  6. About one turn of the record long (5 s), the room's beat: see src/scene/plantSway.ts.
"""
import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter, ImageSequence

from clip_video import write_videos

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'portfolio-website-assets/public/media/plant-transparent.webp'
OUT = ROOT / 'public/media/scene/plant'
LAYOUT = ROOT / 'src/scene/scene-layout.json'
REST = 1  # the rest pose, the still (frame 0 is the pasted source picture)
FROM, TO = 38, 188  # the sway: the leaves move from about frame 40 and have settled by ~180
EASE_IN, EASE_OUT = 6, 12  # frames that ease out of the rest pose, and back onto it
MARGIN = 8  # source px kept around the leaves' reach
FPS = 30
STEP = 2  # keep every other frame: 15 fps (the sway is slow), about half the file
CRF = 34  # VP9 quality (lower is better): see scripts/clip_video.py
# Where the plant was placed (with the sandbox) as the original picture, plant.webp: its painted
# box on the canvas. The clip's first frame is put on the same box, so the plant stays where it is.
PLACED = {'x': 323, 'y': 408, 'width': 196}


def premul(img):
    x = np.asarray(img, np.float64)
    return np.dstack([x[..., :3] * x[..., 3:4] / 255.0, x[..., 3:4]])


def unpremul(x):
    a = x[..., 3:4]
    rgb = np.where(a > 0.5, x[..., :3] * 255.0 / np.maximum(a, 1e-6), 0)
    return np.dstack([rgb, a]).clip(0, 255)


def fill_transparent(rgba):
    """Give fully transparent pixels the colour of the nearest visible one (a few px out)."""
    rgb, a = rgba[..., :3].copy(), rgba[..., 3]
    w = (a > 0).astype(float)
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


MATTE = np.array([247.0, 245.0, 215.0])  # the export's cream matte, measured in its edge pixels
MATTE_DEPTH = 3  # px (at the output size) from the outline where matte pixels are looked for


def bleed(rgb, w, iters):
    """Spread colour from pixels where w > 0 outwards, iters px."""
    col = np.where(w[..., None] > 0, rgb, 0.0)
    H, W = w.shape
    for _ in range(iters):
        pad = np.pad(col, ((1, 1), (1, 1), (0, 0)), mode='edge')
        wp = np.pad(w, ((1, 1), (1, 1)), mode='edge')
        s = sum(pad[1 + dy:H + 1 + dy, 1 + dx:W + 1 + dx] * wp[1 + dy:H + 1 + dy, 1 + dx:W + 1 + dx, None] for dy in (-1, 0, 1) for dx in (-1, 0, 1))
        n = sum(wp[1 + dy:H + 1 + dy, 1 + dx:W + 1 + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1))
        grow = (w == 0) & (n > 0)
        col[grow] = s[grow] / n[grow][:, None]
        w = np.where(grow, 1.0, w)
    return col, w


def clean_edges(rgba):
    """The export left its cream matte in the leaves' edges (thin light rims round the stems, in the
    gaps between leaves): flecks on the dark room, shimmering as the leaves sway. As for the cat
    (scripts/build-cat.py): near-white, unsaturated pixels close to the outline are unmixed from
    the matte, so they keep only the leaf's own colour, at the opacity the leaf really had there."""
    rgb, a = rgba[..., :3].astype(float), rgba[..., 3].astype(float)
    lum = rgb @ np.array([0.2126, 0.7152, 0.0722])
    chroma = rgb.max(-1) - rgb.min(-1)
    A = Image.fromarray(a.round().clip(0, 255).astype(np.uint8))
    near = np.asarray(A.filter(ImageFilter.MinFilter(2 * MATTE_DEPTH + 1))) < 250
    matte = (lum > 170) & (chroma < 70) & (a > 0) & near
    good = (~matte) & (a >= 128)
    leaf, _ = bleed(rgb, good.astype(float), MATTE_DEPTH + 6)
    d = leaf - MATTE
    matte &= np.sqrt((d * d).sum(-1)) > 45  # where the leaf itself is that light, leave it
    t = np.clip(((rgb - MATTE) * d).sum(-1) / np.maximum((d * d).sum(-1), 1), 0, 1)
    a2, out = a.copy(), rgb.copy()
    a2[matte] = a[matte] * t[matte]
    out[matte] = leaf[matte]
    return np.dstack([out, a2]).round().clip(0, 255).astype(np.uint8)


def alpha_box(img, threshold=6):
    return img.getchannel('A').point(lambda v: 255 if v > threshold else 0).getbbox()


def build(width):
    raw = []  # the rest pose, then the sway
    for i, f in enumerate(ImageSequence.Iterator(Image.open(SOURCE))):
        if i >= TO:
            break
        if i == REST or i >= FROM:
            raw.append(f.convert('RGBA'))
    box = None
    for f in raw:
        b = alpha_box(f)
        box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
    w0, h0 = raw[0].size
    crop = (max(0, box[0] - MARGIN), max(0, box[1] - MARGIN), min(w0, box[2] + MARGIN), min(h0, box[3] + MARGIN))
    height = round((crop[3] - crop[1]) * width / (crop[2] - crop[0]))
    small = [f.crop(crop).resize((width, height), Image.LANCZOS) for f in raw]
    del raw[1:]  # only the first is needed from here (for the box): keeps memory low
    rest = premul(small[0])
    sway = small[1:]
    n = len(sway)
    ease = lambda t: t * t * (3 - 2 * t)
    out = [Image.fromarray(fill_transparent(clean_edges(unpremul(rest))))]
    for i, f in enumerate(sway):  # one frame at a time, so the floats never pile up
        x = premul(f)
        # how much of the rest pose is left in it: easing out at the start, back in at the end
        k = 1 - ease((i + 1) / (EASE_IN + 1)) if i < EASE_IN else ease((i - (n - EASE_OUT) + 1) / EASE_OUT) if i >= n - EASE_OUT else 0
        if k > 0:
            x = x * (1 - k) + rest * k
        out.append(Image.fromarray(fill_transparent(clean_edges(unpremul(x)))))
    out[-1] = out[0]
    if STEP > 1:  # fewer frames at the same pace (the sway is slow): keep the last, the still
        out = out[::-STEP][::-1]

    OUT.mkdir(parents=True, exist_ok=True)
    frame_ms = 1000 * STEP / FPS
    # (no animated WebP: nothing reads it back, and the page plays only the videos)
    write_videos(out, [1] * len(out), OUT / 'plant-stir', fps=FPS / STEP, crf=CRF)
    out[0].save(OUT / 'plant-still.webp', quality=92, alpha_quality=100, method=6, exact=True)

    # The box: the first frame's painted leaves on the box the original picture was placed on.
    first_box = alpha_box(raw[0])
    k = PLACED['width'] / (first_box[2] - first_box[0])  # canvas px per source px
    layout = json.loads(LAYOUT.read_text())
    o = next(o for o in layout['overlays'] if o['id'] == 'plant')
    o.update(src='/media/scene/plant/plant-still.webp', intrinsic=[width, height],
             x=round(PLACED['x'] - (first_box[0] - crop[0]) * k, 1), y=round(PLACED['y'] - (first_box[1] - crop[1]) * k, 1),
             width=round((crop[2] - crop[0]) * k, 1))
    layout['plant'] = {
        '$comment': 'The hanging plant on the shelf: plant-still.webp, and a gentle sway of its leaves (plant-stir, one record turn long) played on its own at the room's pace and whenever it is hovered (src/scene/plantSway.ts), built by scripts/build-plant.py from portfolio-website-assets/public/media/plant-transparent.webp. The clip starts and ends exactly on the still.',
        'stir': {'name': 'stir', 'src': '/media/scene/plant/plant-stir.webp', 'ms': round(len(out) * frame_ms)},
        'still': '/media/scene/plant/plant-still.webp',
    }
    LAYOUT.write_text(json.dumps(layout, indent=2, ensure_ascii=False) + '\n')
    print(f'plant-stir: {len(out)} frames, {len(out) * STEP / FPS:.2f} s, {out[0].width}x{out[0].height}, crop {crop}; '
          f'plant box x {o["x"]} y {o["y"]} width {o["width"]}')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--width', type=int, default=320)
    ap.add_argument('--crf', type=int, default=CRF)
    ap.add_argument('--step', type=int, default=STEP)
    a = ap.parse_args()
    CRF, STEP = a.crf, a.step
    build(a.width)
