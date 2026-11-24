"""Build the steaming coffee's web animation from the original transparent export.

Usage: python3 scripts/build-coffee.py [--width 180] [--quality 82]   (or: npm run scene:coffee)
       python3 scripts/build-coffee.py --width 272 --out public/media/contact --prefix mug --split 0.5 --light
         (Contact's larger mug: the cup alone, sharp; the steam as its own lighter crop, see --split)
Requires Pillow and numpy. Reads (never changes):
  portfolio-website-assets/public/media/coffee-transparent.webp
Writes public/media/scene/coffee/coffee-steam.webp and coffee-still.webp.

  1. Trim every frame to the mug and its steam, and scale down once
     (premultiplied, so transparent edges get no halos).
  2. Seamless loop: the export repeats itself — frame LOOP[1] matches frame
     LOOP[0] more closely than two neighbouring frames do — so only that stretch
     is used, and the frames just past its end cross-fade into its start.
  3. Calm: a gentle 1-2-1 smoothing across frames, then blended in-between
     frames for a fluid slow motion (about 2.3x slower than the original).
  4. Transparent pixels around the mug carry its colour, and the encoder keeps
     them exactly, so lossy compression can't fringe the outline.
"""
import argparse
import os
from pathlib import Path

import numpy as np
from fractions import Fraction

from PIL import Image, ImageSequence

from clip_video import kept, write_videos

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'portfolio-website-assets/public/media/coffee-transparent.webp'
OUT = ROOT / 'public/media/scene/coffee'
MARGIN = 10  # px kept around the mug and steam, at the source size
LOOP = (30, 160)  # source frames: where the export repeats itself (found by comparing frames)
LOOP_BLEND = 12  # frames past the loop's end that cross-fade into its start
SMOOTH = (1, 2, 1)  # temporal weights
INBETWEENS = 1  # blended frames added between each pair (slow motion without stutter)
FRAME_MS = 38  # 2 frames of 38 ms per source frame of 33 ms: about 2.3x slower


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


def build(width, quality, out_dir=OUT, prefix='coffee', split=None, light=False):
    raw = [f.convert('RGBA') for f in ImageSequence.Iterator(Image.open(SOURCE))]
    box = None
    for f in raw:
        b = f.getchannel('A').point(lambda v: 255 if v > 6 else 0).getbbox()
        if b:
            box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
    w0, h0 = raw[0].size
    crop = (max(0, box[0] - MARGIN), max(0, box[1] - MARGIN), min(w0, box[2] + MARGIN), min(h0, box[3] + MARGIN))
    frames = []
    for f in raw:
        fr = f.crop(crop)
        frames.append(premul(fr.resize((width, round(fr.height * width / fr.width)), Image.LANCZOS)))
    start, end = LOOP
    loop = []
    for m in range(end - start):
        f = frames[start + m]
        if m < LOOP_BLEND and end + m < len(frames):
            t = (m + 0.5) / LOOP_BLEND
            t = t * t * (3 - 2 * t)  # smoothstep: an even fade
            f = frames[end + m] * (1 - t) + f * t
        loop.append(f)
    L = len(loop)
    k = np.array(SMOOTH, float) / sum(SMOOTH)
    r = len(k) // 2
    loop = [sum(loop[(i + j - r) % L] * k[j] for j in range(len(k))) for i in range(L)]
    slow = []
    inbetweens = 0 if light else INBETWEENS
    for i in range(L):
        a, b = loop[i], loop[(i + 1) % L]
        slow.append(a)
        for n in range(1, inbetweens + 1):
            t = n / (INBETWEENS + 1)
            slow.append(a * (1 - t) + b * t)
    loop = slow
    out = [Image.fromarray(fill_transparent(unpremul(x))) for x in loop]
    frame_ms = FRAME_MS * (INBETWEENS + 1) if light else FRAME_MS  # same pace with fewer frames
    out_dir.mkdir(parents=True, exist_ok=True)
    if split is not None:
        # The cup alone (sharp, still) and the steam above it as its own layer, so only the steam
        # animates and the cup never softens. `split` is the rim's height as a fraction of the box.
        W, H = out[0].size
        y = round(H * split)
        out[0].crop((0, y, W, H)).save(out_dir / f'{prefix}-cup.webp', quality=92, alpha_quality=100, method=6, exact=True)
        steam = [f.crop((0, 0, W, y)) for f in out]
        steam[0].save(out_dir / f'{prefix}-steam-still.webp', quality=88, alpha_quality=100, method=6, exact=True)
        anim = out_dir / f'{prefix}-steam.webp'
        steam[0].save(anim, save_all=True, append_images=steam[1:], duration=frame_ms, loop=0, lossless=False,
                      quality=quality, alpha_quality=100, method=6, exact=True)
        print(f'{out_dir}: cup {W}x{H - y}, steam {W}x{y}, {len(steam)} frames, '
              f'{os.path.getsize(anim) / 1e6:.2f} MB, crop {crop}')
        return
    anim = kept(out_dir / f'{prefix}-steam.webp')  # kept out of the site: the page plays the videos
    tmp = anim.with_name(f'.{prefix}-steam.tmp.webp')  # written aside, then swapped in: the live file is never half-written
    out[0].save(tmp, save_all=True, append_images=out[1:], duration=frame_ms, loop=0, lossless=False,
                quality=quality, alpha_quality=100, method=6, exact=True)
    os.replace(tmp, anim)
    # what the page plays (the WebP is the fallback): transparent video, every frame at the loop's pace
    write_videos(out, [1] * len(out), out_dir / f'{prefix}-steam', fps=Fraction(1000, frame_ms))
    out[0].save(out_dir / f'{prefix}-still.webp', quality=92, alpha_quality=100, method=6, exact=True)
    print(f'{anim}: {len(out)} frames, {len(out) * frame_ms / 1000:.1f} s, {os.path.getsize(anim) / 1e6:.2f} MB, '
          f'{out[0].width}x{out[0].height}, crop {crop}')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--width', type=int, default=180)
    ap.add_argument('--quality', type=int, default=82)
    ap.add_argument('--out', type=Path, default=OUT, help='output folder (default: the room\'s coffee folder)')
    ap.add_argument('--prefix', default='coffee', help='file name prefix (default: coffee)')
    ap.add_argument('--split', type=float, default=None, help='write the cup and the steam as separate layers, split at this height fraction')
    ap.add_argument('--light', action='store_true', help='no in-between frames: a much smaller loop at the same pace')
    a = ap.parse_args()
    build(a.width, a.quality, ROOT / a.out if not a.out.is_absolute() else a.out, a.prefix, a.split, a.light)
