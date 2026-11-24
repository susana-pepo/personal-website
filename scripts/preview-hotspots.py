"""Render the assembled scene (poster + overlays) with every clickable outline,
so alignment can be checked by eye.

Usage: python3 scripts/preview-hotspots.py [output.png]   (or: npm run hotspots:preview)
Requires Pillow (pip install pillow). Reads src/scene/scene-layout.json and
src/scene/hotspot-geometry.json. The poster is scaled to the 1920x1080 canvas.
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw

root = Path(__file__).resolve().parent.parent
layout = json.loads((root / 'src/scene/scene-layout.json').read_text())
geometry = json.loads((root / 'src/scene/hotspot-geometry.json').read_text())
out = Path(sys.argv[1]) if len(sys.argv) > 1 else root / 'docs/hotspot-preview.png'
size = (layout['canvas']['width'], layout['canvas']['height'])

public = root / 'public'
frame = layout['media'].get('frame', {'x': 0, 'y': 0, 'width': size[0], 'height': size[1]})
poster = Image.open(public / layout['media']['poster'].lstrip('/')).convert('RGBA')
poster = poster.resize((round(frame['width']), round(frame['height'])), Image.LANCZOS)
image = Image.new('RGBA', size, (0, 0, 0, 255))
image.paste(poster, (round(frame['x']), round(frame['y'])))
for item in sorted(layout['overlays'], key=lambda o: o['z']):  # every layer, back to front
    art = Image.open(public / item['src'].lstrip('/')).convert('RGBA')
    height = round(item['width'] * art.height / art.width)
    art = art.resize((item['width'], height), Image.LANCZOS)
    layer = Image.new('RGBA', size, (0, 0, 0, 0))
    layer.paste(art, (item['x'], item['y']), art)
    image = Image.alpha_composite(image, layer)

overlay = Image.new('RGBA', size, (0, 0, 0, 0))
draw = ImageDraw.Draw(overlay)
colours = [(0, 255, 255), (255, 0, 255), (255, 255, 0), (0, 255, 0), (255, 90, 90), (90, 160, 255), (255, 160, 0)]

for i, spot in enumerate(geometry['hotspots']):
    colour = colours[i % len(colours)]
    for poly in spot['polygons']:
        pts = [tuple(p) for p in poly]
        draw.polygon(pts, fill=colour + (45,))
        draw.line(pts + [pts[0]], fill=colour + (255,), width=2)
    lx, ly = spot['label']['x'], spot['label']['y']
    draw.ellipse((lx - 6, ly - 6, lx + 6, ly + 6), fill=colour + (255,))
    draw.text((lx + 10, ly - 18), f"{spot['id']} -> {spot['section'] or spot.get('action')}", fill=(255, 255, 255, 255))

Image.alpha_composite(image, overlay).convert('RGB').save(out)
print(f'Wrote {out}')
