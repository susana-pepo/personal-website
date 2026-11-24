"""Write an animated clip as transparent video: the way the room plays its large clips.

Animated WebP is decoded on the processor, frame by frame, and nothing keeps the last frame
on screen if the browser falls behind: large clips then blink out for a frame. Video is
decoded by the graphics chip and always holds its last frame, so the room plays these instead
(the WebP stays as the fallback). Each clip is written twice:

  <name>.webm  VP9 with alpha, for Chrome, Edge and Firefox (ffmpeg)
  <name>.mov   HEVC with alpha, for Safari (Apple's own encoder: scripts/hevc-alpha.m, built here
               with clang on first use; ffmpeg's HEVC with alpha isn't read by macOS's decoder)

An opaque clip (no transparency: the window's views) needs none of that: it's written once, as
  <name>.mp4   H.264, which every browser plays (write_opaque_video).

All are tagged as sRGB pictures (Rec. 709 primaries and matrix, sRGB transfer), so the browser
shows the colours of the still pictures around them; measured, both decode to within about 2
levels of the frames they were made from.

Same pixels on screen and the same timing: every frame, each held as long as the export holds
it, at a constant frame rate. The size is made even (HEVC needs it) by adding transparent rows
and columns on the right and at the bottom only, so the picture never moves.

Needs macOS with the command line tools (clang), and an ffmpeg with libvpx-vp9:
`FFMPEG=/path/to/ffmpeg`, or ffmpeg on PATH, or `pip install imageio-ffmpeg` (its build has it).

Also usable on its own, to convert a built animated WebP (its frame timings are kept):
  python3 scripts/clip_video.py public/media/scene/cat/cat-sleep.webp [--fps 30] [--crf 30]
"""
import argparse
import os
import shutil
import subprocess
import tempfile
from fractions import Fraction
from pathlib import Path

from PIL import Image, ImageSequence

# VP9's constant quality (lower is better): 30 can't be told from the WebP at 2x zoom, at about a
# fifth of its size. HEVC's quality and its alpha's (0-1, higher is better), likewise.
CRF = 30
HEVC_Q = 0.6
HEVC_ALPHA = 0.8
HEVC_TOOL_SRC = Path(__file__).resolve().parent / 'hevc-alpha.m'

ROOT = Path(__file__).resolve().parent.parent
# The animated WebP of each clip is still written (the builds read frames back from it: her breath,
# the chair, the window's light detection), but it's no longer served: the page plays only video,
# and shows a still where video can't play. So it's kept here, beside the sources, out of the site.
KEPT = ROOT / 'portfolio-website-assets/built'


def kept(path):
    """Where a clip's animated WebP named by its place in public/media is kept instead (paths
    outside public/media are left as they are)."""
    p = Path(path).resolve()
    try:
        rel = p.relative_to((ROOT / 'public/media').resolve())
    except ValueError:
        return Path(path)
    out = KEPT / rel
    out.parent.mkdir(parents=True, exist_ok=True)
    return out


def hevc_tool():
    """Apple's HEVC-with-alpha encoder (scripts/hevc-alpha.m), built once per change of its source."""
    out = Path(tempfile.gettempdir()) / f'hevc-alpha-{int(HEVC_TOOL_SRC.stat().st_mtime)}'
    if not out.exists():
        subprocess.run(['clang', '-fobjc-arc', '-O2', '-w', *[a for f in ('AVFoundation', 'CoreMedia', 'CoreVideo', 'CoreGraphics', 'ImageIO',
                        'VideoToolbox', 'Foundation') for a in ('-framework', f)], str(HEVC_TOOL_SRC), '-o', str(out)], check=True)
    return str(out)


def ffmpeg_path():
    if os.environ.get('FFMPEG'):
        return os.environ['FFMPEG']
    found = shutil.which('ffmpeg')
    if found:
        return found
    try:
        import imageio_ffmpeg  # type: ignore

        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        raise SystemExit('clip_video: no ffmpeg found (set FFMPEG, put ffmpeg on PATH, or pip install imageio-ffmpeg)')


def even_size(w, h):
    return w + w % 2, h + h % 2


def write_videos(frames, holds, out_base, fps=30, crf=CRF, hevc_q=HEVC_Q):
    """frames: RGBA PIL images; holds: how many frames (at `fps`) each one is shown for.
    Writes out_base.webm and out_base.mov (each written aside, then swapped in)."""
    ff = ffmpeg_path()
    out_base = Path(out_base)
    w, h = frames[0].size
    W, H = even_size(w, h)
    with tempfile.TemporaryDirectory() as tmp:
        n = 0
        for frame, hold in zip(frames, holds):
            img = frame.convert('RGBA')
            if (W, H) != (w, h):
                padded = Image.new('RGBA', (W, H), (0, 0, 0, 0))
                padded.paste(img, (0, 0))
                img = padded
            path = Path(tmp) / f'{n:05d}.png'
            img.save(path, compress_level=1)
            for _ in range(max(1, hold) - 1):  # held frames are repeated (the video's rate is constant)
                n += 1
                os.link(path, Path(tmp) / f'{n:05d}.png')
            n += 1
        rate = Fraction(fps)
        src = ['-framerate', f'{rate.numerator}/{rate.denominator}', '-i', str(Path(tmp) / '%05d.png')]
        webm = out_base.with_name(f'.{out_base.name}.tmp.webm')
        mov = out_base.with_name(f'.{out_base.name}.tmp.mov')
        subprocess.run([ff, '-v', 'error', '-y', *src, '-vf', 'scale=out_color_matrix=bt709:out_range=tv', '-c:v', 'libvpx-vp9',
                        '-pix_fmt', 'yuva420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'iec61966-2-1',
                        '-color_range', 'tv', '-crf', str(crf), '-b:v', '0', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2',
                        '-auto-alt-ref', '0', '-an', str(webm)], check=True)
        subprocess.run([hevc_tool(), tmp, str(mov), str(rate.numerator), str(rate.denominator), str(hevc_q), str(HEVC_ALPHA)], check=True)
        os.replace(webm, out_base.with_suffix('.webm'))
        os.replace(mov, out_base.with_suffix('.mov'))
    sizes = ', '.join(f'{out_base.with_suffix(s).name} {os.path.getsize(out_base.with_suffix(s)) / 1e6:.2f} MB' for s in ('.webm', '.mov'))
    print(f'  video: {n} frames at {fps} fps, {W}x{H}: {sizes}', flush=True)
    return (W, H)


def write_opaque_video(frames, holds, out_base, fps=30, crf=18):
    """An opaque clip as H.264 (.mp4), for every browser. frames: RGB(A) PIL images or arrays (any
    alpha is ignored); holds: how many frames (at `fps`) each is shown for. Padded to an even size
    on the right and at the bottom, like the others."""
    ff = ffmpeg_path()
    out_base = Path(out_base)
    first = frames[0] if isinstance(frames[0], Image.Image) else Image.fromarray(frames[0])
    w, h = first.size
    W, H = even_size(w, h)
    with tempfile.TemporaryDirectory() as tmp:
        n = 0
        for frame, hold in zip(frames, holds):
            img = (frame if isinstance(frame, Image.Image) else Image.fromarray(frame)).convert('RGB')
            if (W, H) != (w, h):
                padded = Image.new('RGB', (W, H), (0, 0, 0))
                padded.paste(img, (0, 0))
                img = padded
            path = Path(tmp) / f'{n:05d}.png'
            img.save(path, compress_level=1)
            for _ in range(max(1, hold) - 1):
                n += 1
                os.link(path, Path(tmp) / f'{n:05d}.png')
            n += 1
        rate = Fraction(fps)
        mp4 = out_base.with_name(f'.{out_base.name}.tmp.mp4')
        subprocess.run([ff, '-v', 'error', '-y', '-framerate', f'{rate.numerator}/{rate.denominator}', '-i', str(Path(tmp) / '%05d.png'),
                        '-vf', 'scale=out_color_matrix=bt709:out_range=tv', '-c:v', 'libx264', '-preset', 'slow', '-crf', str(crf),
                        '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'iec61966-2-1',
                        '-color_range', 'tv', '-movflags', '+faststart', '-an', str(mp4)], check=True)
        os.replace(mp4, out_base.with_suffix('.mp4'))
    print(f'  video: {n} frames at {fps} fps, {W}x{H}: {out_base.with_suffix(".mp4").name} '
          f'{os.path.getsize(out_base.with_suffix(".mp4")) / 1e6:.2f} MB', flush=True)
    return (W, H)


def webp_durations(path):
    """Each frame's duration in ms, read from the file's ANMF chunks (Pillow doesn't report them)."""
    data = Path(path).read_bytes()
    out, i = [], 12
    while i + 8 <= len(data):
        tag, size = data[i:i + 4], int.from_bytes(data[i + 4:i + 8], 'little')
        if tag == b'ANMF':
            out.append(int.from_bytes(data[i + 8 + 12:i + 8 + 15], 'little'))
        i += 8 + size + (size & 1)
    return out


def webp_frames(path, fps):
    """An animated WebP's frames and holds (each frame's duration, in frames at `fps`, without drifting)."""
    frames = [f.convert('RGBA') for f in ImageSequence.Iterator(Image.open(path))]
    holds, t = [], 0
    for ms in webp_durations(path):
        t_next = t + ms
        holds.append(max(1, round(t_next * Fraction(fps) / 1000) - round(t * Fraction(fps) / 1000)))
        t = t_next
    return frames, holds


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('webp', nargs='+')
    ap.add_argument('--fps', default='30', help="frames a second, e.g. 30, 15 or 500/19 (a 38 ms frame)")
    ap.add_argument('--crf', type=int, default=CRF)
    a = ap.parse_args()
    for p in a.webp:
        frames, holds = webp_frames(p, a.fps)
        print(f'{p}: {len(frames)} frames', flush=True)
        write_videos(frames, holds, Path(p).with_suffix(''), a.fps, a.crf)
