"""Build the piano computer: the small one on the top shelf, and its close-up with a pressed sprite for every key.

Usage: python3 scripts/build-piano.py      (or: npm run scene:piano)
Requires Pillow, numpy and OpenCV (cv2).

Everything it needs is data, in the `source` block of src/scene/piano-keys.json (edit it there;
the build keeps it and rewrites the rest of the file):
  image        the base render (a transparent PNG; read, never changed)
  keys         every key, left to right, with how to find it in the image, in its own pixels:
                 "seed": [x, y]       a point on the key: a flood fill finds it (white keys), or the
                                      dark shape under the point (black keys)
                 "rect": [x, y, w, h] or "polygon": [[x, y], ...]   the key's outline, given
               (black keys with none of these are found in `blackArea`, left to right)
  blackArea    [x0, y0, x1, y1]: where the black keys are (not the dark wood around them)
  screen       "seed" (a point on the black screen) or "rect"
  press        how a key moves, per kind (white, black), in the image's pixels:
                 drop     how far its front sinks;  pivot  the share of that at its back (1: it
                          sinks level);  frontEdge  where its top meets its front face, down its
                          height (where the full drop is reached)
                 shade    its lightness pressed (it tilts from the light); richer  its colour then
                          (1: as is); backShade  a little darker again at its back
                 sidesStay  true: it goes straight down between its neighbours (a frontal view):
                          its sides stay put and only its top comes down
                 gapColour  [deep, near]: the gap it opens, in the keyboard's own dark colour (deepest
                          at the top); without it, the picture there darkened by `gap`, and
                 wall     a neighbour's side wall where it shows (0: never), wallDepth  darker going down
                 neighbourShadow / neighbourReach   soft shadow on it from the keys around it
                 topStays {front, shade, reach}   a front-on press with no edge moving (moved edges
                          read as outlines): only its front goes down, from `front` (a share of its
                          height: just above its front edge), and it shades to `shade` just under its
                          top edges (the rail, a black key's end), back to its pressed light a drop and
                          `reach` px further down. Overrides pivot, sidesStay and the gap settings
  shelfImage   the render shown on the shelf (a transparent PNG; optional, else `image`): it can be
               another angle than the close-up's (on the shelf, three-quarter, showing its left side
               like the other things there); only the close-up has to be front-on
  shelfScreen  "seed" or "rect": its screen in shelfImage (where the glimmer hint's notes rise from)
  shelfEdge    cleaning the shelf render's cut-out edge: cut (alpha below this is dropped: the faint
               glow a cut-out leaves), shrink (px the edge is pulled in) and decontaminate (px: the
               see-through rim takes the colour from just inside it, so no halo shows on the shelf)
  shelfSide    lowering the render's side panel (optional), so its back foot stands on the same line as
               its front feet, as the room's eye-level camera sees a shelf: columns left of `corner` go
               down, `drop` px at x `at` (source px); `topShare` 1 moves the whole side, 0 stretches it
  shelfShear   degrees to shear the shelf render, right side down (optional): sets its feet's line to
               the shelf board's slope while its verticals stay upright
  shelf        where it stands on the top shelf (canvas px): centreX, feetY (its feet's line), width
  shelfWidth   the shelf picture's width in pixels
  shadow       the contact shadow under its feet: height (a share of its box), opacity and feet (how
               far up from its lowest point, as a share of its height, its feet are looked for)
  knobs        the two brass knobs, top first: {"seed": [x, y]} near each one's centre. Each knob's
               printed needle is painted out of the close-up (the site draws a needle that turns
               over the lit brass, so its highlights stay where the light is); the knob's centre,
               radius and the needle's reach, width, angle and colour go in piano-keys.json

Writes public/media/scene/piano/: piano-shelf.webp (the shelf's), piano-close.webp (the close-up, at the
render's resolution) and keys-close.webp (one atlas: each key pressed, cut to just around it); the
rest of piano-keys.json (sprite boxes and atlas places, playable outlines and the screen's box and
outline, in piano-close.webp's pixels); and in scene-layout.json and hotspot-geometry.json, the
piano's place, size and contact shadow on the shelf and its clickable outline (no other object's).

Why sprites cut from the base: pressed renders made separately never line up with the base, so
swapping pictures makes it jump. Every pressed key here is made from the base itself, so it lines
up exactly and nothing else moves:
  1. Find the keys (above), then a watershed from all of them at once takes in each key's rounded
     rim, up to the middle of the gap around it, so no pale rim is left behind when it sinks.
  2. Press one key: it sinks (pivoting at its back, as far as `pivot` says), its front face slides
     down behind the keyboard's lip and shows less of itself, and it darkens as it tilts from the
     light. Where it was: the dark gap (under the rail, the black keys) or, in a three-quarter
     view, its neighbours' side walls. A soft shadow falls on it from the keys around it.
  3. Cut the sprite from the pressed picture: around the key it is the base pixel for pixel, and
     its edge is feathered there, so showing it (opacity only) can never leave a seam.
"""
import hashlib
import importlib.util
import json
import re
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public/media/scene/piano'
KEYS_JSON = ROOT / 'src/scene/piano-keys.json'
LAYOUT = ROOT / 'src/scene/scene-layout.json'
GEOMETRY = ROOT / 'src/scene/hotspot-geometry.json'
WEBP = dict(quality=92, alpha_quality=100, method=6, exact=True)
ATLAS_MAX_WIDTH = 2048
GROW = 9  # how far past its first outline a key may claim its rim (px)
RIM_REACH, RIM_LIGHT, RIM_RISE = 6, 90, 30  # a key's side rim beside its watershed outline: how far (px), how light (luma), how much it may brighten again
SIDE_KEEP, SIDE_BLEND = 3, 3  # a sinking key's own side pixels: how far in they're kept, then blended (px)
NOTES = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def midi_of(name):
    """'C#4' -> 61."""
    letter, sharp, octave = re.fullmatch(r'([A-G])(#?)(-?\d)', name).groups()
    return 12 * (int(octave) + 1) + NOTES[letter] + (1 if sharp else 0)


def luma_chroma(rgb):
    rgb = rgb.astype(np.int32)
    return rgb @ np.array([299, 587, 114]) / 1000, rgb.max(-1) - rgb.min(-1)


def solid(mask):
    """The largest piece of a mask, with its holes filled."""
    contours, _ = cv2.findContours(mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    out = np.zeros(mask.shape, np.uint8)
    if contours:
        cv2.drawContours(out, [max(contours, key=cv2.contourArea)], -1, 1, cv2.FILLED)
    return out > 0


def given_shape(spec, shape):
    """A key or screen given as a rectangle or a polygon, or None."""
    out = np.zeros(shape, np.uint8)
    if 'rect' in spec:
        x, y, w, h = spec['rect']
        out[y:y + h, x:x + w] = 1
        return out > 0
    if 'polygon' in spec:
        cv2.fillPoly(out, [np.array(spec['polygon'], np.int32)], 1)
        return out > 0
    return None


def flood(lab, seed, tolerance=6):
    h, w = lab.shape[:2]
    fill = np.zeros((h + 2, w + 2), np.uint8)
    t = (tolerance,) * 3
    cv2.floodFill(lab.copy(), fill, tuple(seed), 0, t, t, 4 | cv2.FLOODFILL_MASK_ONLY | (255 << 8))
    return solid(fill[1:-1, 1:-1] > 0)


def dark_shapes(rgba, area):
    """The black keys: dark, colourless shapes inside `area`, left to right."""
    lum, chroma = luma_chroma(rgba[..., :3])
    dark = ((lum < 120) & (chroma < 28) & (rgba[..., 3] > 200)).astype(np.uint8)
    inside = np.zeros_like(dark)
    x0, y0, x1, y1 = area
    inside[y0:y1, x0:x1] = 1
    dark = cv2.morphologyEx(dark & inside, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    dark = cv2.morphologyEx(dark, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    n, labels, stats, _ = cv2.connectedComponentsWithStats(dark)
    found = sorted((i for i in range(1, n) if stats[i, cv2.CC_STAT_AREA] > 1500), key=lambda i: stats[i, cv2.CC_STAT_LEFT])
    return [solid(labels == i) for i in found], labels


def find_keys(rgba, source):
    lab = cv2.cvtColor(np.ascontiguousarray(rgba[..., :3]), cv2.COLOR_RGB2LAB)
    shape = rgba.shape[:2]
    specs = source['keys']
    auto, labels = dark_shapes(rgba, source['blackArea'])
    unplaced = [s for s in specs if s['kind'] == 'black' and not ({'seed', 'rect', 'polygon'} & s.keys())]
    if unplaced and len(auto) != len(unplaced):
        raise SystemExit(f'Expected {len(unplaced)} black keys in blackArea, found {len(auto)}')
    auto_iter = iter(auto)
    cores = []
    for spec in specs:
        given = given_shape(spec, shape)
        if given is not None:
            cores.append(given)
        elif spec['kind'] == 'black' and 'seed' in spec:
            x, y = spec['seed']
            if labels[y, x] == 0:
                raise SystemExit(f"{spec['id']}: its seed is not on a dark key")
            cores.append(solid(labels == labels[y, x]))
        elif spec['kind'] == 'black':
            cores.append(next(auto_iter))
        else:
            cores.append(flood(lab, spec['seed']))
    blacks = np.any([c for c, s in zip(cores, specs) if s['kind'] == 'black'] or [np.zeros(shape, bool)], axis=0)
    cores = [c & ~blacks if s['kind'] == 'white' else c for c, s in zip(cores, specs)]
    return whole_keys(rgba, cores)


def whole_keys(rgba, cores):
    """Grow each key's first outline out to the middle of the dark gap around it.

    The first outline stops at a key's rounded rim, which is lighter or darker than its face; left
    behind, that rim would stay up as a pale outline while the key sinks. A watershed from every key
    at once, held back by the gaps' shadow and the wood, gives each key its rim and splits each gap
    between the keys either side of it.
    """
    rgb = np.ascontiguousarray(rgba[..., :3])
    lum, chroma = luma_chroma(rgb)
    reach = [cv2.dilate(c.astype(np.uint8), np.ones((GROW * 2 + 1,) * 2, np.uint8)) > 0 for c in cores]
    markers = np.ones(lum.shape, np.int32)  # 1: not a key
    markers[np.any(reach, axis=0)] = 0      # 0: to be decided
    markers[(lum < 100) & (chroma >= 40)] = 1  # the gaps' warm shadow and the wood
    markers[rgba[..., 3] < 200] = 1
    for i, core in enumerate(cores):
        markers[cv2.erode(core.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0] = i + 2
    cv2.watershed(rgb, markers)
    # (smoothed: the watershed's edge steps a pixel at a time)
    smooth = lambda m: cv2.GaussianBlur(m.astype(np.float32), (0, 0), 1.5) > 0.5
    masks = [solid(smooth(solid((markers == i + 2) & reach[i]))) for i in range(len(cores))]
    # The watershed stops at a rim's strongest edge, which along a key's sides is a few pixels in
    # from its outline: the rounded side rim, left out, would stay lit while the key goes down and
    # shades, a thin pale line around it. So each key also takes the lit rim beside it, sideways
    # only (never up onto the rail or down onto the keyboard's lip), row by row out from its edge
    # until the dark gap, or until the picture brightens well past the rim's darkest so far: that is
    # the far side of the gap (the next key, or the case's wall), not this key's rim.
    taken = np.any(masks, axis=0)
    usable = ~taken & (rgba[..., 3] > 200)
    for i, m in enumerate(masks):
        grown = m.copy()
        for y in np.nonzero(m.any(1))[0]:
            xs = np.nonzero(m[y])[0]
            for start, step in ((xs.min(), -1), (xs.max(), 1)):
                low = lum[y, start]
                for x in range(start + step, start + step * (RIM_REACH + 1), step):
                    if not (0 <= x < lum.shape[1]) or not usable[y, x] or lum[y, x] < RIM_LIGHT or lum[y, x] > low + RIM_RISE:
                        break
                    grown[y, x] = True
                    low = min(low, lum[y, x])
        masks[i] = grown
    return masks


def nearest_outside(mask):
    """For every pixel of the mask: the nearest pixel outside it (y, x) and how far that is."""
    dist, labels = cv2.distanceTransformWithLabels(mask.astype(np.uint8), cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
    zy, zx = np.nonzero(mask == 0)
    pos = np.zeros((labels.max() + 1, 2), np.int32)
    pos[labels[zy, zx]] = np.stack([zy, zx], -1)
    near = pos[labels]
    return near[..., 0], near[..., 1], dist


def in_shade(rgb, light, richer):
    """Darker by `light`, with its colour kept (a touch richer), as a surface turned from the light."""
    out = rgb * light
    grey = out.mean(-1, keepdims=True)
    return np.clip(grey + (out - grey) * richer, 0, 255)


def press(base, keys, owner, index, params):
    """The whole picture with one key held down (float RGBA, the image's pixels)."""
    _, kind, mask = keys[index]
    p = params[kind]
    d = p['drop']
    ys, _ = np.nonzero(mask)
    top, bottom = ys.min(), ys.max()
    h, w = mask.shape
    yy = np.arange(h, dtype=np.float32)
    # 0 at the back of the key, 1 from its front edge down
    share = np.clip((yy - top) / max((bottom - top) * p['frontEdge'], 1), 0, 1)
    dy = d * (p['pivot'] + (1 - p['pivot']) * share)
    under = p.get('topStays')
    if under:
        # Seen from the front, nothing of a key's top moves when it goes down: its edges (under the
        # rail, and the ledges under the black keys) stay exactly where they are, since a moved edge,
        # however clean, reads as an outline. Only its front goes down: from just above its front
        # edge, its surface is drawn out by the drop, and its front face slides down behind the
        # keyboard's lip. (So its sides don't move either, and no gap opens anywhere.)
        front = top + under['front'] * (bottom - top)
        dy = np.where(yy < front, 0, np.minimum(yy - front, d)).astype(np.float32)
    map_y = np.repeat((yy - dy).astype(np.float32)[:, None], w, 1)
    map_x = np.repeat(np.arange(w, dtype=np.float32)[None, :], h, 0)
    if p.get('sidesStay'):
        # Its sides lean a little in the picture (perspective): slide its picture down along them,
        # not straight down, so its own rounded rim stays on its outline instead of drifting off
        # it by a pixel and leaving a notched line beside it.
        rows = np.nonzero(mask.sum(1) > 0.8 * mask.sum(1).max())[0]  # its full width: the front face
        left = np.array([np.nonzero(mask[y])[0].min() for y in rows], np.float32)
        right = np.array([np.nonzero(mask[y])[0].max() for y in rows], np.float32)
        kl, cl = np.polyfit(rows, left, 1)
        kr, cr = np.polyfit(rows, right, 1)
        xl, xr = kl * yy + cl, kr * yy + cr  # its edges' lines, row by row
        across = np.clip((map_x - xl[:, None]) / np.maximum(xr - xl, 1)[:, None], 0, 1)
        map_x = (map_x - dy[:, None] * (kl + (kr - kl) * across)).astype(np.float32)
    m = mask.astype(np.float32)
    sunk = cv2.remap(np.ascontiguousarray(base[..., :3]), map_x, map_y, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    if under:
        still = m  # nothing opens: the whole key is still key
        # (and its sides keep their own pixels, as below: the slid picture meets the side's pixel steps)
        inner = cv2.distanceTransform(mask.astype(np.uint8), cv2.DIST_L2, 5)
        keep = np.clip(1 - (inner - SIDE_KEEP) / SIDE_BLEND, 0, 1)
        sunk = sunk * (1 - keep[..., None]) + base[..., :3] * keep[..., None]
    elif p.get('sidesStay'):
        # Seen from the front, a key goes straight down between its neighbours: its sides stay
        # exactly where they are, and only its top comes down. So the only place it leaves is a
        # band under its top edge: anything thinner (a pixel's sliver along a leaning side) is
        # still key, never gap, or each step of the side's pixels would show as a dark notch.
        hard = (cv2.remap(m, map_x, map_y, cv2.INTER_LINEAR) > 0.5) & mask
        band = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
        opened = cv2.morphologyEx((mask & ~hard).astype(np.uint8), cv2.MORPH_OPEN, band) > 0
        near_gap = cv2.dilate(opened.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
        # (its new top edge soft over a pixel, as smooth as the painting's)
        soft_top = cv2.GaussianBlur((mask & ~opened).astype(np.float32), (0, 0), 0.8)
        still = np.where(near_gap, soft_top, 1.0).astype(np.float32) * m
        # Its sides look the same all the way down, so at its sides (its outer few pixels, away
        # from the gap at its top) it keeps its own pixels rather than the slid picture, which,
        # meeting the side's pixel steps, would pick up a pixel of the dark gap every few rows.
        inner = cv2.distanceTransform(mask.astype(np.uint8), cv2.DIST_L2, 5)
        keep = np.clip(1 - (inner - SIDE_KEEP) / SIDE_BLEND, 0, 1) * (1 - near_gap)
        sunk = sunk * (1 - keep[..., None]) + base[..., :3] * keep[..., None]
    else:
        still = cv2.remap(m, map_x, map_y, cv2.INTER_LINEAR) * m  # the key after the drop (soft at its edges)
    sunk = in_shade(sunk, p['shade'], p['richer']) * (1 - p['backShade'] * (1 - share))[:, None, None]
    edge = cv2.distanceTransform((still > 0.5).astype(np.uint8), cv2.DIST_L2, 5)
    sunk *= (1 - p['neighbourShadow'] * np.exp(-edge / p['neighbourReach']))[..., None]
    if under:
        # Gone down below its edges, it lies in their shadow: darkest just under them (the rail, a
        # black key's end), easing back to its pressed light a drop (and `reach`) further down.
        # (That shadow's line is smoothed across the key, and the shade blurred within the key only:
        # where a ledge starts, and along its sides, nothing may come out lighter or darker than
        # what's beside it, or that would show as a line.)
        lo = under['shade']
        cols = mask.any(0)
        edge_top = np.where(cols, mask.argmax(0), 0).astype(np.float32)
        line = cv2.dilate(edge_top[None, :], np.ones((1, 15), np.uint8))[0]
        v = np.clip((yy[:, None] - line[None, :]) / (d + under.get('reach', 8)), 0, 1)
        g = (lo + (1 - lo) * v * v * (3 - 2 * v)).astype(np.float32)
        g = cv2.GaussianBlur(g * m, (0, 0), 4) / np.maximum(cv2.GaussianBlur(m, (0, 0), 4), 1e-3)
        sunk *= np.where(mask, g, 1)[..., None]

    # Where the key no longer is. With `gapColour` (deep, near): the keyboard's own dark gap,
    # deepest where the key was highest, nothing of the key itself left showing there. Otherwise
    # the picture there, darkened (`gap`), and in a three-quarter view, beside the key (the
    # nearest other key lies to its left or right, and is a white key), that key's side wall, in
    # shade, darker the deeper it goes.
    if 'gapColour' in p:
        deep, near = (np.array(c, np.float32) for c in p['gapColour'])
        gap = mask & (still < 1)
        # how close to the sunk key each pixel of the gap is: 1 just above its new top, 0 a drop away
        away = cv2.distanceTransform((still <= 0.5).astype(np.uint8), cv2.DIST_L2, 5)
        t = np.clip(1 - away / max(d, 1), 0, 1)
        reveal = deep[None, None, :] * (1 - t[..., None]) + near[None, None, :] * t[..., None]
        reveal = np.where(gap[..., None], reveal, base[..., :3])
    else:
        light = np.full((h, w), p['gap'], np.float32)
        if p['wall'] > 0:
            _, _, dist = nearest_outside(mask)
            others = (owner >= 0) & (owner != index)
            ny, nx, _ = nearest_outside(~others)
            gy, gx = np.mgrid[0:h, 0:w]
            sideways = np.abs(nx - gx) > 1.5 * np.abs(ny - gy)
            white = [j for j, k in enumerate(keys) if k[1] == 'white']
            walls = sideways & np.isin(owner[ny, nx], white)
            wall = cv2.GaussianBlur(walls.astype(np.float32), (0, 0), 4)  # meeting the gap softly
            depth = np.clip(dist / d, 0, 1)
            light = wall * p['wall'] * (1 - p['wallDepth'] * depth) + (1 - wall) * p['gap']
        reveal = in_shade(base[..., :3], 1.0, 1.3) * light[..., None]

    # Feathered by a pixel just outside the outline, so its edge is as soft as the painting's.
    # (Only outside: a feather reaching inside would leave a faint copy of the key's old rim there.)
    pressed = sunk * still[..., None] + reveal * (1 - still[..., None])
    soft = np.maximum(cv2.GaussianBlur(m, (0, 0), 1.0), m)[..., None]
    out = base.copy()
    out[..., :3] = base[..., :3] * (1 - soft) + pressed * soft
    return out


def scale(img, crop, size):
    """Crop and scale a float RGBA picture (premultiplied, Lanczos)."""
    x0, y0, x1, y1 = crop
    part = img[y0:y1, x0:x1]
    a = part[..., 3:4] / 255
    pre = np.concatenate([part[..., :3] * a, part[..., 3:4]], -1)
    chans = [np.asarray(Image.fromarray(pre[..., c].astype(np.float32)).resize(size, Image.LANCZOS)) for c in range(4)]
    alpha = np.clip(chans[3], 0, 255)
    rgb = np.stack(chans[:3], -1) / np.maximum(alpha[..., None] / 255, 1e-6)
    rgb = np.where(alpha[..., None] > 0, rgb, 0)
    return np.clip(np.concatenate([rgb, alpha[..., None]], -1), 0, 255)


def path_of(mask, crop, grow=0, epsilon=1.5):
    """A mask's outline as an SVG path, in the close-up's pixels."""
    m = mask.astype(np.uint8)
    if grow:
        m = cv2.dilate(m, np.ones((grow * 2 + 1,) * 2, np.uint8))
    contours, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    poly = cv2.approxPolyDP(max(contours, key=cv2.contourArea), epsilon, True)[:, 0]
    return 'M' + 'L'.join(f'{int(x) - crop[0]} {int(y) - crop[1]}' for x, y in poly) + 'Z'


def find_screen(rgba, spec):
    given = given_shape(spec, rgba.shape[:2])
    if given is not None:
        return given
    lum, _ = luma_chroma(rgba[..., :3])
    # (`dark`: how dark the glass is; the shadowed wall of its recess can be nearly as dark, and isn't glass)
    dark = ((lum < spec.get('dark', 40)) & (rgba[..., 3] > 200)).astype(np.uint8)
    _, labels = cv2.connectedComponents(dark)
    x, y = spec['seed']
    if labels[y, x] == 0:
        raise SystemExit('The screen seed is not on the dark screen')
    glass = (labels == labels[y, x]).astype(np.uint8)
    smooth = spec.get('smooth', 0)
    if smooth:  # round off a ragged edge (a speck of reflection, a corner of the wall)
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (smooth, smooth))
        glass = cv2.morphologyEx(cv2.morphologyEx(glass, cv2.MORPH_CLOSE, k), cv2.MORPH_OPEN, k)
    return solid(glass > 0)


def free_knobs(base, specs):
    """Find each knob (a circle near its seed), measure its printed needle, and paint the needle out.
    Returns the base without needles and each knob's geometry (in the image's pixels)."""
    rgb = np.ascontiguousarray(base[..., :3].round().astype(np.uint8))
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    soft = cv2.GaussianBlur(gray.astype(np.float32), (0, 0), 6)
    yy, xx = np.mgrid[0:gray.shape[0], 0:gray.shape[1]]
    knobs, out = [], base.copy()
    for spec in specs:
        sx, sy = spec['seed']
        r0 = 80
        region = cv2.GaussianBlur(gray[sy - r0:sy + r0, sx - r0:sx + r0], (5, 5), 1.5)
        found = cv2.HoughCircles(region, cv2.HOUGH_GRADIENT, dp=1, minDist=200, param1=80, param2=25, minRadius=50, maxRadius=70)
        cx, cy, r = (sx - r0 + found[0][0][0], sy - r0 + found[0][0][1], found[0][0][2]) if found is not None else (sx, sy, 55)
        d = np.hypot(xx - cx, yy - cy)
        needle = (gray < soft - 28) & (d < r * 0.82)
        ys, xs = np.nonzero(needle)
        if not len(xs):
            raise SystemExit(f'No needle found on the knob near {spec["seed"]}')
        dd = np.hypot(xs - cx, ys - cy)
        far = dd > np.percentile(dd, 70)
        angle = float(np.degrees(np.arctan2(-(ys[far] - cy).mean(), (xs[far] - cx).mean())))
        inner, outer = float(np.percentile(dd, 3)), float(np.percentile(dd, 98))
        colour = rgb[ys, xs][np.argsort(rgb[ys, xs].sum(1))[:max(5, len(xs) // 5)]].mean(0)
        mask = cv2.dilate(needle.astype(np.uint8) * 255, np.ones((5, 5), np.uint8))
        painted = cv2.inpaint(rgb, mask, 6, cv2.INPAINT_TELEA)
        out[..., :3] = np.where(mask[..., None] > 0, painted, out[..., :3])
        rgb = np.ascontiguousarray(out[..., :3].round().astype(np.uint8))
        knobs.append({'cx': float(cx), 'cy': float(cy), 'r': float(r), 'angle': round(angle, 1), 'inner': round(inner, 1), 'outer': round(outer, 1),
                      'width': round(len(xs) / max(outer - inner, 1), 1), 'colour': [int(v) for v in colour]})
    return out, knobs


def lower_side(rgba, spec):
    """Lower the side panel (the columns left of `corner`) more the further back it goes, so its back
    foot drops `drop` px at x `at` onto the front feet's line, as an eye-level camera would see it.
    `topShare` is how much its top edge goes down with it: 1 moves the whole side down (its top
    sloping down towards the back, as it should), 0 only stretches its bottom (from `top` to `bottom`)."""
    if not spec:
        return rgba
    corner, at, drop = spec['corner'], spec['at'], spec['drop']
    top, bottom, share = spec.get('top', 0), spec.get('bottom', rgba.shape[0]), spec.get('topShare', 1)
    rate = drop / (corner - at)
    h, w = rgba.shape[:2]
    extra = int(np.ceil(rate * corner))
    xs = np.arange(w, dtype=np.float32)
    d = np.clip((corner - xs) * rate, 0, None)[None, :]  # how far each column's bottom goes down
    c = d * (1 - share) / (bottom - top)  # the extra stretch below `top`
    yo = np.arange(h + extra, dtype=np.float32)[:, None]
    above = yo - d * share
    map_y = np.where(above < top, above, (yo - d * share + c * top) / (1 + c)).astype(np.float32)
    map_x = np.broadcast_to(xs[None, :], map_y.shape).astype(np.float32)
    src = np.zeros((h + extra, w, 4), np.float32)
    src[:h] = rgba
    return cv2.remap(src, map_x, map_y, cv2.INTER_CUBIC, borderMode=cv2.BORDER_CONSTANT, borderValue=0).clip(0, 255).astype(rgba.dtype)


def shear(rgba, degrees):
    """A vertical shear, right side down by `degrees` (left side up if negative): horizontals tilt,
    verticals stay upright. The canvas grows to hold it."""
    if not degrees:
        return rgba
    t = float(np.tan(np.radians(degrees)))
    h, w = rgba.shape[:2]
    extra = int(np.ceil(abs(t) * w))
    img = Image.fromarray(np.clip(np.round(rgba), 0, 255).astype(np.uint8))
    # output (x, y) <- input (x, y - t*x), shifted down when the left side has to go up
    out = img.transform((w, h + extra), Image.AFFINE, (1, 0, 0, -t, 1, -extra if t < 0 else 0), resample=Image.BICUBIC)
    return np.asarray(out).astype(rgba.dtype)


def clean_edge(rgba, spec):
    """A cut-out's edge without its halo: the faint glow dropped, the edge pulled in a little, and the
    see-through rim coloured from just inside it (not from the background it was cut from)."""
    out = rgba.astype(np.float32)
    a = out[..., 3]
    a[a < spec.get('cut', 0)] = 0
    shrink = spec.get('shrink', 0)
    if shrink:
        a = np.minimum(a, cv2.erode(a, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (shrink * 2 + 1,) * 2)))
    reach = spec.get('decontaminate', 0)
    if reach:
        inside = cv2.erode((a >= 250).astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (reach * 2 + 1,) * 2)) > 0
        ny, nx, _ = nearest_outside(~inside)
        rim = (a > 0) & ~inside
        out[..., :3] = np.where(rim[..., None], out[ny, nx, :3], out[..., :3])
    out[..., 3] = a
    out[..., :3] = np.where(a[..., None] > 0, out[..., :3], 0)
    return out


def outline_crop(rgba, threshold=4):
    """The artwork's own outline, with a pixel of room."""
    ys, xs = np.nonzero(rgba[..., 3] > threshold)
    return tuple(int(v) for v in (max(xs.min() - 2, 0), max(ys.min() - 2, 0), min(xs.max() + 3, rgba.shape[1]), min(ys.max() + 3, rgba.shape[0])))


def fingerprint(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()[:8]


def save(pixels, path):
    Image.fromarray(pixels.round().astype(np.uint8)).save(path, **WEBP)


def trace_module():
    spec = importlib.util.spec_from_file_location('trace_overlays', ROOT / 'scripts/trace-overlays.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main():
    data = json.loads(KEYS_JSON.read_text())
    source = data['source']
    rgba = np.asarray(Image.open(ROOT / source['image']).convert('RGBA'))
    base = rgba.astype(np.float32)

    specs = source['keys']
    masks = find_keys(rgba, source)
    keys = [(s['id'], s['kind'], m) for s, m in zip(specs, masks)]
    owner = np.full(rgba.shape[:2], -1, np.int32)
    for i, (_, _, m) in enumerate(keys):
        owner[m] = i

    crop = outline_crop(rgba)
    cx0, cy0, cx1, cy1 = crop
    size = (cx1 - cx0, cy1 - cy0)

    # On the shelf: its own render (it may be another angle), its cut-out edge cleaned. The printed
    # needles stay there (too small to turn).
    OUT.mkdir(parents=True, exist_ok=True)
    shelf_rgba = rgba
    if source.get('shelfImage'):
        shelf_rgba = np.asarray(Image.open(ROOT / source['shelfImage']).convert('RGBA'))
    shelf_rgba = clean_edge(shelf_rgba, source.get('shelfEdge', {}))
    shelf_rgba = lower_side(shelf_rgba, source.get('shelfSide'))
    shelf_rgba = shear(shelf_rgba, source.get('shelfShear', 0))
    shelf_crop = outline_crop(shelf_rgba)
    sx0, sy0, sx1, sy1 = shelf_crop
    shelf_size = (sx1 - sx0, sy1 - sy0)
    shelf_w = source['shelfWidth']
    shelf = (shelf_w, round(shelf_size[1] * shelf_w / shelf_size[0]))
    save(scale(shelf_rgba, shelf_crop, shelf), OUT / 'piano-shelf.webp')
    (OUT / 'piano.webp').unlink(missing_ok=True)  # (its old name)
    shelf_screen = find_screen(shelf_rgba.round().astype(np.uint8), source.get('shelfScreen', source['screen']))
    ssy, ssx = np.nonzero(shelf_screen)

    # Up close, the needles are painted out: the site draws needles that turn (the knobs work).
    base, knobs = free_knobs(base, source.get('knobs', []))
    save(base[cy0:cy1, cx0:cx1], OUT / 'piano-close.webp')

    sprites = []
    for i, (name, kind, mask) in enumerate(keys):
        pressed = press(base, keys, owner, i, source['press'])
        # The sprite: the key and a few pixels around it (identical to the base there),
        # fading out over that margin so it can't show an edge.
        reach = cv2.dilate(mask.astype(np.uint8), np.ones((21, 21), np.uint8)) > 0
        fade = cv2.GaussianBlur(cv2.dilate(mask.astype(np.uint8), np.ones((9, 9), np.uint8)).astype(np.float32), (0, 0), 2.5)
        alpha = np.clip(fade * 1.6, 0, 1)
        ry, rx = np.nonzero(reach)
        x0, y0, x1, y1 = rx.min(), ry.min(), rx.max() + 1, ry.max() + 1
        tile = pressed[y0:y1, x0:x1].copy()
        tile[..., 3] *= alpha[y0:y1, x0:x1]
        sprites.append(dict(name=name, kind=kind, box=[int(x0 - cx0), int(y0 - cy0), int(x1 - x0), int(y1 - y0)], tile=tile,
                            hit=path_of(mask, crop, 4 if kind == 'white' else 3)))

    # Shelf-pack the sprites (in key order), 2px apart so they never bleed into each other.
    pad, ax, ay, row_h, atlas_w = 2, 0, 0, 0, 0
    for s in sprites:
        w, h = s['box'][2:]
        if ax and ax + w > ATLAS_MAX_WIDTH:
            ax, ay, row_h = 0, ay + row_h + pad, 0
        s['atlas'] = [ax, ay]
        ax += w + pad
        row_h = max(row_h, h)
        atlas_w = max(atlas_w, ax - pad)
    atlas_h = ay + row_h
    atlas = np.zeros((atlas_h, atlas_w, 4), np.float32)
    for s in sprites:
        x, y = s['atlas']
        w, h = s['box'][2:]
        atlas[y:y + h, x:x + w] = s['tile']
    save(atlas, OUT / 'keys-close.webp')

    screen = find_screen(rgba, source['screen'])
    sy, sx = np.nonzero(screen)
    # White keys first, so the black keys draw (and catch the pointer) on top.
    ordered = [s for s in sprites if s['kind'] == 'white'] + [s for s in sprites if s['kind'] == 'black']
    KEYS_JSON.write_text(json.dumps({
        '$comment': 'Edit `source` (what build-piano.py reads: see its notes), then run npm run scene:piano; it rewrites everything else here. All other sizes are in the pixels of piano-close.webp (the close-up). Each key: its pressed sprite (box on the piano, top-left in the atlas) and its playable outline. screen: the black screen, where its pixel-art reactions show.',
        'source': source,
        'size': list(size),
        # (each with its contents' fingerprint, so a rebuilt picture is never mistaken for a cached one)
        'close': f'/media/scene/piano/piano-close.webp?v={fingerprint(OUT / "piano-close.webp")}',
        'atlas': {'src': f'/media/scene/piano/keys-close.webp?v={fingerprint(OUT / "keys-close.webp")}', 'size': [atlas_w, atlas_h]},
        'screen': {'box': [int(sx.min() - cx0), int(sy.min() - cy0), int(sx.max() - sx.min() + 1), int(sy.max() - sy.min() + 1)],
                   'path': path_of(screen, crop, 0, 2.0)},
        'knobs': [{'cx': round(k['cx'] - cx0, 1), 'cy': round(k['cy'] - cy0, 1), 'r': round(k['r'], 1), 'angle': k['angle'], 'inner': k['inner'],
                   'outer': k['outer'], 'width': k['width'], 'colour': k['colour']} for k in knobs],
        'keys': [{'id': s['name'], 'midi': midi_of(s['name']), 'kind': s['kind'], 'box': s['box'], 'atlas': s['atlas'], 'hit': s['hit']}
                 for s in ordered],
        # The picture on the shelf (its own render): its size and its screen's box, in its own pixels.
        'shelf': {'size': list(shelf_size),
                  'screen': [int(ssx.min() - sx0), int(ssy.min() - sy0), int(ssx.max() - ssx.min() + 1), int(ssy.max() - ssy.min() + 1)]},
    }, indent=1, ensure_ascii=False) + '\n')

    # On the shelf: its size and place, and a soft contact shadow under its feet.
    alpha = shelf_rgba[sy0:sy1, sx0:sx1, 3] > 128
    rows = np.nonzero(alpha.any(1))[0]
    feet_bottom = rows.max()
    shadow = source['shadow']
    feet_rows = alpha[max(feet_bottom - round(shelf_size[1] * shadow.get('feet', 0.03)), 0):feet_bottom + 1]
    fx = np.nonzero(feet_rows.any(0))[0]
    place = source['shelf']
    width = place['width']
    k = width / shelf_size[0]
    sh = shadow['height']
    layout = json.loads(LAYOUT.read_text())
    piano_overlay = None
    for item in layout['overlays']:
        if item['id'] == 'piano':
            item['src'] = '/media/scene/piano/piano-shelf.webp'
            item['intrinsic'] = list(shelf)
            item['x'] = round(place['centreX'] - width / 2, 1)
            item['y'] = round(place['feetY'] - (feet_bottom + 1) * k, 1)
            item['width'] = width
            # (the feet may follow a sloping board: the shadow sits at their middle height)
            feet_y = np.median([np.nonzero(alpha[:, x])[0].max() for x in fx])
            item['shadow'] = {
                'x': round(fx.min() / shelf_size[0] - 0.03, 3),
                'y': round((feet_y + 1) / shelf_size[1] - sh * 0.6, 3),
                'w': round((fx.max() - fx.min()) / shelf_size[0] + 0.06, 3),
                'h': sh,
                'opacity': shadow['opacity'],
            }
            piano_overlay = item
    if piano_overlay is None:
        raise SystemExit('No piano overlay in scene-layout.json')
    LAYOUT.write_text(json.dumps(layout, indent=2, ensure_ascii=False) + '\n')

    # Its clickable outline in the room (only the piano's: the other objects keep theirs).
    trace = trace_module()
    geometry = json.loads(GEOMETRY.read_text())
    for spot in geometry['hotspots']:
        if spot.get('overlay') == 'piano':
            spot['polygons'] = [trace.trace(piano_overlay, layout['canvas']['width'], layout['canvas']['height'])]
            spot['label'] = {'x': round(place['centreX']), 'y': round(piano_overlay['y'] + 4), 'placement': 'top'}
    GEOMETRY.write_text(trace.format_geometry(geometry))

    kb = lambda name: f'{(OUT / name).stat().st_size / 1024:.0f} KB'
    print(f'piano-shelf.webp {shelf[0]}x{shelf[1]} ({kb("piano-shelf.webp")}), piano-close.webp {size[0]}x{size[1]} ({kb("piano-close.webp")}), '
          f'keys-close.webp {atlas_w}x{atlas_h} ({kb("keys-close.webp")}), {len(sprites)} keys; '
          f'on the shelf at x {piano_overlay["x"]}, y {piano_overlay["y"]}, {width} wide')


if __name__ == '__main__':
    main()
