"""Build the window's rain layers: a mask of the glass panes and two rain textures.

Usage: python3 scripts/build-window-layers.py      (or: npm run scene:window)
Requires Pillow. Writes public/media/scene/window/:

  glass-mask.png   white where there is glass (outside the room), transparent on the
                   window frame and the curtains. The lamp and the vase are overlays
                   drawn above the rain, so they cover it themselves (and the rain
                   shows faintly through the clear vase, as through real glass).
  rain-near.svg    a tile of fine, slightly slanted streaks (closer, brighter)
  rain-far.svg     a tile of shorter, fainter streaks (further away)

Geometry is in the 1920x1080 canvas, measured from the painting.
"""
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public/media/scene/window'
SCALE = 0.5  # mask resolution relative to the canvas

# Glass panes: x ranges of each column of glass, then rows split by the transoms.
LEFT_COLUMNS = [(912, 984), (998, 1170), (1192, 1386)]
RIGHT_COLUMNS = [(1450, 1646), (1670, 1832)]
# Top transoms are painted at a slight slant: (x, y of the band's centre) at both ends.
LEFT_TOP_TRANSOM = ((908, 120), (1390, 96))
RIGHT_TOP_TRANSOM = ((1447, 92), (1835, 64))
TRANSOM_HALF = 13
MIDDLE_TRANSOM = (391, 416)
SILL_Y = 650
def transom_y(line, x):
    (x0, y0), (x1, y1) = line
    return y0 + (y1 - y0) * (x - x0) / (x1 - x0)


def build_mask():
    mask = Image.new('L', (1920, 1080), 0)
    d = ImageDraw.Draw(mask)
    for columns, top in ((LEFT_COLUMNS, LEFT_TOP_TRANSOM), (RIGHT_COLUMNS, RIGHT_TOP_TRANSOM)):
        for x0, x1 in columns:
            # top row: from the top of the picture down to the slanted transom
            d.polygon([(x0, 0), (x1, 0), (x1, transom_y(top, x1) - TRANSOM_HALF), (x0, transom_y(top, x0) - TRANSOM_HALF)], fill=255)
            # middle row: from the transom down to the middle transom
            d.polygon([(x0, transom_y(top, x0) + TRANSOM_HALF), (x1, transom_y(top, x1) + TRANSOM_HALF), (x1, MIDDLE_TRANSOM[0]), (x0, MIDDLE_TRANSOM[0])], fill=255)
            # bottom row
            d.rectangle([x0, MIDDLE_TRANSOM[1], x1, SILL_Y], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(2.5))
    mask = mask.resize((round(1920 * SCALE), round(1080 * SCALE)), Image.LANCZOS)
    white = Image.new('L', mask.size, 255)
    Image.merge('RGBA', (white, white, white, mask)).save(OUT / 'glass-mask.png', optimize=True)


def rain_tile(path, w, h, count, length, opacity, width, seed):
    random.seed(seed)
    lines = []
    for _ in range(count):
        x = random.uniform(0, w)
        y = random.uniform(0, h)
        L = random.uniform(*length)
        o = random.uniform(*opacity)
        dx = 0  # vertical here; the layer is tilted in CSS so the streaks fall along their own slant
        for ox in (-w, 0, w):  # wrap so the tile repeats seamlessly
            for oy in (-h, 0, h):
                x0, y0 = x + ox, y + oy
                # a faint tail, then the brighter lower part of the streak (solid strokes:
                # a gradient on a perfectly vertical line has no box to stretch over)
                lines.append(
                    f'<line x1="{x0:.1f}" y1="{y0:.1f}" x2="{x0 + dx:.1f}" y2="{y0 + L:.1f}" '
                    f'stroke="#e6edff" stroke-opacity="{o * 0.45:.2f}" stroke-width="{width}" stroke-linecap="round"/>'
                )
                lines.append(
                    f'<line x1="{x0 + dx * 0.5:.1f}" y1="{y0 + L * 0.5:.1f}" x2="{x0 + dx:.1f}" y2="{y0 + L:.1f}" '
                    f'stroke="#f4f7ff" stroke-opacity="{o:.2f}" stroke-width="{width}" stroke-linecap="round"/>'
                )
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">'
        + ''.join(lines) + '</svg>'
    )
    path.write_text(svg)


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    build_mask()
    rain_tile(OUT / 'rain-near.svg', 220, 300, 16, (18, 30), (0.35, 0.65), 1.1, 7)
    rain_tile(OUT / 'rain-far.svg', 160, 220, 22, (9, 16), (0.2, 0.4), 0.8, 11)
    print('wrote', sorted(p.name for p in OUT.iterdir()))
