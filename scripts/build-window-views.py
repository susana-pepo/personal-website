"""Build the views through the window for each time of day (dawn, midday, night).

Usage: python3 scripts/build-window-views.py [dawn midday night] [--detect-only]   (or: npm run scene:windows)\n       --detect-only re-runs only the tower/window detection on the finished loops.
Requires Pillow and numpy. Reads the animated sources in
portfolio-website-assets/public/media/window-views/<time>-source.webp and writes:

  public/media/scene/window-views/<time>-loop.webp    seamless animated loop
  public/media/scene/window-views/<time>-still.webp   its first frame (poster)
  src/scene/window-views.json                         where to draw them, plus the
                                                      tower lights, lit city windows and
                                                      facade colour found in each view

Each source shows the same window, framed a little differently, with its own wooden
bars. For each time:

1. Fit. The bars are found by colour in the painting (room.webp drawn at media.frame
   on the 1920x1080 canvas) and in the source's temporal median, as centre lines:
   the three plain mullions, the seam between the two sashes, the slanted top
   transoms and the middle transoms of both sashes. A scale + offset (separate for
   x and y) maps the source onto the canvas with the least squared distance between
   matching centre lines; the residuals are printed (canvas px).
2. Bars out. A static mask covers the source's bars, the handles, the shaded sides
   and the sill. The sill is replaced by a mirror of the view just above it; every
   other masked pixel is filled per frame from the surrounding outdoor pixels (a
   pull-push fill). Those fills sit under the painted bars, which are drawn on top.
3. Loop. Only the glass's bounding box is kept, at 1 px per canvas px, together with
   view-mask.png: the painting's exact glass over that box (glass-mask.png, made for
   the rain, is inset from the bars and its sill is level, while the painted sill
   slopes). The loop is a ping-pong: a stretch of the source plays forward, eases to a
   stop, and plays back (pingpong), so there is no seam at all. Shimmer is calmed with
   a temporal blur that is stronger where little moves. Loops are 15 fps; one that
   would exceed MAX_BYTES is re-encoded at a lower quality.
4. Detection, on the finished loop: the TV tower's antenna tip (or, at night, the top
   of its chain of painted red lights), steadily lit windows on darker walls clear of
   moving leaves, and the wall colour around them.
"""
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT / 'portfolio-website-assets/public/media/window-views'
OUT_DIR = ROOT / 'public/media/scene/window-views'
JSON_OUT = ROOT / 'src/scene/window-views.json'
LAYOUT = ROOT / 'src/scene/scene-layout.json'
GLASS_MASK = ROOT / 'public/media/scene/window/glass-mask.png'
PUBLIC_PREFIX = '/media/scene/window-views'

TIMES = ('dawn', 'midday', 'night')
DEFAULT_TIME = 'dawn'

MARGIN = 8          # canvas px kept around the glass's bounding box
SCALE = 1.0         # output px per canvas px
PAD = 96            # source px mirrored around each frame, so the fit can reach past its edges
# The loop runs forward, eases to a stop, then runs backward through the same frames
# (a ping-pong), so clouds and leaves never jump at a seam. Speed is in source frames
# per output frame: the output is 15 fps, the source 30, so 1.0 is half natural speed
# (slow, drifting clouds). Fewer source frames are used (PING_MAX), so a cycle stays
# about as long, and the file about as big, as at the old 1.6.
PING_SPEED = 1.0
PING_EASE = 14      # output frames over which each turnaround slows to a stop (and picks up again)
PING_MAX = 96       # source frames used at most (from the middle of the source)
PING_TRIM = 4       # source frames skipped at each end of the source
# Per view: midday's clouds are big and bright, so the same speed reads faster than at dawn
# or night. It runs at 0.3x natural speed over fewer source frames (same cycle length and
# file size as the others).
PING_BY_TIME = {'midday': {'speed': 0.6, 'max': 58}}
OUT_FRAME_MS = 66   # 15 fps
MAX_BYTES = 3.2e6   # per loop; beyond this the loop is re-encoded at a lower quality
ENCODINGS = (80, 76, 72)
SOURCE_FRAME_MS = 33

# Extra source px masked around each bar, beyond its detected wood: the bars are
# shaded on their right and lower sides.
BAR_PAD = {'left': 4, 'right': 10, 'top': 4, 'bottom': 10}
SEAM_PAD = {'left': 5, 'right': 18}
SILL_BEVEL = 18     # source px above the sill's wood: its lit bevel and shadow
EDGE_STRETCH = 44   # source px the leftmost pane is widened by, to reach the painted frame


# ---------------------------------------------------------------- bar detection

def painted_wood(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    return (r > 90) & (g < 0.62 * r) & (b < 0.38 * r)


def source_wood(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    return (r > 70) & (g < 0.42 * r) & (b < 0.2 * r + 4)


def robust_line(a, b):
    """Fit b = p[1] + p[0] * a, rejecting outliers."""
    keep = np.ones(len(a), bool)
    for _ in range(4):
        p = np.polyfit(a[keep], b[keep], 1)
        res = b - np.polyval(p, a)
        s = max(1.0, 2.5 * float(np.median(np.abs(res[keep]))))
        keep = np.abs(res) < 2 * s
    return p


def runs(W, centre_fn, positions, axis, half=40):
    """For each position along a bar, the wood run nearest the expected centre: (pos, start, end)."""
    out = []
    for p in positions:
        c0 = int(round(centre_fn(p)))
        line = W[p, max(0, c0 - half):c0 + half + 1] if axis == 'v' else W[max(0, c0 - half):c0 + half + 1, p]
        base = max(0, c0 - half)
        idx = np.nonzero(line)[0]
        if len(idx) == 0:
            continue
        c = idx[np.argmin(np.abs(idx + base - c0))]
        if abs(c + base - c0) > 20:
            continue
        s = c
        while s - 1 >= 0 and line[s - 1]:
            s -= 1
        e = c
        while e + 1 < len(line) and line[e + 1]:
            e += 1
        out.append((p, s + base, e + base))
    d = np.array(out, float)
    w = d[:, 2] - d[:, 1]
    med = np.median(w)
    return d[np.abs(w - med) < max(3, 0.25 * med)]


def column_runs(profile, thresh=0.5, min_width=8, merge_gap=10):
    """Runs of columns (or rows) where the wood fraction is high: [(start, end)]."""
    on = profile > thresh
    out = []
    i = 0
    while i < len(on):
        if on[i]:
            j = i
            while j + 1 < len(on) and on[j + 1]:
                j += 1
            out.append([i, j])
            i = j + 1
        else:
            i += 1
    merged = []
    for r in out:
        if merged and r[0] - merged[-1][1] <= merge_gap:
            merged[-1][1] = r[1]
        else:
            merged.append(r)
    return [tuple(r) for r in merged if r[1] - r[0] + 1 >= min_width]


def find_bars(W, painted):
    """Centre lines (and edges) of the window's bars.

    Vertical bars: x = p[1] + p[0] * y. Horizontal bars: y = p[1] + p[0] * x.
    Returns {name: {'centre': p, 'start': p, 'end': p, 'span': (a, b)}} for
    V1, V2, V3 (mullions), C (the seam between the sashes, with the outer edges of
    both stiles as start/end), TL, TR (top transoms), ML, MR (middle transoms), and
    for sources S (the top edge of the sill).
    """
    H, Wd = W.shape
    # Rows between the top and middle transoms, to find the vertical bars.
    if painted:
        band = (130, 385)
    else:
        rows = W[:, int(0.09 * Wd):int(0.26 * Wd)].mean(1)  # between the first two mullions
        hr = column_runs(rows, 0.5, 8, 4)
        top = [r for r in hr if r[0] < H * 0.35]
        mid = [r for r in hr if H * 0.45 < r[0] < H * 0.75]
        band = (top[0][1] + 30, mid[0][0] - 30)
    prof = W[band[0]:band[1]].mean(0)
    vr = column_runs(prof, 0.5, 8, 12)
    if painted:
        vr = [r for r in vr if 960 < r[0] < 1700]
    assert len(vr) == 4, f'expected 4 vertical bars, found {vr}'
    widths = [r[1] - r[0] for r in vr]
    ci = int(np.argmax(widths))
    bars = {}
    names = ['V1', 'V2', 'V3']
    k = 0
    ys = np.arange(band[0], band[1])
    for i, (a, b) in enumerate(vr):
        if i == ci:
            # The seam: the least woody column inside the central mullion.
            inner = prof[a + 12:b - 12]
            seam = a + 12 + int(np.argmin(inner))
            seam_cols = np.nonzero(inner < inner.min() + 0.15)[0] + a + 12
            seam = float(np.mean(seam_cols[np.abs(seam_cols - seam) < 4]))
            d_left = runs(W, lambda y, x=(a + seam) / 2: x, ys, 'v', half=int((seam - a) / 2) + 6)
            d_right = runs(W, lambda y, x=(seam + b) / 2: x, ys, 'v', half=int((b - seam) / 2) + 6)
            bars['C'] = {
                'centre': np.array([0.0, seam]),
                'start': robust_line(d_left[:, 0], d_left[:, 1]),
                'end': robust_line(d_right[:, 0], d_right[:, 2]),
                'span': (0, H),
            }
        else:
            d = runs(W, lambda y, x=(a + b) / 2: x, ys, 'v')
            ps, pe = robust_line(d[:, 0], d[:, 1]), robust_line(d[:, 0], d[:, 2])
            bars[names[k]] = {'centre': (ps + pe) / 2, 'start': ps, 'end': pe, 'span': (0, H)}
            k += 1

    def xat(name, y, key='centre'):
        p = bars[name][key]
        return p[1] + p[0] * y

    ymid = (band[0] + band[1]) / 2
    left_sash = (xat('V1', ymid, 'end') + 6, xat('C', ymid, 'start') - 6)
    right_sash = (xat('C', ymid, 'end') + 6, Wd - 4 if not painted else xat('V3', ymid, 'start') + 150)
    for side, (x0, x1) in (('L', left_sash), ('R', right_sash)):
        x0, x1 = int(x0), int(x1)
        # A narrow column of the sash between two bars gives each transom's height there.
        if side == 'L':
            cx0, cx1 = int(xat('V2', ymid, 'end') + 8), int(xat('C', ymid, 'start') - 8)
        else:
            cx0, cx1 = int(xat('C', ymid, 'end') + 8), int(xat('V3', ymid, 'start') - 8)
        colprof = W[:, cx0:cx1].mean(1)
        hr = column_runs(colprof, 0.5, 6, 4)
        xm = (cx0 + cx1) / 2
        lim = 260 if painted else 0.4 * H
        top = [r for r in hr if r[0] < lim]
        mid = [r for r in hr if (300 < r[0] < 480) if painted] if painted else [r for r in hr if 0.5 * H < r[0] < 0.75 * H]
        for tag, rr, slope in (('T', top[-1], -0.054), ('M', mid[0], 0.0)):
            yc = (rr[0] + rr[1]) / 2
            fn = lambda x, yc=yc, slope=slope: yc + slope * (x - xm)
            span = range(x0 + 4, x1 - 4)
            # Skip the columns where a vertical bar crosses.
            d = runs(W, fn, span, 'h')
            keep = np.ones(len(d), bool)
            for n in ('V1', 'V2', 'V3'):
                xb0, xb1 = xat(n, yc, 'start'), xat(n, yc, 'end')
                keep &= ~((d[:, 0] > xb0 - 12) & (d[:, 0] < xb1 + 12))
            d = d[keep]
            ps, pe = robust_line(d[:, 0], d[:, 1]), robust_line(d[:, 0], d[:, 2])
            bars[tag + side] = {'centre': (ps + pe) / 2, 'start': ps, 'end': pe, 'span': (x0 - 10, x1 + 10)}
    if not painted:
        # Sill: the top edge of the wood along the bottom, wherever it is in the picture.
        d = runs(W, lambda x: H - 20, range(140, Wd - 140), 'h', half=60)
        d = d[d[:, 1] > H - 80]
        keep = np.ones(len(d), bool)
        for n in ('V1', 'V2', 'V3'):
            keep &= ~((d[:, 0] > xat(n, H, 'start') - 12) & (d[:, 0] < xat(n, H, 'end') + 12))
        keep &= ~((d[:, 0] > xat('C', H, 'start') - 12) & (d[:, 0] < xat('C', H, 'end') + 12))
        d = d[keep]
        p = robust_line(d[:, 0], d[:, 1])
        bars['S'] = {'centre': p, 'start': p, 'end': np.array([0.0, H + 100]), 'span': (0, Wd)}
    return bars


# ---------------------------------------------------------------- fitting

VERTICAL = ('V1', 'V2', 'C', 'V3')
HORIZONTAL = ('TL', 'TR', 'ML', 'MR')


def fit(src, dst, src_shape):
    """Scale + offset, separately in x and y, mapping source centre lines onto painted ones."""
    H, W = src_shape
    sx, tx, sy, ty = 0.55, 920.0, 0.55, -15.0
    for _ in range(8):
        A, B = [], []
        for n in VERTICAL:
            ys = np.linspace(260, 0.6 * H, 24)
            xs = np.polyval(src[n]['centre'], ys)
            xp = np.polyval(dst[n]['centre'], sy * ys + ty)
            A += [[x, 1] for x in xs]
            B += list(xp)
        sx, tx = np.linalg.lstsq(np.array(A), np.array(B), rcond=None)[0]
        A, B = [], []
        for n in HORIZONTAL:
            a, b = src[n]['span']
            xs = np.linspace(a + 20, b - 20, 24)
            ys = np.polyval(src[n]['centre'], xs)
            yp = np.polyval(dst[n]['centre'], sx * xs + tx)
            A += [[y, 1] for y in ys]
            B += list(yp)
        sy, ty = np.linalg.lstsq(np.array(A), np.array(B), rcond=None)[0]
    errors = {}
    for n in VERTICAL:
        ys = np.linspace(260, 0.6 * H, 24)
        e = sx * np.polyval(src[n]['centre'], ys) + tx - np.polyval(dst[n]['centre'], sy * ys + ty)
        errors[n] = e
    for n in HORIZONTAL:
        a, b = src[n]['span']
        xs = np.linspace(a + 20, b - 20, 24)
        e = sy * np.polyval(src[n]['centre'], xs) + ty - np.polyval(dst[n]['centre'], sx * xs + tx)
        errors[n] = e
    allerr = np.concatenate(list(errors.values()))
    report = {
        'rms': round(float(np.sqrt(np.mean(allerr ** 2))), 2),
        'max': round(float(np.max(np.abs(allerr))), 2),
        'perBar': {n: round(float(np.mean(e)), 2) for n, e in errors.items()},
    }
    return (float(sx), float(tx), float(sy), float(ty)), report


# ---------------------------------------------------------------- masks and fills

def bar_mask(bars, shape):
    """Source px covered by bars, handles, shading or sill (True)."""
    H, W = shape
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    m = np.zeros(shape, bool)
    for n in ('V1', 'V2', 'V3'):
        b = bars[n]
        m |= (xx >= np.polyval(b['start'], yy) - BAR_PAD['left']) & (xx <= np.polyval(b['end'], yy) + BAR_PAD['right'])
    b = bars['C']
    m |= (xx >= np.polyval(b['start'], yy) - SEAM_PAD['left']) & (xx <= np.polyval(b['end'], yy) + SEAM_PAD['right'])
    for n in ('TL', 'TR', 'ML', 'MR'):
        b = bars[n]
        a0, a1 = b['span']
        m |= (yy >= np.polyval(b['start'], xx) - BAR_PAD['top']) & (yy <= np.polyval(b['end'], xx) + BAR_PAD['bottom']) & (xx >= a0) & (xx <= a1)
    return m


def padded_index(bars, shape):
    """Row and column to read for every px of the padded frame (PAD px larger on each side).

    Edges of the picture are mirrored; from just above the sill (its wood and lit
    bevel) downwards, the view above the sill is mirrored instead, as far as needed.
    """
    H, W = shape
    cols = np.arange(-PAD, W + PAD).astype(np.float64)
    # The source's leftmost pane stops short of the painted glass: stretch that narrow
    # pane (from its bar to the picture's edge) instead of mirroring it, which would
    # show the tree trunk folded on itself. The kink sits under the bar. On the right
    # only a sliver of sky and leaves is missing, and that is mirrored, so the tower
    # in that pane stays where it is.
    left = float(np.polyval(bars['V1']['start'], H / 2)) - BAR_PAD['left']
    cols = np.where(cols < left, left - (left - cols) * left / (left + EDGE_STRETCH), cols)
    cols = np.abs(cols)
    cols = np.where(cols > W - 1, 2 * (W - 1) - cols, cols)
    edge = np.polyval(bars['S']['centre'], cols) - SILL_BEVEL
    edge = np.clip(edge, H * 0.8, H - 1)
    yy = np.arange(-PAD, H + PAD)[:, None]
    rows = np.where(yy >= edge[None, :], 2 * edge[None, :] - yy, np.abs(yy))
    cols = np.clip(np.round(cols), 0, W - 1)
    return np.clip(np.round(rows), 0, H - 1).astype(np.int32), cols.astype(np.int32)


def _smooth121(a):
    p = np.pad(a, ((1, 1), (1, 1)) + ((0, 0),) * (a.ndim - 2), mode='edge')
    a = (p[:-2] + 2 * p[1:-1] + p[2:]) / 4
    return (a[:, :-2] + 2 * a[:, 1:-1] + a[:, 2:]) / 4


def fill_holes(img, hole):
    """Pull-push fill: every hole pixel gets the colour of its outdoor surroundings."""
    w = (~hole).astype(np.float32)
    P, Wt = img * w[..., None], w
    pyr = []
    while True:
        pyr.append((P, Wt))
        h, wd = Wt.shape
        if min(h, wd) <= 3:
            break
        if h % 2:
            P, Wt = np.concatenate([P, P[-1:]], 0), np.concatenate([Wt, Wt[-1:]], 0)
        if wd % 2:
            P, Wt = np.concatenate([P, P[:, -1:]], 1), np.concatenate([Wt, Wt[:, -1:]], 1)
        h, wd = Wt.shape
        P = P.reshape(h // 2, 2, wd // 2, 2, 3).sum((1, 3))
        Wt = Wt.reshape(h // 2, 2, wd // 2, 2).sum((1, 3))
    P, Wt = pyr[-1]
    C = P / np.maximum(Wt, 1e-6)[..., None]
    for level in range(len(pyr) - 2, -1, -1):
        P, Wt = pyr[level]
        h, wd = Wt.shape
        up = _smooth121(np.repeat(np.repeat(C, 2, 0), 2, 1)[:h, :wd])
        a = np.clip(Wt / (4 ** level), 0, 1)[..., None]
        C = (P / np.maximum(Wt, 1e-6)[..., None]) * a + up * (1 - a)
    return np.where(hole[..., None], C, img)


# ---------------------------------------------------------------- frames

def load_glass():
    a = Image.open(GLASS_MASK).getchannel('A').resize((1920, 1080), Image.BILINEAR)
    return np.asarray(a, np.float32) / 255


def canvas_box(glass):
    ys, xs = np.nonzero(glass > 0.004)
    x0 = max(0, int(xs.min()) - MARGIN)
    y0 = max(0, int(ys.min()) - MARGIN)
    x1 = min(1920, int(xs.max()) + 1 + MARGIN)
    y1 = min(1080, int(ys.max()) + 1 + MARGIN)
    return {'x': x0, 'y': y0, 'width': x1 - x0, 'height': y1 - y0}


def _woodish(px):
    """Painted wood, its shaded sides included: red dominates (the night-blue sky and teal leaves do not)."""
    r, g, b = px[..., 0], px[..., 1], px[..., 2]
    return (r > 40) & (r > np.maximum(g, b) + 8)


def _extent(room, line, positions, side, axis, limit=12):
    """How many px the painted bar reaches past a strict-wood edge line, counting its shaded side.

    Measured only where the outdoor px just beyond is clearly not wood, so the pink
    and orange sky of the painting cannot pass for the bar.
    """
    out = []
    for p in positions:
        e = np.polyval(line, p)
        k = 0
        while k < limit:
            q = int(round(e + side * (k + 1)))
            px = room[p, q] if axis == 'v' else room[q, p]
            if not _woodish(px):
                break
            k += 1
        q = int(round(e + side * (k + 4)))
        beyond = room[p, q] if axis == 'v' else room[q, p]
        if k < limit and not _woodish(beyond):
            out.append(k)
    return float(np.median(out)) if out else 0.0


def painted_glass(room, bars):
    """Exactly where the painting shows glass (1 = glass), from its measured bars and frame.

    The glass-mask.png used for the rain is deliberately inset and its sill is level,
    while the painted sill slopes down to the right; an opaque view needs the real outline.
    """
    H, W = 1080, 1920
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    alpha = np.ones((H, W), np.float32)
    ys = list(range(140, 380, 3)) + list(range(430, 630, 3))
    for n in ('V1', 'V2', 'V3', 'C'):
        b = bars[n]
        el = _extent(room, b['start'], ys, -1, 'v')
        er = _extent(room, b['end'], ys, +1, 'v')
        x0 = np.polyval(b['start'], yy) - el - 0.5
        x1 = np.polyval(b['end'], yy) + er + 0.5
        alpha = np.minimum(alpha, 1 - np.clip(np.minimum(xx - x0, x1 - xx) + 0.5, 0, 1))
    # the frame's outer edges: the curtains (light, warm, and draped, so measured row by row)
    curtain = (room[..., 0] > 200) & (room[..., 1] > 150)
    lefts, rights = np.full(H, np.nan), np.full(H, np.nan)
    for y in range(0, 760):
        idx = np.nonzero(curtain[y, 860:960])[0]
        if len(idx):
            lefts[y] = 860 + idx.max() + 3  # past the frame's thin dark edge
        idx = np.nonzero(curtain[y, 1800:1900])[0]
        if len(idx):
            rights[y] = 1800 + idx.min()  # its first px half covered, so no sky sliver is left
    def smooth_edge(e):
        ok = ~np.isnan(e)
        e = np.interp(np.arange(H), np.nonzero(ok)[0], e[ok])
        p = np.pad(e, 4, mode='edge')
        return np.median(np.stack([p[i:i + H] for i in range(9)]), 0).astype(np.float32)
    left_edge, right_edge = smooth_edge(lefts), smooth_edge(rights)
    alpha = np.minimum(alpha, np.clip(xx - left_edge[:, None] + 0.5, 0, 1))
    alpha = np.minimum(alpha, np.clip(right_edge[:, None] - xx + 0.5, 0, 1))
    pl = np.array([0.0, float(np.median(left_edge[:700]))])
    pr = np.array([0.0, float(np.median(right_edge[:700]))])
    xl, xr = float(np.polyval(pl, 400)), float(np.polyval(pr, 400))
    xc0, xc1 = float(np.polyval(bars['C']['start'], 400)), float(np.polyval(bars['C']['end'], 400))
    for n in ('TL', 'ML', 'TR', 'MR'):
        b = bars[n]
        a0, a1 = (xl - 4, xc0 + 4) if n.endswith('L') else (xc1 - 4, xr + 4)
        xs = [x for x in range(int(a0) + 8, int(a1) - 8, 3)
              if all(not (np.polyval(bars[v]['start'], 300) - 14 < x < np.polyval(bars[v]['end'], 300) + 14) for v in ('V1', 'V2', 'V3'))]
        et = _extent(room, b['start'], xs, -1, 'h')
        eb = _extent(room, b['end'], xs, +1, 'h')
        y0 = np.polyval(b['start'], xx) - et - 0.5
        y1 = np.polyval(b['end'], xx) + eb + 0.5
        inside = np.clip(np.minimum(yy - y0, y1 - yy) + 0.5, 0, 1) * ((xx >= a0) & (xx <= a1))
        alpha = np.minimum(alpha, 1 - inside)
    # the sill: the first wood below the glass, in columns clear of the bars
    pts = []
    for x in range(int(xl) + 6, int(xr) - 6, 3):
        if any(np.polyval(bars[v]['start'], 640) - 14 < x < np.polyval(bars[v]['end'], 640) + 14 for v in ('V1', 'V2', 'V3', 'C')):
            continue
        col = _woodish(room[600:720, x])
        for k in range(len(col) - 4):
            if col[k:k + 4].all():
                pts.append((x, 600 + k))
                break
    ps = robust_line(*np.array(pts, float).T)
    alpha = np.minimum(alpha, np.clip(np.polyval(ps, xx) - yy + 0.5, 0, 1))
    return alpha


def render_room():
    layout = json.loads(LAYOUT.read_text())
    fr = layout['media']['frame']
    room = Image.open(ROOT / 'public' / layout['media']['poster'].lstrip('/')).convert('RGB')
    canvas = Image.new('RGB', (1920, 1080))
    canvas.paste(room.resize((round(fr['width']), round(fr['height'])), Image.LANCZOS), (round(fr['x']), round(fr['y'])))
    return canvas


def source_frames(path):
    im = Image.open(path)
    for i in range(im.n_frames):
        im.seek(i)
        yield np.asarray(im.convert('RGB'))


def temporal_median(path, step=12):
    im = Image.open(path)
    frames = []
    for i in range(0, im.n_frames, step):
        im.seek(i)
        frames.append(np.asarray(im.convert('RGB'), np.float32))
    return np.median(np.stack(frames), 0)


def warp_box(params, box, out_size):
    """Box in the padded source that maps onto the output canvas box."""
    sx, tx, sy, ty = params
    x0 = (box['x'] - tx) / sx + PAD
    x1 = (box['x'] + box['width'] - tx) / sx + PAD
    y0 = (box['y'] - ty) / sy + PAD
    y1 = (box['y'] + box['height'] - ty) / sy + PAD
    return (x0, y0, x1, y1)


def build_frames(path, params, bars, box, out_size, shape):
    H, W = shape
    rows, cols = padded_index(bars, shape)
    cols = cols[None, :]
    hole_pad = bar_mask(bars, shape)[rows, cols].astype(np.float32)  # bars mirrored along with the view
    src_box = warp_box(params, box, out_size)
    assert 0 <= src_box[0] and 0 <= src_box[1] and src_box[2] <= W + 2 * PAD and src_box[3] <= H + 2 * PAD, src_box
    hole = np.asarray(Image.fromarray(hole_pad).resize(out_size, Image.BILINEAR, box=src_box)) > 0.02
    # one more output px of safety around every hole
    hp = np.pad(hole, 1)
    hole = hp[1:-1, 1:-1] | hp[:-2, 1:-1] | hp[2:, 1:-1] | hp[1:-1, :-2] | hp[1:-1, 2:]
    frames = []
    for f in source_frames(path):
        o = np.asarray(Image.fromarray(f[rows, cols]).resize(out_size, Image.LANCZOS, box=src_box), np.float32)
        frames.append(fill_holes(o, hole).astype(np.float32))
    return np.stack(frames), hole


# ---------------------------------------------------------------- loop

def pingpong(frames, speed=PING_SPEED, max_frames=PING_MAX):
    """A seamless cycle that plays a stretch of the source forward and then backward.

    Each half runs at `speed` (PING_SPEED unless the view has its own), easing to a stop over PING_EASE output frames at each
    turnaround (a sine-shaped slowdown, so the clouds settle and drift back rather than
    snapping into reverse). Positions between source frames are blended from their two
    neighbours (clouds and leaves move little from one frame to the next)."""
    n = len(frames)
    L = min(max_frames, n - 2 * PING_TRIM)
    start = (n - L) // 2
    span = L - 1  # source frames travelled in each half
    # speed per output frame over one half: eases in from a stop and out to one
    half = max(2 * PING_EASE + 2, int(round(span / speed + PING_EASE)))
    i = np.arange(half, dtype=np.float64) + 0.5
    ramp = lambda x: np.sin(0.5 * np.pi * np.clip(x / PING_EASE, 0, 1)) ** 2
    speed = np.minimum(ramp(i), ramp(half - i))
    pos = np.concatenate([[0.0], np.cumsum(speed)])[:half]
    pos = pos / (pos[-1] + speed[-1]) * span  # lands exactly on the far end as the next half starts
    cycle = np.concatenate([pos, span - pos])  # there and back: the cycle closes on itself
    out = np.empty((len(cycle),) + frames.shape[1:], np.float32)
    for k, p in enumerate(cycle):
        f = int(np.floor(p))
        t = p - f
        a = frames[start + f]
        out[k] = a if t < 1e-6 or f + 1 > span else a * (1 - t) + frames[start + f + 1] * t
    return out, start, L


def circular_blur(frames, sigma):
    r = int(math.ceil(3 * sigma))
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma) ** 2)
    k /= k.sum()
    out = np.zeros_like(frames)
    n = len(frames)
    for j, kj in enumerate(k):
        out += kj * frames[(np.arange(n) + j - r) % n]
    return out


def calm(frames, strip=48):
    """Temporal blur: gentle where things move (leaves, clouds), stronger where only shimmer moves."""
    n, H, W, _ = frames.shape
    motion = np.zeros((H, W), np.float32)
    for y in range(0, H, strip):
        motion[y:y + strip] = circular_blur(frames[:, y:y + strip], 1.0).mean(-1).std(0)
    small = (max(1, W // 8), max(1, H // 8))
    motion = np.asarray(Image.fromarray(motion).resize(small, Image.BILINEAR).resize((W, H), Image.BILINEAR))
    wheavy = np.clip((6.0 - motion) / 4.0, 0, 1)[None, ..., None]
    out = np.empty_like(frames)
    for y in range(0, H, strip):
        part = frames[:, y:y + strip]
        w = wheavy[:, y:y + strip]
        out[:, y:y + strip] = circular_blur(part, 1.0) * (1 - w) + circular_blur(part, 4.0) * w
    return out


# ---------------------------------------------------------------- detection

def oklch(rgb):
    def lin(c):
        c = c / 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (lin(float(c)) for c in rgb)
    l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
    m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
    s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
    l, m, s = np.cbrt(l), np.cbrt(m), np.cbrt(s)
    L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s
    A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s
    B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
    C = math.hypot(A, B)
    h = math.degrees(math.atan2(B, A)) % 360
    return f'oklch({L * 100:.1f}% {C:.3f} {h:.0f})'


def components(mask):
    """4-connected components of a small boolean mask: list of (ys, xs)."""
    H, W = mask.shape
    seen = np.zeros_like(mask)
    out = []
    for y0, x0 in zip(*np.nonzero(mask)):
        if seen[y0, x0]:
            continue
        stack = [(y0, x0)]
        seen[y0, x0] = True
        ys, xs = [], []
        while stack:
            y, x = stack.pop()
            ys.append(y)
            xs.append(x)
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                v, u = y + dy, x + dx
                if 0 <= v < H and 0 <= u < W and mask[v, u] and not seen[v, u]:
                    seen[v, u] = True
                    stack.append((v, u))
        out.append((np.array(ys), np.array(xs)))
    return out


def find_tower(mean, box):
    """The TV tower: x of its mast, y of the antenna tip and of the top of the sphere (canvas px)."""
    bx, by = box['x'], box['y']
    # the right-hand pane, above the skyline
    x0, x1, y0, y1 = 1690 - bx, 1800 - bx, 120 - by, 340 - by
    lum = mean[y0:y1, x0:x1].mean(-1)
    dev = np.abs(lum - np.median(lum, 1, keepdims=True))  # the sky changes slowly along a row
    col = int(np.argmax((dev > 14).sum(0)))  # the mast: the most consistently different column
    p = dev[:, max(0, col - 2):col + 3].max(1)
    ref = np.concatenate([dev[:, max(0, col - 28):max(0, col - 12)], dev[:, col + 12:col + 28]], 1)
    noise = np.percentile(ref, 95, axis=1)
    strong = p > np.maximum(8, noise + 4)
    faint = p > np.maximum(3.5, noise + 1.5)
    # the tip: the first clearly visible mast pixel with mast continuing below it
    tip = next(y for y in range(len(p) - 16) if strong[y] and faint[y:y + 16].mean() > 0.6)
    # against a dark sky the painted aviation lights mark the mast best
    reg = mean[y0:y1, x0:x1]
    r, g, b = reg[..., 0], reg[..., 1], reg[..., 2]
    if np.median(lum) < 80:
        red = (r - np.median(r, 1, keepdims=True) > 35) & (r > g + 8) & (g < 0.9 * r) & (reg.max(-1) < 200)
        red[:, :max(0, col - 6)] = False
        red[:, col + 7:] = False
        rows = np.nonzero(red.any(1))[0]
        # the top light of a chain of lights down the mast (not the moon, not a star)
        chain = [y for y in rows if ((rows > y + 6) & (rows < y + 70)).sum() >= 3]
        if chain:
            tip = int(chain[0])
            col = int(round(np.mean(np.nonzero(red[tip:tip + 3].any(0))[0])))
    width = (dev[:, max(0, col - 25):col + 26] > 20).sum(1)
    sphere = next(y for y in range(tip + 30, len(width)) if width[y] >= 8)
    w = dev[tip:tip + 30, max(0, col - 2):col + 3].sum(0) + 1e-3
    cx = float(np.average(np.arange(max(0, col - 2), max(0, col - 2) + len(w)), weights=w))
    return cx + x0 + bx, tip + y0 + by, sphere + y0 + by


def find_city_windows(mean, low, motion, glass, box, tower_x, count=8):
    """Steadily lit windows across the street, panes side by side grouped, in canvas px."""
    bx, by = box['x'], box['y']
    H, W = mean.shape[:2]
    r, g, b = low[..., 0], low[..., 1], low[..., 2]
    lit = (r > 185) & (g > 0.72 * r) & (b < 0.62 * g)  # warm lamplight, not the orange sky
    g_box = glass[by:by + H, bx:bx + W]
    lit &= g_box > 0.99
    # not the lit ring of the tower's sphere
    tx = int(tower_x - bx)
    lit[:330 - by, max(0, tx - 30):tx + 30] = False
    boxes = sorted([xs.min(), ys.min(), xs.max() + 1, ys.max() + 1] for ys, xs in components(lit) if len(ys) >= 6)
    merged = []
    for bb in boxes:
        for m in merged:
            if bb[0] - m[2] <= 10 and min(bb[3], m[3]) - max(bb[1], m[1]) > 0.5 * (bb[3] - bb[1]) and bb[2] - m[0] < 40:
                m[:] = [min(m[0], bb[0]), min(m[1], bb[1]), max(m[2], bb[2]), max(m[3], bb[3])]
                break
        else:
            merged.append(list(bb))
    cand = []
    for x0, y0, x1, y1 in merged:
        w, h = x1 - x0, y1 - y0
        if w < 8 or h < 4 or w > 40 or h > 18:
            continue
        Y0, Y1, X0, X1 = max(0, y0 - 2), y1 + 2, max(0, x0 - 2), x1 + 2
        if g_box[Y0:Y1, X0:X1].min() < 0.95:  # the cover sits wholly on glass
            continue
        if motion[Y0:Y1, X0:X1].max() > 7:  # leaves move in front of it
            continue
        # the wall: a ring a few px out from the window
        ring = np.ones((y1 - y0 + 18, x1 - x0 + 18), bool)
        ring[6:-6, 6:-6] = False
        patch = mean[max(0, y0 - 9):y1 + 9, max(0, x0 - 9):x1 + 9]
        if patch.shape[:2] != ring.shape:
            continue
        wall = patch[ring]
        lit_level = np.median(mean[y0:y1, x0:x1][lit[y0:y1, x0:x1]].mean(1))
        wall = wall[wall.mean(1) < 0.5 * lit_level]
        if len(wall) < 0.6 * ring.sum():  # a lit window on a darker wall, not a glow in the sky
            continue
        cand.append((w * h, x0, y0, w, h, np.median(wall, 0)))
    cand.sort(key=lambda c: -c[0])
    chosen = []
    for _, x0, y0, w, h, wall in cand:
        if any(abs(x0 + w / 2 - (c[0] + c[2] / 2)) < 36 and abs(y0 - c[1]) < 20 for c in chosen):
            continue
        chosen.append((x0, y0, w, h, wall))
        if len(chosen) == count:
            break
    # The bright test above finds only the brightest upper panes; the cover must hide the
    # whole lit window, its dimmer lower panes and sill glow too. Grow each box over the
    # warm light connected to it (a looser test), then pad, a little more at the bottom.
    loose = (r > 120) & (g > 0.5 * r) & (b < 0.7 * g) & (g_box > 0.95)
    out = []
    for x0, y0, w, h, wall in sorted(chosen, key=lambda c: c[0]):
        x1, y1 = x0 + w, y0 + h
        Y0, Y1, X0, X1 = max(0, y0 - 4), min(H, y1 + 8), max(0, x0 - 4), min(W, x1 + 4)
        sub = loose[Y0:Y1, X0:X1]
        for ys, xs in components(sub):
            ys, xs = ys + Y0, xs + X0
            if ((ys >= y0) & (ys < y1) & (xs >= x0) & (xs < x1)).any():
                x0, y0, x1, y1 = min(x0, xs.min()), min(y0, ys.min()), max(x1, xs.max() + 1), max(y1, ys.max() + 1)
        top, side, bottom = 2, 2, 3
        out.append({'x': int(x0 - side + bx), 'y': int(y0 - top + by), 'w': int(x1 - x0 + 2 * side),
                    'h': int(y1 - y0 + top + bottom), 'facade': wall})
    return out


def detect(time, glass, box):
    """Tower lights, lit windows and facade colour, found in the finished loop."""
    im = Image.open(OUT_DIR / f'{time}-loop.webp')
    frames = []
    for i in range(im.n_frames):
        im.seek(i)
        frames.append(np.asarray(im.convert('RGB'), np.float32))
    frames = np.stack(frames)
    if SCALE != 1:
        raise NotImplementedError('detection assumes 1 output px per canvas px')
    mean, low = frames.mean(0), frames.min(0)
    motion = frames.mean(-1).std(0)
    del frames
    mx, tip, sphere = find_tower(mean, box)
    if time == 'midday':
        # daylight: the aviation light barely shows
        lights = [{'x': round(mx), 'y': round(tip), 'size': 20, 'strength': 0.25}]
    else:
        lights = [
            {'x': round(mx), 'y': round(tip), 'size': 30, 'strength': 1},
            {'x': round(mx), 'y': round(tip + 0.45 * (sphere - tip)), 'size': 22, 'strength': 0.6},
        ]
    windows = [] if time == 'midday' else find_city_windows(mean, low, motion, glass, box, mx)
    facade = None
    if windows:
        facade = oklch(np.median(np.stack([w['facade'] for w in windows]), 0))
        for w in windows:
            w['facade'] = oklch(w['facade'])
    print(f'{time}: tower mast x {mx:.0f}, tip y {tip}, sphere top y {sphere}; {len(windows)} city windows; facade {facade}')
    return {'towerLights': lights, 'cityWindows': windows, 'facade': facade}


# ---------------------------------------------------------------- main

def save_webp(frames_u8, path, duration, quality):
    ims = [Image.fromarray(f) for f in frames_u8]
    ims[0].save(path, save_all=True, append_images=ims[1:], duration=duration, loop=0,
                quality=quality, method=6, exact=True, minimize_size=True)


def build(time, painted, glass, box, out_size):
    path = SRC_DIR / f'{time}-source.webp'
    med = temporal_median(path)
    shape = med.shape[:2]
    bars = find_bars(source_wood(med), painted=False)
    params, report = fit(bars, painted, shape)
    sx, tx, sy, ty = params
    print(f'{time}: x = {sx:.4f} * xs + {tx:.1f}, y = {sy:.4f} * ys + {ty:.1f}; '
          f'bar fit rms {report["rms"]} px, max {report["max"]} px, per bar {report["perBar"]}')
    frames, hole = build_frames(path, params, bars, box, out_size, shape)
    ping = PING_BY_TIME.get(time, {})
    loop, start, L = pingpong(frames, ping.get('speed', PING_SPEED), ping.get('max', PING_MAX))
    del frames  # the source frames are large; only the cycle is needed from here
    print(f'{time}: ping-pong over source frames {start}..{start + L - 1} ({L} frames), '
          f'{len(loop)} output frames x {OUT_FRAME_MS} ms = {len(loop) * OUT_FRAME_MS / 1000:.1f} s per cycle')
    loop = np.clip(np.round(calm(loop)), 0, 255).astype(np.uint8)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    anim = OUT_DIR / f'{time}-loop.webp'
    still = OUT_DIR / f'{time}-still.webp'
    tmp = OUT_DIR / f'.{time}-loop.tmp.webp'  # written aside, then swapped in: the live file is never half-written
    for quality in ENCODINGS:
        save_webp(loop, tmp, OUT_FRAME_MS, quality)
        size = tmp.stat().st_size
        print(f'{time}: {anim.name} {size / 1e6:.2f} MB ({len(loop)} frames x {OUT_FRAME_MS} ms, quality {quality})')
        if size <= MAX_BYTES:
            break
    tmp.replace(anim)
    kept = loop
    duration = OUT_FRAME_MS
    Image.fromarray(kept[0]).save(still, quality=82, method=6, exact=True)
    print(f'{time}: {still.name} {still.stat().st_size / 1e3:.0f} kB')
    return {
        'animated': f'{PUBLIC_PREFIX}/{anim.name}',
        'still': f'{PUBLIC_PREFIX}/{still.name}',
        'frameMs': duration,
        'frames': len(kept),
        'fit': {'scaleX': round(sx, 5), 'offsetX': round(tx, 2), 'scaleY': round(sy, 5), 'offsetY': round(ty, 2),
                'rmsPx': report['rms'], 'maxPx': report['max']},
    }


def main(times, detect_only=False):
    room = np.asarray(render_room(), np.float32)
    painted = find_bars(painted_wood(room), painted=True)
    glass = painted_glass(room, painted)
    box = canvas_box(np.maximum(glass, load_glass()))
    out_size = (round(box['width'] * SCALE), round(box['height'] * SCALE))
    print('canvas box', box, 'output', out_size)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    a = (glass[box['y']:box['y'] + box['height'], box['x']:box['x'] + box['width']] * 255).round().astype(np.uint8)
    white = np.full_like(a, 255)
    mask_img = Image.fromarray(np.dstack([white, white, white, a]), 'RGBA')
    if SCALE != 1:
        mask_img = mask_img.resize(out_size, Image.LANCZOS)
    mask_img.save(OUT_DIR / 'view-mask.png', optimize=True)
    existing = json.loads(JSON_OUT.read_text()) if JSON_OUT.exists() else {}
    data = {
        '$comment': 'Views through the window for each time of day, built by scripts/build-window-views.py. '
                    'canvasBox: where the animated view and its still are drawn on the 1920x1080 canvas '
                    '(the glass mask decides what shows). mask: the painting\'s exact glass over that box (white, alpha = glass; '
                    'glass-mask.png is inset and its sill level, so it would leave painted sky beside the bars and under the new view). Per time: towerLights = the TV tower\'s aviation lights '
                    '(x, y, size in canvas px; strength 0-1), cityWindows = lit windows suited to brief lights-off '
                    'covers (canvas px; facade = the wall colour around each), facade = their typical wall colour. '
                    'fit = how the source was scaled onto the canvas and how far its bars landed from the painted ones.',
        'default': DEFAULT_TIME,
        'canvasBox': box,
        'mask': f'{PUBLIC_PREFIX}/view-mask.png',
    }
    for t in TIMES:
        entry = dict(existing.get(t, {}))
        if t in times:
            if not detect_only:
                entry.update(build(t, painted, glass, box, out_size))
            entry.update(detect(t, glass, box))
        if entry:
            data[t] = entry
    JSON_OUT.write_text(json.dumps(data, indent=2) + '\n')
    print('wrote', JSON_OUT.relative_to(ROOT))


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if a in TIMES]
    main(args or list(TIMES), detect_only='--detect-only' in sys.argv)
