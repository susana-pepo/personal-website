"""Precompute the soft glow layers for the four interactive objects.

Usage: python3 scripts/build-glows.py      (or: npm run scene:glows)
Requires Pillow and numpy. Reads src/scene/scene-layout.json and the overlay
PNGs (only read, never changed). Writes public/media/scene/glow/:

  <id>-halo.png   warm amber light that follows the object's silhouette, drawn
                  just behind the object (so it only shows around its edges)
  laptop-sheen.png  the screen wallpaper only, for a gentle brighten on hover
  vinyl-sheen.png   the record's rim and the metal details, for a faint amber lift
  lamp-glow.png     the pale inside of the lamp's shade and its bulb, tinted when its light changes colour
  lamp-reach.png    where the lamp's light may fall (not the window glass, not the laptop screen)

The site only fades these images' opacity, so hover costs no live filtering.
Re-run after moving or resizing an overlay (the halo margin is in canvas px).
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

root = Path(__file__).resolve().parent.parent
layout = json.loads((root / 'src/scene/scene-layout.json').read_text())
out_dir = root / 'public/media/scene/glow'
out_dir.mkdir(parents=True, exist_ok=True)

RES = 2            # pixels per canvas pixel (sharp enough for 2x screens; the halo is soft anyway)
MARGIN = 36        # canvas px of halo room around each object (also used by the site, see layout.ts)
AMBER = (0xEB, 0xC1, 0x8A)
GOLD = (0xF6, 0xD4, 0xA2)
HIGHLIGHT = (0xFF, 0xE4, 0xBA)


def load(item):
    art = Image.open(root / 'public' / item['src'].lstrip('/')).convert('RGBA')
    w = round(item['width'] * RES)
    h = round(item['width'] * art.height / art.width * RES)
    return art.resize((w, h), Image.LANCZOS)


def halo(item):
    art = load(item)
    m = MARGIN * RES
    source = art.getchannel('A').point(lambda v: 255 if v > 96 else 0)
    if 'haloFromY' in item:
        # Trace only the solid object below this line (in the artwork's own pixels): e.g. not the record player's lid.
        cut = round(item['haloFromY'] * art.height / item['intrinsic'][1])
        source.paste(0, (0, 0, source.width, cut))
    alpha = Image.new('L', (art.width + 2 * m, art.height + 2 * m), 0)
    alpha.paste(source, (m, m))
    # A defined rim of light that hugs the silhouette, with a moderate soft glow beyond it.
    # `haloSpread` (layout, default 1) narrows it: a crisp device (the laptop) keeps only a
    # close, soft rim; a wide glow round it reads cheap.
    spread = float(item.get('haloSpread', 1.0))
    near = alpha.filter(ImageFilter.MaxFilter(max(1, round(3 * spread)) * RES + 1)).filter(ImageFilter.GaussianBlur(max(1.5, 3.5 * spread) * RES))
    far = alpha.filter(ImageFilter.MaxFilter(4 * RES + 1)).filter(ImageFilter.GaussianBlur(max(2.0, 14 * spread) * RES))
    a = np.maximum(np.asarray(near, np.float32), np.asarray(far, np.float32) * 0.75 * spread)
    # warm highlight close to the edge, amber further out
    t = np.clip(np.asarray(near, np.float32) / 255.0, 0, 1)[..., None]
    rgb = np.array(AMBER, np.float32) * (1 - t) + np.array(HIGHLIGHT, np.float32) * t
    img = np.concatenate([rgb, a[..., None]], axis=2).clip(0, 255).astype(np.uint8)
    Image.fromarray(img).save(out_dir / f"{item['id']}-halo.png", optimize=True)


def hsv_arrays(art):
    rgba = np.asarray(art, np.float32) / 255.0
    rgb, alpha = rgba[..., :3], rgba[..., 3]
    mx, mn = rgb.max(axis=2), rgb.min(axis=2)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    luma = rgb @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    return rgb, alpha, sat, luma


def component_at(mask, seed):
    """The connected part of a boolean mask that contains `seed` (x, y)."""
    img = Image.fromarray((mask * 255).astype(np.uint8)).copy()
    from PIL import ImageDraw
    if img.getpixel(seed) != 255:
        return np.zeros_like(mask)
    ImageDraw.floodfill(img, seed, 128)
    return np.asarray(img) == 128


def fill_holes(mask):
    from PIL import ImageDraw
    img = Image.fromarray(np.where(mask, 255, 0).astype(np.uint8)).copy()
    padded = Image.new('L', (img.width + 2, img.height + 2), 0)
    padded.paste(img, (1, 1))
    ImageDraw.floodfill(padded, (0, 0), 128)
    outside = np.asarray(padded)[1:-1, 1:-1] == 128
    return ~outside


def laptop_sheen(item):
    art = load(item)
    rgb, alpha, sat, luma = hsv_arrays(art)
    colourful = (alpha > 0.98) & (sat > 0.3) & (luma > 0.12)
    h, w = colourful.shape
    # the wallpaper is the colourful area around the middle of the screen
    seed = next(((x, y) for y in range(int(h * 0.3), int(h * 0.5)) for x in range(int(w * 0.45), int(w * 0.6)) if colourful[y, x]), None)
    screen = fill_holes(component_at(colourful, seed)) if seed else colourful
    screen &= np.arange(h)[:, None] < h * 0.67  # the lid only, never the keyboard deck
    mask = Image.fromarray((screen * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1))
    a = np.asarray(mask, np.float32) / 255.0 * alpha
    img = np.concatenate([rgb * 255, a[..., None] * 255], axis=2).clip(0, 255).astype(np.uint8)
    Image.fromarray(img).save(out_dir / 'laptop-sheen.png', optimize=True)


def vinyl_sheen(item):
    art = load(item)
    rgb, alpha, sat, luma = hsv_arrays(art)
    h, w = luma.shape
    solid = alpha > 0.97
    # the record: the dark disc around the orange label
    hue_orange = (rgb[..., 0] > 0.75) & (rgb[..., 1] > 0.3) & (rgb[..., 1] < 0.65) & (rgb[..., 2] < 0.4) & (sat > 0.45)
    ys, xs = np.nonzero(hue_orange[int(h * 0.45):int(h * 0.8)])
    rim = np.zeros_like(luma)
    if len(xs):
        cy, cx = int(np.median(ys)) + int(h * 0.45), int(np.median(xs))
        dark = solid & ((luma < 0.22) | hue_orange)
        disc = fill_holes(component_at(dark, (cx, cy)))
        disc_img = Image.fromarray((disc * 255).astype(np.uint8))
        ring = np.asarray(disc_img.filter(ImageFilter.MaxFilter(2 * RES + 1)), np.float32) - np.asarray(disc_img.filter(ImageFilter.MinFilter(4 * RES + 1)), np.float32)
        rim = np.asarray(Image.fromarray(np.clip(ring, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(RES)), np.float32) / 255.0
    rows = np.arange(h)[:, None] > h * 0.45  # below the lid: tonearm, knobs, hinges
    metal = solid & (sat < 0.16) & (luma > 0.5) & rows
    metal_a = np.asarray(Image.fromarray((metal * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8)), np.float32) / 255.0
    a = np.maximum(metal_a * 0.9, rim * 0.8) * (alpha > 0.5)
    colour = np.where(metal[..., None], rgb * 255 * 0.5 + np.array(GOLD, np.float32) * 0.5, np.array(AMBER, np.float32))
    img = np.concatenate([colour, a[..., None] * 255], axis=2).clip(0, 255).astype(np.uint8)
    Image.fromarray(img).save(out_dir / 'vinyl-sheen.png', optimize=True)


def lamp_glow(item):
    """The lamp's lit parts (inside of the shade, bulb, brass highlights) as a soft mask,
    so the site can tint them when the light changes colour."""
    art = Image.open(root / 'public' / item['src'].lstrip('/')).convert('RGBA')
    a = np.asarray(art, np.float32) / 255.0
    rgb = a[..., :3]
    lum = rgb @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    mx, mn = rgb.max(axis=2), rgb.min(axis=2)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    bright = np.clip((lum - 0.55) / 0.3, 0, 1)
    pale = np.clip((0.5 - sat) / 0.2, 0, 1)  # the cream inside and the bulb; the brass is saturated
    w = bright * bright * (3 - 2 * bright) * pale * a[..., 3]
    mask = Image.fromarray((w * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))
    white = Image.new('L', art.size, 255)
    Image.merge('RGBA', (white, white, white, mask)).save(out_dir / 'lamp-glow.png', optimize=True)


def lamp_reach(items):
    """Where the lamp's light may fall: everywhere except the window glass (the
    view outside) and the laptop's screen (it makes its own light). A canvas-sized
    mask for the light layer."""
    S = 0.5
    W, H = round(1920 * S), round(1080 * S)
    reach = np.ones((H, W), np.float32)
    glass = np.asarray(Image.open(root / 'public/media/scene/window/glass-mask.png').getchannel('A').resize((W, H), Image.LANCZOS), np.float32) / 255
    # objects standing in front of the glass (the lamp, the vase, her hair...) are still lit
    front = Image.new('L', (W, H), 0)
    for item in items.values():
        art = Image.open(root / 'public' / item['src'].lstrip('/')).getchannel('A')
        w = round(item['width'] * S)
        h = round(item['width'] * art.height / art.width * S)
        front.paste(255, (round(item['x'] * S), round(item['y'] * S)), art.resize((w, h), Image.LANCZOS))
    front_a = np.asarray(front, np.float32) / 255
    reach *= 1 - glass * (1 - front_a)
    laptop = items.get('laptop')
    if laptop:
        sheen = Image.open(out_dir / 'laptop-sheen.png').getchannel('A')
        w = round(laptop['width'] * S)
        h = round(laptop['width'] * sheen.height / sheen.width * S)
        screen = Image.new('L', (W, H), 0)
        screen.paste(sheen.resize((w, h), Image.LANCZOS), (round(laptop['x'] * S), round(laptop['y'] * S)))
        screen = screen.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(1.5))
        reach *= 1 - np.asarray(screen, np.float32) / 255
    a = Image.fromarray((reach * 255).clip(0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1))
    white = Image.new('L', (W, H), 255)
    Image.merge('RGBA', (white, white, white, a)).save(out_dir / 'lamp-reach.png', optimize=True)


for item in layout['overlays']:
    if 'glow' in item:  # only interactive section objects glow
        halo(item)
    if item['id'] == 'laptop':
        laptop_sheen(item)
    if item['id'] == 'lamp':
        lamp_glow(item)
    if item['id'] == 'vinyl':
        vinyl_sheen(item)
lamp_reach({o['id']: o for o in layout['overlays']})  # after the laptop's sheen, which it uses
print('wrote', sorted(p.name for p in out_dir.iterdir()))
