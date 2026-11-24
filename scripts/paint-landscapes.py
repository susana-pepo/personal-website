"""Paint the piano screen's four landscapes as pixel art (128x95), in layers.

Craft, not noise: limited palettes, skies in bands with ordered-dither seams, ridges shaded by
slope against the light with rim-lit edges, tiered pines, snowcaps, sand ripples, a log cabin and
a lighthouse. The reacting things (stars that notes light, lanterns, clouds, aurora, flowers,
beams, birds, boats, the whale) stay in code; the layers leave room for them and anchors.json says
where they attach.

Usage: python3 scripts/paint-landscapes.py      (or: npm run scene:landscapes)
Requires Pillow and numpy. Writes public/media/piano/landscapes/<landscape>/NN-<layer>.png (the
layers, bottom to top), src/scene/piano-landscapes.json (each landscape's layers and anchors, for
src/scene/pianoScreen.ts) and, for looking at, previews in
portfolio-website-assets/public/media/piano/landscapes/. Each landscape has a fixed seed (SEEDS),
so a re-run paints the same picture; change a seed for a new variant.
"""
import sys, math, json, random
from pathlib import Path
import numpy as np
from PIL import Image

W, H = 128, 95
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public/media/piano/landscapes'
PREVIEWS = ROOT / 'portfolio-website-assets/public/media/piano/landscapes'
JSON = ROOT / 'src/scene/piano-landscapes.json'
SEEDS = {'lake': 7, 'peaks': 13, 'dunes': 23, 'sea': 5}
ALL = {}
BAYER = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16 + 1 / 32


def hx(h):
    h = h.lstrip('#'); return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=float)


class Layer:
    def __init__(self, name):
        self.name = name
        self.rgb = np.zeros((H, W, 3)); self.a = np.zeros((H, W))

    def put(self, x, y, c, a=1.0):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < W and 0 <= y < H and a > 0:
            a = min(1.0, a); A = self.a[y, x]
            out = a + A * (1 - a)
            self.rgb[y, x] = (np.asarray(c) * a + self.rgb[y, x] * A * (1 - a)) / out
            self.a[y, x] = out

    def get(self, x, y):
        return self.a[y, x] > 0

    def image(self):
        return Image.fromarray(np.dstack([np.clip(self.rgb, 0, 255), self.a[..., None] * 255]).astype(np.uint8))


def dither_pick(x, y, t):  # ordered dither: true where the second colour shows
    return t > BAYER[y % 4, x % 4]


def gradient_sky(L, stops, top, bottom):
    """Bands down the sky; each band boundary blends over 3 rows with a Bayer pattern."""
    cols = [hx(c) for c in stops]
    n = len(cols)
    for y in range(top, bottom):
        f = (y - top) / max(1, bottom - top - 1) * (n - 1)
        i = min(n - 2, int(f)); t = f - i
        # flat within a band, dithered near the seam (t in 0.7..1)
        k = 0 if t < 0.62 else (t - 0.62) / 0.38
        for x in range(W):
            L.put(x, y, cols[i + 1] if dither_pick(x, y, k) else cols[i])


def ridge(rng, base, rough, octaves=5, smooth=0.55, sharp=0.0):
    """1-D midpoint-ish ridge: summed octaves of smoothed random values."""
    h = np.zeros(W)
    amp, freq = rough, 3
    for _ in range(octaves):
        pts = rng.uniform(-1, 1, freq + 2)
        xs = np.linspace(0, W, freq + 2)
        v = np.interp(np.arange(W), xs, pts)
        if sharp:
            v = np.sign(v) * np.abs(v) ** (1 - sharp)
        h += v * amp
        amp *= smooth; freq *= 2
    return base + h


def shade_land(L, tops, bottom, lit, dark, rim, light_dir=-1, rim_w=1, slope_k=0.9, crisp=False):
    """Fill under a ridge; slopes facing the light get the lit colour, others the dark one, with
    a 1-px rim on the very top where it faces the light."""
    smooth = np.convolve(np.pad(np.asarray(tops, float), 5, mode='edge'), np.ones(11) / 11, mode='same')[5:-5]
    tops = np.round(tops).astype(int)
    for x in range(W):
        dh = (smooth[min(W - 1, x + 3)] - smooth[max(0, x - 3)]) / 3  # slope over a few pixels, so shading doesn't flicker
        facing = -dh * light_dir  # positive when the slope faces the light
        for y in range(max(0, tops[x]), bottom):
            depth = y - tops[x]
            t = 0.5 + 0.5 * np.tanh(facing * slope_k) if depth < 6 else 0.5 + 0.25 * np.tanh(facing * slope_k)
            t *= max(0.0, 1 - depth / 26)
            c = (lit if t > 0.5 else dark) if crisp else (lit if dither_pick(x, y, t) else dark)
            L.put(x, y, c)
        if facing > 0.3:
            for r in range(rim_w):
                L.put(x, tops[x] + r, rim)


def pine(L, x, base, h, body, light, snow=None, light_dir=-1):
    """A tiered pine: stacked triangles, lit pixels on the light side, optional snow on the tiers."""
    tiers = max(2, h // 3)
    for j in range(h):
        y = base - j
        tier_pos = (j % max(2, h // tiers)) / max(2, h // tiers)
        w = int((h - j) * 0.42 * (1.15 - 0.55 * tier_pos)) if j < h - 1 else 0
        for dx in range(-w, w + 1):
            c = body
            if dx * light_dir > 0 and abs(dx) == w and w > 0: c = light
            if snow is not None and tier_pos < 0.25 and abs(dx) < w: c = snow
            L.put(x + dx, y, c)
    L.put(x, base + 1, body)


def stars_layer(rng, n, max_y, bright, mask=None):
    L = Layer('stars')
    for _ in range(n):
        x, y = rng.integers(0, W), rng.integers(1, max_y)
        if mask is not None and not mask(x, y): continue
        k = rng.choice([0.25, 0.4, 0.6, 1.0], p=[0.45, 0.3, 0.17, 0.08])
        L.put(x, y, bright, k)
        if k == 1.0:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)): L.put(x + dx, y + dy, bright, 0.3)
    return L


def moon_layer(cx, cy, r, light, mid, crater, halo, phase=0.35):
    L = Layer('moon')
    for y in range(-r - 6, r + 7):
        for x in range(-r - 6, r + 7):
            d = math.hypot(x, y)
            if d <= r + 0.3:
                lit = math.hypot(x - phase * r * 1.6, y + 0.2 * r) <= r * 1.35
                c = light if lit else mid
                if d < r - 1 and ((x * 7 + y * 3) % 11 == 0 or (x - 2) ** 2 + (y + 2) ** 2 < 2.2 or (x + 3) ** 2 + (y - 2) ** 2 < 1.2):
                    c = crater
                L.put(cx + x, cy + y, c)
            elif d <= r + 2.5:
                L.put(cx + x, cy + y, halo, 0.22)
            elif d <= r + 6 and dither_pick(cx + x, cy + y, 0.18 * (r + 6 - d) / 3.5):
                L.put(cx + x, cy + y, halo, 0.25)
    return L


def save(scene, layers, anchors, note):
    d = OUT / scene
    d.mkdir(parents=True, exist_ok=True)
    for old in d.glob('*.png'): old.unlink()
    flat = Image.new('RGBA', (W, H), (0, 0, 0, 255))
    names = []
    for i, L in enumerate(layers, 1):
        im = L.image(); fn = f'{i:02d}-{L.name}.png'
        im.save(d / fn, optimize=True); names.append(fn)
        flat.alpha_composite(im)
    p = PREVIEWS / scene
    p.mkdir(parents=True, exist_ok=True)
    flat.save(p / 'preview.png'); flat.resize((W * 6, H * 6), Image.NEAREST).save(p / 'preview-6x.png')
    ALL[scene] = {'layers': names, **anchors, 'note': note}
    return flat


# ───────────────────────── Lake, night ─────────────────────────
def lake(rng):
    HZ = 64
    sky = Layer('sky')
    gradient_sky(sky, ['#0a0d26', '#0f1331', '#15183b', '#1d1d45', '#29244f', '#372b58', '#47325e', '#5a3a63', '#6c4466'], 0, HZ)
    moon = dict(x=int(rng.integers(20, 50)), y=int(rng.integers(12, 17)), r=7)
    ml = moon_layer(moon['x'], moon['y'], moon['r'], hx('#f4f0dc'), hx('#c9c3ad'), hx('#b4ae98'), hx('#9aa0c8'))
    st = stars_layer(rng, 70, 44, hx('#eef0ff'), mask=lambda x, y: math.hypot(x - moon['x'], y - moon['y']) > 14)
    far = Layer('far-mountains')
    fr = ridge(rng, 40, 10, sharp=0.25)
    shade_land(far, fr, HZ, hx('#4b4279'), hx('#352e60'), hx('#7166a8'), light_dir=-1 if moon['x'] < 64 else 1, crisp=True)
    near = Layer('forest-hills')
    nr = ridge(rng, 54, 3, octaves=3)
    shade_land(near, nr, HZ, hx('#1f1c3a'), hx('#17152e'), hx('#302b56'), light_dir=-1 if moon['x'] < 64 else 1, crisp=True)
    trees = Layer('pines')
    xs = sorted(set(int(v) for v in rng.uniform(0, W, 30)))
    for x in xs:
        h = int(rng.integers(7, 15))
        pine(trees, x, int(round(nr[x])) + 1, h, hx('#0f0d1e'), hx('#27244a'), light_dir=-1 if moon['x'] < 64 else 1)
    shore = Layer('shore')
    # a low bank, reeds, two rocks and a little jetty on the left
    for x in range(W):
        y0 = HZ - 1 + (1 if math.sin(x * 0.3) > 0.6 else 0)
        for y in range(y0, HZ + 1): shore.put(x, y, hx('#100e1f'))
    for x in range(0, W, 1):
        if rng.random() < 0.32 and not (6 < x < 30):
            for j in range(int(rng.integers(2, 6))): shore.put(x, HZ - 1 - j, hx('#0d0b19') if j else hx('#151227'))
    for rx, rw in ((int(rng.integers(70, 90)), 4), (int(rng.integers(100, 118)), 3)):
        for dx in range(-rw, rw + 1):
            for dy in range(0, 3 - abs(dx) // 2):
                shore.put(rx + dx, HZ - dy, hx('#24203d') if dy == 2 - abs(dx) // 2 and dx < 0 else hx('#171427'))
    jx0, jx1, jy = 8, 30, HZ + 1
    for x in range(jx0, jx1): shore.put(x, jy, hx('#4a3a3a')); shore.put(x, jy + 1, hx('#2a2026'))
    for x in (jx0 + 3, jx0 + 11, jx1 - 2):
        for y in range(jy + 2, jy + 6): shore.put(x, y, hx('#2a2026'))
    water = Layer('lake')
    for y in range(HZ, H):
        k = (y - HZ) / (H - HZ)
        for x in range(W): water.put(x, y, hx('#0a0d22') * (1 - 0.25 * k) + hx('#121838') * 0.25 * k)
    mist = Layer('mist')
    for y in range(HZ - 6, HZ + 4):
        band = 1 - abs(y - HZ + 1) / 6
        for x in range(W):
            mist.put(x, y, hx('#8d8fb8'), 0.14 * band * (0.55 + 0.45 * math.sin(x * 0.11 + y * 0.5)))
    # layer roles: 'sky' layers sit behind the reacting sky (stars, clouds); 'land' in front of them
    return save('lake', [sky, st, ml, far, near, trees, water, shore, mist],
                dict(horizon=HZ, lake_top=HZ + 1, moon=moon, roles={'sky': ['sky', 'stars', 'moon'], 'land': ['far-mountains', 'forest-hills', 'pines'], 'water': ['lake'], 'front': ['shore', 'mist']},
                     jetty=[jx0, jx1, jy]),
                'Lanterns rise from the lake above each key; clouds sit between the sky layers and the mountains; the lake mirrors the scene live.')


# ───────────────────────── Peaks, snow ─────────────────────────
def peaks(rng):
    HZ = 70
    sky = Layer('sky')
    gradient_sky(sky, ['#040a19', '#071122', '#0a182c', '#0d1f36', '#112840', '#163049', '#1b3a52', '#23445a'], 0, HZ)
    st = stars_layer(rng, 90, 36, hx('#e8f2ff'))
    def peaks_line(base, n, height, jitter):
        xs = np.sort(rng.uniform(-10, W + 10, n)); hs = rng.uniform(height * 0.55, height, n)
        top = np.full(W, base, dtype=float)
        for px, ph in zip(xs, hs):
            sl, sr = rng.uniform(0.85, 1.25), rng.uniform(0.85, 1.25)  # each peak's two flanks
            for x in range(W):
                top[x] = min(top[x], base - ph + (px - x) * sl if x < px else base - ph + (x - px) * sr)
        return top + ridge(rng, 0, jitter, octaves=3, smooth=0.5)
    far_t = peaks_line(HZ - 4, 6, 36, 1.4)
    near_t = peaks_line(HZ + 2, 5, 20, 1.0)
    def paint_peaks(L, tops, bottom, rock_lit, rock_dark, snow_lit, snow_dark, snowline, caps):
        for x in range(W):
            dh = tops[min(W - 1, x + 1)] - tops[max(0, x - 1)]
            lit_side = dh > 0  # light from the left: slopes rising to the right face it
            for y in range(max(0, int(tops[x])), bottom):
                depth = y - tops[x]
                is_snow = depth < snowline + 1.6 * math.sin(x * 0.9) + 1.1 * math.sin(x * 0.37 + 1) and y < bottom - 6
                if is_snow:
                    c = snow_lit if lit_side else snow_dark
                    caps.put(x, y, c)
                else:
                    c = rock_lit if (lit_side and dither_pick(x, y, 0.7 - depth / 40)) else rock_dark
                    L.put(x, y, c)
    far = Layer('far-peaks'); caps = Layer('snowcaps')
    paint_peaks(far, far_t, HZ, hx('#3f5075'), hx('#2b3858'), hx('#e4ecf7'), hx('#9fb1cc'), 9, caps)
    near = Layer('near-ridge')
    paint_peaks(near, near_t, HZ + 4, hx('#2b3956'), hx('#1c2740'), hx('#dbe5f2'), hx('#8fa3c0'), 4, caps)
    forest = Layer('snowy-pines')
    for x in sorted(set(int(v) for v in rng.uniform(0, W, 24))):
        pine(forest, x, HZ + 3, int(rng.integers(8, 15)), hx('#132033'), hx('#22344d'), snow=hx('#d6e1ef'))
    ground = Layer('snowfield')
    for y in range(HZ + 2, H):
        k = (y - HZ) / (H - HZ)
        for x in range(W):
            drift = math.sin(x * 0.08 + y * 0.45) * 0.5 + 0.5
            c = hx('#a9b8cf') if (drift > 0.55 - 0.15 * k) else hx('#94a5c0')
            ground.put(x, y, c * (0.6 + 0.3 * k))
    cab = Layer('cabin')
    cx, cy = int(rng.integers(26, W - 40)), HZ + 12
    for y in range(cy - 6, cy):  # log walls
        for x in range(cx - 6, cx + 7):
            cab.put(x, y, hx('#4a3226') if (y - cy) % 2 else hx('#3a271e'))
    for j, w in enumerate(range(9, 0, -1)):  # snowy roof
        for x in range(cx - w, cx + w + 1):
            cab.put(x, cy - 7 - j, hx('#eef3fa') if j < 2 or x < cx else hx('#c2cfe0'))
        if j > 6: break
    for y in range(cy - 15, cy - 8): cab.put(cx + 4, y, hx('#3a271e')); cab.put(cx + 5, y, hx('#2e1f18'))
    cab.put(cx + 4, cy - 16, hx('#eef3fa')); cab.put(cx + 5, cy - 16, hx('#eef3fa'))
    for y in range(cy - 4, cy): cab.put(cx + 3, y, hx('#24170f')); cab.put(cx + 4, y, hx('#24170f'))  # door
    window = [[cx - 3, cy - 4], [cx - 2, cy - 4], [cx - 3, cy - 3], [cx - 2, cy - 3]]
    for x, y in window: cab.put(x, y, hx('#3d2f2a'))
    for x in range(cx - 7, cx + 8): cab.put(x, cy, hx('#dfe7f2'))
    for fx in range(cx + 10, cx + 24, 3):  # a fence
        for y in range(cy - 3, cy + 1): cab.put(fx, y, hx('#2e1f18'))
        cab.put(fx, cy - 4, hx('#eef3fa'))
    for x in range(cx + 10, cx + 22): cab.put(x, cy - 2, hx('#3a271e'))
    return save('peaks', [sky, st, far, near, caps, forest, ground, cab],
                dict(horizon=HZ, cabin={'x': cx, 'y': cy}, cabin_window=window, chimney=[cx + 4, cy - 16],
                     roles={'sky': ['sky', 'stars'], 'land': ['far-peaks', 'near-ridge', 'snowcaps', 'snowy-pines'], 'ground': ['snowfield', 'cabin']}),
                'The aurora hangs between the sky and the peaks; alpenglow tints the snowcaps layer; the window and chimney anchors are for the cabin light and smoke.')


# ───────────────────────── Dunes, dusk ─────────────────────────
def dunes(rng):
    HZ = 60
    sky = Layer('sky')
    gradient_sky(sky, ['#231a3e', '#33204d', '#4a275a', '#66305e', '#86405f', '#a8525a', '#c46a50', '#d9864c', '#e7a35a'], 0, HZ)
    clouds = Layer('wisps')
    for _ in range(5):
        cx, cy, ln = rng.integers(0, W), rng.integers(10, 40), rng.integers(14, 34)
        for i in range(int(ln)):
            x = cx + i; y = cy + int(1.2 * math.sin(i * 0.3))
            clouds.put(x, y, hx('#f0b07a') if i % 5 else hx('#ffd2a0'), 0.8)
            if 3 < i < ln - 3: clouds.put(x, y + 1, hx('#b35d63'), 0.7)
    st = stars_layer(rng, 22, 16, hx('#fff1dc'))
    sun = dict(x=int(rng.integers(36, W - 36)), y=HZ - 4, r=14)
    sl = Layer('sun')
    for y in range(-sun['r'] - 3, sun['r'] + 1):
        for x in range(-sun['r'] - 3, sun['r'] + 4):
            d = math.hypot(x, y)
            if d <= sun['r']:
                band_cut = y > 0 and (y % 4 == 1 or (y > 6 and y % 3 == 0))
                if not band_cut: sl.put(sun['x'] + x, sun['y'] + y, hx('#fbe3a4') if d < sun['r'] - 2 else hx('#f6c477'))
            elif d <= sun['r'] + 3 and dither_pick(sun['x'] + x, sun['y'] + y, 0.4):
                sl.put(sun['x'] + x, sun['y'] + y, hx('#f0a865'), 0.5)
    layers = [sky, clouds, st, sl]
    tops = []
    for name, base, rough, lit, dark, rim, ripple in (
        ('far-dunes', HZ - 2, 4, hx('#d98d55'), hx('#bf7046'), hx('#f2b071'), False),
        ('middle-dunes', HZ + 9, 6, hx('#b1653f'), hx('#8e4a31'), hx('#d4875a'), True),
        ('near-dune', HZ + 22, 7, hx('#7b432f'), hx('#5d3124'), hx('#a65f40'), True)):
        L = Layer(name); t = ridge(rng, base, rough, octaves=3, smooth=0.45)
        shade_land(L, t, H, lit, dark, rim, light_dir=-1 if sun['x'] < 64 else 1, slope_k=1.4, crisp=True)
        if ripple:
            for x in range(W):
                for y in range(int(t[x]) + 3, H):
                    if (x + 2 * y + int(3 * math.sin(x * 0.2))) % 9 == 0: L.put(x, y, dark * 0.86)
        layers.append(L); tops.append(t)
    props = Layer('cacti-and-rocks')
    near = tops[2]
    for cx in (int(rng.integers(8, 40)), int(rng.integers(88, 120))):
        base = int(near[cx]); h = int(rng.integers(9, 14))
        for y in range(base - h, base + 1): props.put(cx, y, hx('#3a4a2c')); props.put(cx + 1, y, hx('#2a3620'))
        ay = base - h // 2
        for dx in range(2, 5): props.put(cx + dx, ay, hx('#3a4a2c'))
        for y in range(ay - 4, ay + 1): props.put(cx + 4, y, hx('#3a4a2c'))
        by = base - h // 3
        for dx in range(-3, 0): props.put(cx + dx, by, hx('#2a3620'))
        for y in range(by - 3, by + 1): props.put(cx - 3, y, hx('#2a3620'))
    for _ in range(4):
        rx = int(rng.integers(4, W - 4)); ry = int(near[rx])
        for dx in range(-2, 3): props.put(rx + dx, ry, hx('#4a2a20')); props.put(rx + dx, ry - (1 if abs(dx) < 2 else 0), hx('#6e3d2b'))
    layers.append(props)
    return save('dunes', layers,
                dict(horizon=HZ, sun=sun, far_dune_tops=np.round(tops[0]).astype(int).tolist(), middle_dune_tops=np.round(tops[1]).astype(int).tolist(), near_dune_tops=np.round(tops[2]).astype(int).tolist(),
                     roles={'sky': ['sky', 'wisps', 'stars'], 'sun': ['sun'], 'land': ['far-dunes', 'middle-dunes', 'near-dune', 'cacti-and-rocks']}),
                'The sun layer moves down in code on a long hold; flowers grow from near_dune_tops; sand ribbons lift from middle_dune_tops; birds cross in front of the sun.')


# ───────────────────────── Sea, coast at night ─────────────────────────
def sea(rng):
    HZ = 58
    sky = Layer('sky')
    gradient_sky(sky, ['#060a20', '#0a0f2b', '#0f1636', '#151d42', '#1c254d', '#242c57', '#2e355f', '#3b3f66'], 0, HZ)
    moon = dict(x=int(rng.integers(22, 52)), y=int(rng.integers(12, 18)), r=6)
    ml = moon_layer(moon['x'], moon['y'], moon['r'], hx('#f4f0dc'), hx('#c9c3ad'), hx('#b4ae98'), hx('#8f9ac8'))
    st = stars_layer(rng, 70, 44, hx('#eef0ff'), mask=lambda x, y: math.hypot(x - moon['x'], y - moon['y']) > 12 and x < W - 26)
    isl = Layer('islands')
    for cx, w, h in ((int(rng.integers(8, 30)), 18, 3), (int(rng.integers(44, 66)), 10, 2)):
        for dx in range(-w // 2, w // 2 + 1):
            hh = int(h * (1 - (2 * dx / w) ** 2) + 0.5)
            for y in range(HZ - hh, HZ): isl.put(cx + dx, y, hx('#141a3a'))
    water = Layer('sea')
    for y in range(HZ, H):
        k = (y - HZ) / (H - HZ)
        for x in range(W): water.put(x, y, hx('#0a1230') * (1 - 0.3 * k) + hx('#13204a') * 0.3 * k)
    for x in range(W): water.put(x, HZ, hx('#2a3466'))
    cliff = Layer('cliff')
    cx0 = W - 40
    top = [H] * W
    for x in range(cx0, W):
        t = 46 - (x - cx0) * 0.12 + 1.3 * math.sin(x * 0.45) if x > cx0 + 4 else 46 + (cx0 + 4 - x) * 3.2
        top[x] = int(round(t))
        for y in range(max(0, top[x]), H):
            strata = (y + int(2 * math.sin(x * 0.3))) % 5 == 0
            lit = x < cx0 + 14
            c = hx('#2a2440') if strata else (hx('#221d36') if lit else hx('#181428'))
            cliff.put(x, y, c)
        if x > cx0 + 4:
            cliff.put(x, top[x], hx('#2c3a2c')); cliff.put(x, top[x] - (1 if (x * 7) % 3 == 0 else 0), hx('#3a4a34'))
    lamp = dict(x=W - 15, y=24)
    tower = Layer('lighthouse')
    lx, ly = lamp['x'], lamp['y']
    base_y = top[lx]
    for y in range(ly + 4, base_y):
        w = 2 + (y - ly) // 8
        band = ((y - ly) // 5) % 2
        for dx in range(-w, w + 1):
            c = (hx('#b04a3f') if dx < 1 else hx('#7e3530')) if band else (hx('#ece5d4') if dx < 1 else hx('#b9b1a2'))
            tower.put(lx + dx, y, c)
    for dx in range(-4, 5): tower.put(lx + dx, ly + 3, hx('#2a2440'))  # gallery
    for dx in range(-4, 5, 2): tower.put(lx + dx, ly + 2, hx('#2a2440'))  # railing
    for dx in range(-2, 3):
        for y in (ly - 1, ly, ly + 1): tower.put(lx + dx, y, hx('#ffe9a8') if abs(dx) < 2 else hx('#2a2440'))  # lantern room
    for dx in range(-2, 3): tower.put(lx + dx, ly - 2, hx('#7e3530'))
    tower.put(lx, ly - 3, hx('#7e3530'))
    for y in range(base_y - 3, base_y): tower.put(lx, y, hx('#24170f'))  # door
    hx0 = lx - 12  # keeper's cottage
    for y in range(base_y - 5, base_y):
        for x in range(hx0 - 4, hx0 + 5): tower.put(x, y, hx('#d9d1bf') if x < hx0 + 1 else hx('#aaa293'))
    for j in range(4):
        for x in range(hx0 - 5 + j, hx0 + 6 - j): tower.put(x, base_y - 6 - j, hx('#7e3530'))
    tower.put(hx0 - 2, base_y - 3, hx('#ffd27a')); tower.put(hx0 - 1, base_y - 3, hx('#ffd27a'))
    rocks = Layer('rocks')
    for rx in range(cx0 - 6, cx0 + 8, 4):
        for dx in range(-3, 4):
            for dy in range(0, 3 - abs(dx) // 2):
                rocks.put(rx + dx, H - 1 - dy - (cx0 + 8 - rx) // 6, hx('#1d1930') if dx > 0 else hx('#2a2440'))
    return save('sea', [sky, st, ml, isl, water, cliff, tower, rocks],
                dict(horizon=HZ, moon=moon, lamp=lamp, cliff_tops=top, roles={'sky': ['sky', 'stars', 'moon', 'islands'], 'water': ['sea'], 'front': ['cliff', 'lighthouse', 'rocks']}),
                'Beams sweep from the lamp between the sky and the cliff; crests, the moon path, foam and glints are drawn live over the sea; the sailboat crosses just under the horizon.')


if __name__ == '__main__':
    flats = []
    for name, fn in (('lake', lake), ('peaks', peaks), ('dunes', dunes), ('sea', sea)):
        flats.append(fn(np.random.default_rng(SEEDS[name])))
    JSON.write_text(json.dumps({'$comment': 'Written by scripts/paint-landscapes.py: each landscape\'s layers (public/media/piano/landscapes/<id>/, bottom to top) and the points its reactions attach to, in the screen\'s 128x95 pixels.', 'size': [W, H], **ALL}, indent=1) + '\n')
    sheet = Image.new('RGBA', (W * 5 * 2 + 10, H * 5 * 2 + 10), (17, 17, 17, 255))
    for i, f in enumerate(flats):
        sheet.alpha_composite(f.resize((W * 5, H * 5), Image.NEAREST), ((i % 2) * (W * 5 + 10), (i // 2) * (H * 5 + 10)))
    sheet.save(PREVIEWS / 'all-landscapes.png')
    print('painted', ', '.join(f'{k}: {len(v["layers"])} layers' for k, v in ALL.items()))
