"""Paint the link-preview picture (og:image, and the GitHub repository's social preview):
the whole room, every object in place, fading out of the dark page, with Susana's name
set in Geist Serif on the left.

Usage: python3 scripts/build-social-preview.py   (or: npm run scene:social)
Needs Pillow and Google Chrome (headless, for the real Geist fonts).
Writes public/social-preview.jpg, 1280x640 drawn at 2x (GitHub asks for 1280x640, under 1MB).
"""
import json
import subprocess
import tempfile
from pathlib import Path

from PIL import Image

root = Path(__file__).resolve().parent.parent
public = root / 'public'
fonts = root / 'src/assets/fonts/geist'
out = public / 'social-preview.jpg'
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'


def assemble_room(path: Path) -> None:
    """The poster with every still overlay on it, back to front, as scene-layout.json places them."""
    layout = json.loads((root / 'src/scene/scene-layout.json').read_text())
    size = (layout['canvas']['width'], layout['canvas']['height'])
    frame = layout['media']['frame']
    poster = Image.open(public / layout['media']['poster'].lstrip('/')).convert('RGBA')
    poster = poster.resize((round(frame['width']), round(frame['height'])), Image.LANCZOS)
    image = Image.new('RGBA', size, (17, 13, 11, 255))
    image.paste(poster, (round(frame['x']), round(frame['y'])))
    for item in sorted(layout['overlays'], key=lambda o: o['z']):
        art = Image.open(public / item['src'].lstrip('/')).convert('RGBA')
        width = round(item['width'])
        art = art.resize((width, round(width * art.height / art.width)), Image.LANCZOS)
        layer = Image.new('RGBA', size, (0, 0, 0, 0))
        layer.paste(art, (round(item['x']), round(item['y'])), art)
        image = Image.alpha_composite(image, layer)
    image.convert('RGB').save(path)


PAGE = """<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:GeistSerif;src:url("FONTS/GeistSerif-Regular.woff2") format("woff2")}
@font-face{font-family:Geist;src:url("FONTS/Geist-Variable.woff2") format("woff2");font-weight:100 900}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1280px;height:640px;overflow:hidden;background:#110D0B}
body{position:relative;-webkit-font-smoothing:antialiased;font-synthesis:none}
.room{position:absolute;right:0;top:0;height:640px}
.shade{position:absolute;inset:0;background:linear-gradient(90deg,#110D0B 0%,#110D0B 18%,
  rgba(17,13,11,.86) 30%,rgba(17,13,11,.35) 46%,rgba(17,13,11,0) 60%)}
.text{position:absolute;left:64px;top:0;bottom:0;width:400px;display:flex;flex-direction:column;justify-content:center}
.name{font-family:GeistSerif;font-weight:400;font-size:60px;line-height:1.02;letter-spacing:-0.025em;
  color:#F4ECDF;text-shadow:0 2px 24px rgba(0,0,0,.5)}
.rule{width:36px;height:1px;background:#E4673F;margin-top:28px}
.disc{font-family:Geist;font-weight:500;font-size:13px;letter-spacing:0.15em;text-transform:uppercase;
  color:#BFBAB4;margin-top:26px;line-height:1.45}
</style></head><body>
<img class="room" src="room.png"><div class="shade"></div>
<div class="text">
  <div class="name">Susana<br>Pérez Posada</div>
  <div class="rule"></div>
  <div class="disc">Product, Music<br>&amp; Technology</div>
</div>
</body></html>"""


with tempfile.TemporaryDirectory() as tmp:
    work = Path(tmp)
    assemble_room(work / 'room.png')
    (work / 'page.html').write_text(PAGE.replace('FONTS', fonts.as_uri()))
    subprocess.run(
        [CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files',
         '--force-device-scale-factor=2', '--window-size=1280,640', '--virtual-time-budget=3000',
         f'--screenshot={work / "shot.png"}', (work / 'page.html').as_uri()],
        check=True, capture_output=True,
    )
    Image.open(work / 'shot.png').convert('RGB').save(out, quality=86, optimize=True, progressive=True)
print(f'Wrote {out} ({out.stat().st_size // 1024} KB)')
