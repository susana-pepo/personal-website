"""Build the cat's web animation (its clips) from the original transparent exports.

Usage: python3 scripts/build-cat.py [--width 480] [--quality 82] [--clip NAME]
Requires Pillow and numpy. Reads (never changes) the cat's exports, Lottie files of
transparent WebP frames, in portfolio-website-assets/public/media/:
  cat.json           sleeping peacefully (breathing): the base, on a loop
  cat-tail.json      sleeping, with a slow sweep of the tail: now and then, in place of the base
  cat-hover-1.json   a reaction to a hover (tap, keyboard focus): it turns its head a little
  cat-hover-2.json   another reaction: it wakes, stretches its front paws and settles again
Writes public/media/scene/cat/: cat-<clip>.webm and .mov for each (transparent video, what the
page plays: scripts/clip_video.py), cat-<clip>.webp (the fallback), and cat-still.webp (the sleeping
clip's first frame: shown with reduced motion or a paused room, and the source of its
outline); updates the cat's box and clip list in src/scene/scene-layout.json.

  1. One crop for every clip (the union of the cat's outlines in all of them), scaled once
     with a high-quality filter, so every clip sits exactly where the others do.
  2. Each clip is the animation exactly as exported: every frame, each shown for as long as
     the export shows it (30 frames a second). Nothing is cut, smoothed or re-timed.
  3. All the clips start from the same pose. After its last frame each has a short bridge
     (BRIDGE frames) easing back to the sleeping clip's first frame, so any clip can follow
     any other (the page plays them: src/scene/catReaction.ts, CatOverlay).
  4. Edge clean-up: only the source's light matte is removed (near-white, unsaturated
     pixels close to the outline are unmixed back to fur colour), so the ear rim and fur
     tips stay as painted; transparent pixels around the cat carry the fur colour so lossy
     encoding can't make the edge shimmer; then a very light feather.
  5. Encoded at high quality, with near-lossless transparency, keeping the colour under
     transparent pixels exactly as prepared (exact=True).
"""
import argparse
import os
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

from clip_video import write_videos

ROOT = Path(__file__).resolve().parent.parent
MEDIA = ROOT / 'portfolio-website-assets/public/media'
# The sleeping clip first (it loops, and its first frame is the pose every clip returns to),
# then the reactions to a hover.
CLIPS = {
    'sleep': MEDIA / 'cat.json',  # the base: sleeping peacefully
    'tail': MEDIA / 'cat-tail.json',  # a variation of it, with a slow sweep of the tail
    'head-turn': MEDIA / 'cat-hover-1.json',  # reactions to a hover
    'stretch': MEDIA / 'cat-hover-2.json',
}
HOME = 'sleep'
VARIATIONS = ('tail',)  # played now and then in place of the base; the rest are reactions
OUT = ROOT / 'public/media/scene/cat'
LAYOUT = ROOT / 'src/scene/scene-layout.json'
SOURCE_FPS = 30  # the exports' frame rate: kept exactly
BRIDGE = 10  # frames (1/3 s) after a clip's end that ease back to the sleeping clip's first frame
MARGIN = 8  # px kept around the cat's outline (at the source size)
FEATHER = 1.0  # px, at the output size
MATTE_DEPTH = 6  # px from the outline where matte pixels are looked for


def premul(f):
    x = np.asarray(f, np.float64)
    return np.dstack([x[..., :3] * x[..., 3:4] / 255.0, x[..., 3:4]])


def unpremul(x):
    a = x[..., 3:4]
    rgb = np.where(a > 0.5, x[..., :3] * 255.0 / np.maximum(a, 1e-6), 0)
    return np.dstack([rgb, a]).clip(0, 255)


MATTE = np.array([253.0, 246.0, 234.0])  # the source's light matte colour


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
    rgb, a = rgba[..., :3].astype(float), rgba[..., 3].astype(float)
    lum = rgb[..., 0] * 0.2126 + rgb[..., 1] * 0.7152 + rgb[..., 2] * 0.0722
    chroma = rgb.max(-1) - rgb.min(-1)
    # Matte: near-white, unsaturated pixels within MATTE_DEPTH px of the outline. Only
    # these are treated; the ear rim, cream fur and whiskers stay exactly as painted.
    A = Image.fromarray(a.round().astype(np.uint8))
    near = np.asarray(A.filter(ImageFilter.MinFilter(2 * MATTE_DEPTH + 1))) < 250
    matte = (lum > 236) & (chroma < 24) & (a > 0) & near
    good = (~matte) & (a >= 128)
    fur, reached = bleed(rgb, good.astype(float), MATTE_DEPTH + 10)
    d = fur - MATTE
    matte &= np.sqrt((d * d).sum(-1)) > 45  # where the fur itself is near-white, leave it
    # unmix: how much of the pixel is fur rather than matte, then pure fur colour
    t = np.clip(((rgb - MATTE) * d).sum(-1) / np.maximum((d * d).sum(-1), 1), 0, 1)
    a2 = a.copy()
    a2[matte] = a[matte] * t[matte]
    out = rgb.copy()
    out[matte] = fur[matte]
    # Fully transparent pixels around the cat get the fur colour too: lossy WebP blends
    # neighbouring colours, and whatever sits under alpha 0 would otherwise seep into
    # the fur tips and make them shimmer.
    outside = (a2 == 0) & (reached > 0)
    out[outside] = fur[outside]
    a2[a2 >= 250] = 255
    if FEATHER > 0:  # a very light softening of the outline only
        A2 = Image.fromarray(a2.round().clip(0, 255).astype(np.uint8))
        soft = np.asarray(A2.filter(ImageFilter.GaussianBlur(FEATHER)), float)
        inner = np.asarray(A2.filter(ImageFilter.MinFilter(3))) >= 250
        a2 = np.where(inner, a2, soft)
    return np.dstack([out, a2]).round().clip(0, 255).astype(np.uint8)


def source_layers(path):
    """The export's distinct frames in order, each with how many source frames it is shown for."""
    import base64
    import io
    import json
    doc = json.loads(path.read_text())
    images = {a['id']: a['p'] for a in doc['assets']}
    out = []
    for layer in sorted(doc['layers'], key=lambda l: l['ip']):
        data = base64.b64decode(images[layer['refId']].split(',', 1)[1])
        out.append((Image.open(io.BytesIO(data)).convert('RGBA'), max(1, round(layer['op'] - layer['ip']))))
    return out


def durations_ms(holds):
    """Frame durations keeping the source's exact timing, rounded to whole ms without drifting."""
    out, t = [], 0
    for h in holds:
        out.append(round((t + h) * 1000 / SOURCE_FPS) - round(t * 1000 / SOURCE_FPS))
        t += h
    return out


def crop_box(paths):
    """One crop for all the clips: the union of the cat's outlines, plus MARGIN."""
    x0 = y0 = 10**9
    x1 = y1 = 0
    size = None
    for path in paths:
        for f, _ in source_layers(path):
            size = f.size
            bx = f.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
            if bx:
                x0, y0, x1, y1 = min(x0, bx[0]), min(y0, bx[1]), max(x1, bx[2]), max(y1, bx[3])
    w0, h0 = size
    return (max(0, x0 - MARGIN), max(0, y0 - MARGIN), min(w0, x1 + MARGIN), min(h0, y1 + MARGIN))


# Where the cat sits in the room (canvas px), as placed with the sandbox (?sandbox=1), and the
# crop of the exports that box shows. If a new clip widens the crop, the cat stays exactly where
# it is, at the same scale, and only its box grows (all the exports share one framing).
PLACED = {'crop': (60, 115, 1684, 1168), 'x': 1472, 'y': 652, 'width': 357}


def prepare(frame, crop, width):
    fr = frame.crop(crop)
    fr = fr.resize((width, round(fr.height * width / fr.width)), Image.LANCZOS)  # premultiplied by Pillow
    return clean_edges(np.asarray(fr))


def build_clip(name, width, quality):
    import json
    crop = crop_box(CLIPS.values())
    layers = source_layers(CLIPS[name])
    out = []
    for i, (f, _) in enumerate(layers):
        out.append(prepare(f, crop, width))
    holds = [h for _, h in layers]
    home = out[0] if name == HOME else prepare(source_layers(CLIPS[HOME])[0][0], crop, width)
    last, first = premul(out[-1]), premul(home)
    for m in range(1, BRIDGE + 1):  # ease back to the sleeping clip's first frame
        t = m / BRIDGE
        t = t * t * (3 - 2 * t)
        out.append(clean_edges(unpremul(last * (1 - t) + first * t).round().clip(0, 255).astype(np.uint8)))
        holds.append(1)
    ms = durations_ms(holds)
    frames = [Image.fromarray(x) for x in out]
    OUT.mkdir(parents=True, exist_ok=True)
    anim = OUT / f'cat-{name}.webp'
    tmp = OUT / f'.cat-{name}.tmp.webp'
    # every clip plays once and rests on the sleeping pose; the page starts the next one
    frames[0].save(tmp, save_all=True, append_images=frames[1:], duration=ms, loop=1,
                   lossless=False, quality=quality, alpha_quality=100, method=6, exact=True)
    os.replace(tmp, anim)
    write_videos(frames, holds, OUT / f'cat-{name}')  # what the page plays (the WebP is the fallback)
    print(f'{anim}: {len(frames)} frames ({len(layers)} exported + {BRIDGE} bridge), {sum(ms) / 1000:.2f} s, '
          f'{os.path.getsize(anim) / 1e6:.2f} MB, {frames[0].width}x{frames[0].height}')
    if name == HOME:
        frames[0].save(OUT / 'cat-still.webp', quality=95, alpha_quality=100, method=6, exact=True)
        # the cat's box: the new crop, placed at the earlier export's scale and position
        layout = json.loads(LAYOUT.read_text())
        o = next(o for o in layout['overlays'] if o['id'] == 'cat')
        px0, py0, px1, _ = PLACED['crop']
        k = PLACED['width'] / (px1 - px0)  # canvas px per source px
        cx0, cy0, cx1, cy1 = crop
        o.update(src='/media/scene/cat/cat-still.webp', intrinsic=[frames[0].width, frames[0].height],
                 x=round(PLACED['x'] + (cx0 - px0) * k, 1), y=round(PLACED['y'] + (cy0 - py0) * k, 1),
                 width=round((cx1 - cx0) * k, 1))
        clips = []
        for clip_name, path in CLIPS.items():
            n = [h for _, h in source_layers(path)] + [1] * BRIDGE
            clips.append({'name': clip_name, 'src': f'/media/scene/cat/cat-{clip_name}.webp', 'ms': sum(durations_ms(n))})
        layout['cat']['sleep'] = clips[0]
        layout['cat']['variations'] = [c for c in clips if c['name'] in VARIATIONS]
        layout['cat']['reactions'] = [c for c in clips[1:] if c['name'] not in VARIATIONS]
        layout['cat'].pop('animated', None)
        LAYOUT.write_text(json.dumps(layout, indent=2, ensure_ascii=False) + '\n')
        print(f'cat box: x {o["x"]} y {o["y"]} width {o["width"]}; clips {[(c["name"], c["ms"]) for c in clips]}')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--width', type=int, default=480)
    ap.add_argument('--quality', type=int, default=82)
    ap.add_argument('--clip', choices=list(CLIPS), help='build only this clip (default: all)')
    a = ap.parse_args()
    for clip in [a.clip] if a.clip else list(CLIPS):
        build_clip(clip, a.width, a.quality)
