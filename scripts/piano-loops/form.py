"""Find a backing track's own jam form and cut it as one loop, with no splices inside it.

A jam wants more than eight bars going round, but whatever form a track has is its own: a one- or
two-chord vamp (funk, soul), a repeating progression with a turnaround (pop, lounge), verse and
chorus (A B), a standard's A A B A... So this labels the track's 4-bar phrases by how alike they are,
which shows its real form, then takes the longest stretch the song plays straight through (12 to 32
bars, all of it full: no intro, fade or breakdown) whose end leads back into its start the way the
song itself goes on. The only joint is the loop point, baked as cut.py does: the bar that follows the
stretch in the song fades into its start over 60 ms. The joint is also checked in the audio: the
loudness and the jolt of sound at the wrap against those at the stretch's own bar lines.

Writes the loop's audio (evened in loudness, as cut.py does) and its facts: tempo, key, form, each
bar's chord, the drum hits on its sixteenths, and the joint's measurements.
Usage: form.py <stereo wav> <out wav> <out json>   (needs librosa, soundfile)"""
import json, sys
import numpy as np
import soundfile as sf
import librosa

SR = 22050
XF = 0.06  # seconds of crossfade at the loop point
TARGET_RMS = 0.12
NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
MAJOR = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
MINOR = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])


def chord_of(chroma):
    best = (-1, 0, 'maj')
    for pc in range(12):
        for q, ints in (('maj', (0, 4, 7)), ('min', (0, 3, 7))):
            tpl = np.zeros(12)
            for i in ints:
                tpl[(pc + i) % 12] = 1
            s = float(np.dot(tpl, chroma) / (np.linalg.norm(chroma) * np.sqrt(3) + 1e-9))
            if s > best[0]:
                best = (s, pc, q)
    return best[1], best[2]


def band_flux(y, lo, hi, hop=256):
    S = np.abs(librosa.stft(y, n_fft=1024, hop_length=hop))
    f = librosa.fft_frequencies(sr=SR, n_fft=1024)
    band = S[(f >= lo) & (f < hi)].sum(axis=0)
    return np.maximum(0, np.diff(np.log1p(band * 10), prepend=0)), hop / SR


def cos(a, b):
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-9))


src, out_wav, out_json = sys.argv[1:4]
stereo, sr0 = sf.read(src, always_2d=True)
y = librosa.resample(stereo.mean(axis=1), orig_sr=sr0, target_sr=SR)

# ── the bars ──
onset = librosa.onset.onset_strength(y=y, sr=SR)
tempo, beats = librosa.beat.beat_track(onset_envelope=onset, sr=SR, units='time', tightness=200)
tempo = float(np.atleast_1d(tempo)[0])
beats = np.asarray(beats)
kick, kdt = band_flux(y, 30, 150)
if tempo > 115:  # (the tracker counted eighths)
    pick = int(np.argmax([sum(kick[min(len(kick) - 1, int(b / kdt))] for b in beats[p::2]) for p in range(2)]))
    beats = beats[pick::2]


def at(env, dt, t):
    i = int(t / dt)
    return env[max(0, i - 2): i + 3].max() if i < len(env) else 0


phase = int(np.argmax([sum(at(kick, kdt, b) for b in beats[p::4]) for p in range(4)]))
bars = beats[phase::4]
nb = len(bars) - 1
chroma = librosa.feature.chroma_cqt(y=y, sr=SR, hop_length=512)
ct = librosa.frames_to_time(np.arange(chroma.shape[1]), sr=SR, hop_length=512)
mfcc = librosa.feature.mfcc(y=y, sr=SR, hop_length=512, n_mfcc=13)
rms = librosa.feature.rms(y=y, hop_length=512)[0]
bar_chroma, bar_feat, bar_loud = [], [], []
for i in range(nb):
    m = (ct >= bars[i]) & (ct < bars[i + 1])
    c = chroma[:, m].mean(axis=1)
    bar_chroma.append(c)
    bar_feat.append(np.concatenate([c, mfcc[1:, m].mean(axis=1) / 50]))
    bar_loud.append(float(rms[m].mean()))
bar_loud = np.array(bar_loud)
full = bar_loud / (np.percentile(bar_loud, 75) + 1e-9) > 0.6

# ── its form: each 4-bar phrase lettered by the first earlier phrase it matches ──
def phrase(s):
    return np.concatenate([np.concatenate(bar_chroma[s:s + 4]), np.mean(bar_feat[s:s + 4], axis=0)[12:]])


def letters(s, e):
    seen, out = [], []
    for p in range(s, e, 4):
        f = phrase(p)
        match = next((i for i, g in enumerate(seen) if cos(f, g) > 0.95), None)
        if match is None:
            seen.append(f)
            match = len(seen) - 1
        out.append('ABCDEFGH'[match])
    return out


# ── the stretch: played straight through, all full, its end leading back into its start. The wrap is
# judged twice: in the music (the bar the song plays next against the stretch's first bar) and in the
# sound (the loudness and the attack of the song's next downbeat against the stretch's first), so the
# loop point sounds like any other bar line. Whole 8-bar phrases first; 4-bar ones only if need be. ──
env0 = librosa.onset.onset_strength(y=y, sr=SR, hop_length=256)
r0 = librosa.feature.rms(y=y, hop_length=256)[0]
edt = 256 / SR
half = int(0.6 / edt)


def level_after(t):
    i = int(t / edt)
    return float(20 * np.log10(r0[i:i + half].mean() + 1e-9))


def hit_at(t):
    return float(at(env0, edt, t))


bar_hits = np.median([hit_at(t) for t in bars[:-1]]) + 1e-9
best = None
for step_bars in (8, 4):
    for s in range(0, nb - 12):
        for L in range(32, 11, -step_bars):
            e = s + L
            if e >= nb or not full[s:e].all() or L % step_bars:
                continue
            wrap = cos(bar_feat[e], bar_feat[s])
            if wrap < 0.94:
                continue
            dlevel = abs(level_after(bars[e]) - level_after(bars[s]))
            djolt = abs(hit_at(bars[e]) - hit_at(bars[s])) / bar_hits
            form = letters(s, e)
            kinds = len(set(form))
            score = 3 * wrap + 0.6 * (L / 32) + 0.25 * min(kinds, 3) - 0.35 * dlevel - 0.8 * djolt
            if best is None or score > best[0]:
                best = (score, s, e, wrap, form)
    if best is not None:
        break
if best is None:
    sys.exit('no full stretch that wraps cleanly')
_, s, e, wrap, form = best
p0, p1 = int(bars[s] * sr0), int(bars[e] * sr0)
x = int(XF * sr0)
loop = stereo[p0:p1].copy()
tail = stereo[p1:p1 + x]
k = np.linspace(0, 1, len(tail))[:, None]
loop[: len(tail)] = loop[: len(tail)] * np.sqrt(k) + tail * np.sqrt(1 - k)

# ── the joint, heard in the loop itself: loudness and jolt at the wrap against its own bar lines ──
twice = np.concatenate([loop, loop]).mean(axis=1)
tw = librosa.resample(twice, orig_sr=sr0, target_sr=SR)
env = librosa.onset.onset_strength(y=tw, sr=SR, hop_length=256)
blen = (p1 - p0) / sr0
inner = [at(env, edt, bars[i] - bars[s]) for i in range(s + 1, e)]
seam_jolt = float(at(env, edt, blen) / (np.median(inner) + 1e-9))
jolt_range = [round(float(np.percentile(inner, 10) / (np.median(inner) + 1e-9)), 2), round(float(np.percentile(inner, 90) / (np.median(inner) + 1e-9)), 2)]
r = librosa.feature.rms(y=tw, hop_length=256)[0]
win = int(0.5 / edt)
i0 = int(blen / edt)
seam_level = float(20 * np.log10((r[i0:i0 + win].mean() + 1e-9) / (r[i0 - win:i0].mean() + 1e-9)))
inner_levels = [float(20 * np.log10((r[int((bars[i] - bars[s]) / edt):int((bars[i] - bars[s]) / edt) + win].mean() + 1e-9) / (r[int((bars[i] - bars[s]) / edt) - win:int((bars[i] - bars[s]) / edt)].mean() + 1e-9))) for i in range(s + 1, e)]

level = float(np.sqrt(np.mean(loop ** 2)))
loop = loop * (TARGET_RMS / max(level, 1e-6))
peak = float(np.abs(loop).max())
if peak > 0.97:
    loop *= 0.97 / peak
sf.write(out_wav, loop, sr0, subtype='PCM_16')

# ── its facts ──
nbars = e - s
chords = [chord_of(bar_chroma[i]) for i in range(s, e)]
loop_chroma = np.mean(bar_chroma[s:e], axis=0)
key = None
for pc in range(12):
    for mode, prof in (('major', MAJOR), ('minor', MINOR)):
        rr = float(np.corrcoef(np.roll(prof, pc), loop_chroma)[0, 1])
        tonic = pc if mode == 'major' else (pc + 3) % 12
        scale = {(tonic + i) % 12 for i in (0, 2, 4, 5, 7, 9, 11)}
        fit = np.mean([((c + (3 if q == 'min' else 4)) % 12 in scale and c in scale) for c, q in chords])
        if key is None or rr + 0.6 * fit > key[0]:
            key = (rr + 0.6 * fit, pc, mode)
_, key_pc, key_mode = key
seconds = len(loop) / sr0
mono = librosa.resample(loop.mean(axis=1), orig_sr=sr0, target_sr=SR)
steps = nbars * 16
step = seconds / steps


def strengths(lo, hi):
    S = np.abs(librosa.stft(mono, n_fft=1024, hop_length=256))
    f = librosa.fft_frequencies(sr=SR, n_fft=1024)
    lb = np.log1p(S[(f >= lo) & (f < hi)].sum(axis=0) * 10)
    flux = np.maximum(0, np.diff(lb, prepend=lb[0]))
    dt = 256 / SR
    return np.array([flux[max(0, int(i * step / dt) - 2): int(i * step / dt) + 3].max() for i in range(steps)])


def pick(vals, per_bar, rel):
    top = np.percentile(vals, 97) or 1
    hits = []
    for bar in range(nbars):
        v = vals[bar * 16:(bar + 1) * 16]
        order = [i for i in np.argsort(-v) if v[i] >= top * rel][:per_bar]
        hits += sorted(bar * 16 + int(i) for i in order)
    return hits


relative_major = key_pc if key_mode == 'major' else (key_pc + 3) % 12
facts = {
    'bpm': round(60 * 4 * nbars / seconds, 3), 'bars': nbars, 'seconds': round(seconds, 4), 'from_bar': s,
    'key': f'{NAMES[key_pc]} {key_mode}', 'transpose': ((relative_major + 6) % 12) - 6,
    'form': ' '.join(form), 'wrap': round(wrap, 3), 'seam_jolt': round(seam_jolt, 2), 'bar_line_jolts_10_90': jolt_range,
    'seam_level_db': round(seam_level, 1), 'bar_line_level_db_10_90': [round(float(np.percentile(inner_levels, 10)), 1), round(float(np.percentile(inner_levels, 90)), 1)],
    'chords': [c for c, _ in chords], 'chord_names': [NAMES[c] + ('' if q == 'maj' else 'm') for c, q in chords],
    'kick': pick(strengths(30, 150), 3, 0.5), 'snare': pick(strengths(1500, 5000), 2, 0.5), 'hat': pick(strengths(7000, 11000), 6, 0.45),
    'song_form': ' '.join(letters(0, nb - nb % 4)), 'song_bars': nb,
}
json.dump(facts, open(out_json, 'w'), indent=1)
print(json.dumps({k: v for k, v in facts.items() if k not in ('kick', 'snare', 'hat', 'chords')}))
