"""Cut each chosen track's best 8 bars into a seamless loop (a short crossfade baked into its start),
even its loudness, and write the loops' facts (tempo, key, chords, drum hits) as JSON.
Usage: cut.py <analysis.json> <stereo wav dir> <out dir> <out json> <file>..."""
import json, sys, pathlib
import numpy as np
import soundfile as sf
import librosa

analysis = {r['file'].removesuffix('.wav'): r for r in json.load(open(sys.argv[1]))}
wav_dir, out_dir, out_json = pathlib.Path(sys.argv[2]), pathlib.Path(sys.argv[3]), sys.argv[4]
NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
XF = 0.06  # seconds of crossfade at the seam
TARGET_RMS = 0.12
out = []
for name in sys.argv[5:]:
    r = analysis[name]
    y, sr = sf.read(wav_dir / f'{name}.wav', always_2d=True)
    t0, t1 = r['loop']
    a, b, x = int(t0 * sr), int(t1 * sr), int(XF * sr)
    seg = y[a:b].copy()
    tail = y[b:b + x]
    k = np.linspace(0, 1, len(tail))[:, None]
    seg[: len(tail)] = seg[: len(tail)] * np.sqrt(k) + tail * np.sqrt(1 - k)  # the seam: the song's own continuation fades into the start
    rms = float(np.sqrt(np.mean(seg ** 2)))
    seg = seg * (TARGET_RMS / max(rms, 1e-6))
    peak = float(np.abs(seg).max())
    if peak > 0.97:
        seg *= 0.97 / peak
    sf.write(out_dir / f'{name}.wav', seg, sr, subtype='PCM_16')
    # drum hits on the loop's 128 sixteenths, from the mono mix: the strongest few per bar
    mono = librosa.resample(seg.mean(axis=1), orig_sr=sr, target_sr=22050)
    S = np.abs(librosa.stft(mono, n_fft=1024, hop_length=256))
    f = librosa.fft_frequencies(sr=22050, n_fft=1024)
    dt = 256 / 22050
    step = (len(mono) / 22050) / 128

    def strengths(lo, hi):
        band = S[(f >= lo) & (f < hi)].sum(axis=0)
        lb = np.log1p(band * 10)
        flux = np.maximum(0, np.diff(lb, prepend=lb[0]))
        return np.array([flux[max(0, int(i * step / dt) - 2): int(i * step / dt) + 3].max() for i in range(128)])

    def pick(vals, per_bar, rel):
        top = np.percentile(vals, 97) or 1
        hits = []
        for bar in range(8):
            v = vals[bar * 16:(bar + 1) * 16]
            order = [i for i in np.argsort(-v) if v[i] >= top * rel][:per_bar]
            hits += sorted(bar * 16 + int(i) for i in order)
        return hits

    kick = pick(strengths(30, 150), 3, 0.5)
    snare = pick(strengths(1500, 5000), 2, 0.5)
    hat = pick(strengths(7000, 11000), 6, 0.45)
    relative_major = r['key_pc'] if r['key_mode'] == 'major' else (r['key_pc'] + 3) % 12
    out.append({
        'id': name, 'file': f'{name}.m4a', 'bpm': r['tempo'], 'bars': 8, 'seconds': round(len(seg) / sr, 4),
        'key': f"{NAMES[r['key_pc']]} {r['key_mode']}", 'transpose': ((relative_major + 6) % 12) - 6,
        'chords': [c[1] for c in r['chords']], 'kick': kick, 'snare': snare, 'hat': hat,
    })
    print(name, out[-1]['bpm'], out[-1]['key'], 'transpose', out[-1]['transpose'], 'k', len(kick), 's', len(snare), 'h', len(hat), f'gain {TARGET_RMS / max(rms, 1e-6):.2f}')
json.dump(out, open(out_json, 'w'), indent=1)
