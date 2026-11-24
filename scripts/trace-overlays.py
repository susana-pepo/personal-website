"""Trace the clickable outline of each transparent overlay from its alpha channel.

Usage: python3 scripts/trace-overlays.py        (or: npm run scene:trace)
Requires Pillow (pip install pillow).

Reads the overlay positions from src/scene/scene-layout.json and rewrites the
`polygons` of every hotspot in src/scene/hotspot-geometry.json that has an
`overlay` key, and of every hover-only outline (`hoverZones`). Run it after moving or resizing an overlay so the hit area
follows the artwork. The PNGs themselves are only read, never changed.
"""
import json
from pathlib import Path

from PIL import Image, ImageFilter

root = Path(__file__).resolve().parent.parent
layout_path = root / 'src/scene/scene-layout.json'
geometry_path = root / 'src/scene/hotspot-geometry.json'

ALPHA_THRESHOLD = 64  # pixels at least this opaque count as the object
PAD = 5  # canvas pixels of forgiveness around the silhouette
ROW_STEP = 3  # sample every n canvas rows
EPSILON = 2.0  # simplification tolerance, canvas pixels


def simplify(points, epsilon):
    """Ramer-Douglas-Peucker on an open polyline."""
    if len(points) < 3:
        return points
    (x1, y1), (x2, y2) = points[0], points[-1]
    dx, dy = x2 - x1, y2 - y1
    norm = (dx * dx + dy * dy) ** 0.5 or 1.0
    index, worst = 0, 0.0
    for i in range(1, len(points) - 1):
        px, py = points[i]
        distance = abs(dy * px - dx * py + x2 * y1 - y2 * x1) / norm
        if distance > worst:
            index, worst = i, distance
    if worst <= epsilon:
        return [points[0], points[-1]]
    return simplify(points[: index + 1], epsilon)[:-1] + simplify(points[index:], epsilon)


def trace(overlay, canvas_w, canvas_h):
    image = Image.open(root / 'public' / overlay['src'].lstrip('/'))
    width = round(overlay['width'])
    height = round(width * image.height / image.width)
    alpha = image.getchannel('A').resize((width, height), Image.LANCZOS)
    if 'hitFromY' in overlay:
        # Only the solid object below this line (in the artwork's own pixels) is clickable: e.g. not the coffee's steam.
        alpha.paste(0, (0, 0, width, round(overlay['hitFromY'] * height / image.height)))
    # Pad, threshold, then grow the silhouette a little so edges are easy to hit.
    padded = Image.new('L', (width + 2 * PAD + 2, height + 2 * PAD + 2), 0)
    padded.paste(alpha.point(lambda v: 255 if v >= ALPHA_THRESHOLD else 0), (PAD + 1, PAD + 1))
    mask = padded.filter(ImageFilter.MaxFilter(2 * PAD + 1))
    px = mask.load()
    ox, oy = overlay['x'] - PAD - 1, overlay['y'] - PAD - 1

    # Row envelope: leftmost and rightmost covered pixel on each sampled row.
    # Concavities between books or under the lid become part of the hit area,
    # which is what a visitor expects when aiming at an object.
    left, right = [], []
    rows = list(range(0, mask.height, ROW_STEP))
    if rows[-1] != mask.height - 1:
        rows.append(mask.height - 1)
    for y in rows:
        xs = [x for x in range(mask.width) if px[x, y]]
        if not xs:
            continue
        cy = min(max(oy + y, 0), canvas_h)
        left.append((min(max(ox + xs[0], 0), canvas_w), cy))
        right.append((min(max(ox + xs[-1] + 1, 0), canvas_w), cy))
    outline = simplify(left, EPSILON) + simplify(right[::-1], EPSILON)
    # drop consecutive duplicates
    cleaned = [p for i, p in enumerate(outline) if i == 0 or p != outline[i - 1]]
    return [[int(round(x)), int(round(y))] for x, y in cleaned]


def main():
    layout = json.loads(layout_path.read_text())
    overlays = {o['id']: o for o in layout['overlays']}
    geometry = json.loads(geometry_path.read_text())
    canvas_w, canvas_h = layout['canvas']['width'], layout['canvas']['height']
    for spot in geometry['hotspots']:
        overlay_id = spot.get('overlay')
        if not overlay_id:
            continue
        polygon = trace(overlays[overlay_id], canvas_w, canvas_h)
        spot['polygons'] = [polygon]
        print(f"{spot['id']}: {len(polygon)} points from {overlays[overlay_id]['src']}")
    # Hover-only outlines (no click, no label): the plant's sway.
    for zone in geometry.get('hoverZones', []):
        polygon = trace(overlays[zone['overlay']], canvas_w, canvas_h)
        zone['polygons'] = [polygon]
        print(f"{zone['id']} (hover): {len(polygon)} points from {overlays[zone['overlay']]['src']}")
    geometry_path.write_text(format_geometry(geometry))


def format_geometry(geometry):
    """JSON with one [x, y] pair per line, matching the hand-edited style."""
    text = json.dumps(geometry, indent=2, ensure_ascii=False)
    lines, out, i = text.split('\n'), [], 0
    while i < len(lines):
        line = lines[i]
        # collapse   [\n  x,\n  y\n]  into  [x, y]
        if line.strip() == '[' and i + 3 < len(lines) and lines[i + 3].strip().startswith(']'):
            a, b = lines[i + 1].strip().rstrip(','), lines[i + 2].strip()
            if a.lstrip('-').isdigit() and b.lstrip('-').isdigit():
                indent = line[: len(line) - len(line.lstrip())]
                out.append(f'{indent}[{a}, {b}]{lines[i + 3].strip()[1:]}')
                i += 4
                continue
        out.append(line)
        i += 1
    return '\n'.join(out) + '\n'


if __name__ == '__main__':
    main()
