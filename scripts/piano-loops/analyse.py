"""Measure candidate backing tracks: tempo and bars, key, chords, drum hits, and the best seamless
8-bar loop. Usage: analyse.py <wav dir> <out json>  (wavs are 44.1 kHz mono, decoded by afconvert)."""
import json, sys, pathlib
import numpy as np
import librosa

SR = 22050
MAJOR = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
MINOR = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
BARS = 8


def key_of(chroma_mean):
    best = (-2, None, None)
    for pc in range(12):
        for mode, prof in (('major', MAJOR), ('minor', MINOR)):
            r = np.corrcoef(np.roll(prof, pc), chroma_mean)[0, 1]
            if r > best[0]:
                best = (r, pc, mode)
    return best


def chord_of(chroma):
    """Best triad (major/minor) root for one bar's chroma."""
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


def band_onsets(y, lo, hi, hop=256):
    S = np.abs(librosa.stft(y, n_fft=1024, hop_length=hop))
    f = librosa.fft_frequencies(sr=SR, n_fft=1024)
    band = S[(f >= lo) & (f < hi)].sum(axis=0)
    flux = np.maximum(0, np.diff(np.log1p(band * 10), prepend=0))
    return flux, hop / SR


def analyse(path):
    y, _ = librosa.load(path, sr=SR, mono=True)
    dur = len(y) / SR
    onset = librosa.onset.onset_strength(y=y, sr=SR)
    tempo, beats = librosa.beat.beat_track(onset_envelope=onset, sr=SR, units='time', tightness=200)
    tempo = float(np.atleast_1d(tempo)[0])
    beats = np.asarray(beats)
    if tempo > 115:  # the tracker counted eighth notes: lo-fi lives at 60-100 BPM
        kick0, kdt0 = band_onsets(y, 30, 150)
        pick = int(np.argmax([sum(kick0[min(len(kick0) - 1, int(b / kdt0))] for b in beats[p::2]) for p in range(2)]))
        beats = beats[pick::2]
        tempo /= 2
    if len(beats) < BARS * 4 * 2 + 8:
        return {'file': path.name, 'skip': 'too short'}
    ibi = np.diff(beats)
    steady = float(np.std(ibi) / np.mean(ibi))
    # downbeat: the phase (of 4) whose beats carry the most low end (the kick)
    kick, kdt = band_onsets(y, 30, 150)
    def at(env, dt, t):
        i = int(t / dt)
        return env[max(0, i - 2): i + 3].max() if i < len(env) else 0
    phase = int(np.argmax([sum(at(kick, kdt, b) for b in beats[p::4]) for p in range(4)]))
    bars = beats[phase::4]
    chroma = librosa.feature.chroma_cqt(y=y, sr=SR, hop_length=512)
    ct = librosa.frames_to_time(np.arange(chroma.shape[1]), sr=SR, hop_length=512)
    mfcc = librosa.feature.mfcc(y=y, sr=SR, hop_length=512, n_mfcc=13)
    rms = librosa.feature.rms(y=y, hop_length=512)[0]
    k_r, k_pc, k_mode = key_of(chroma.mean(axis=1))

    def bar_feat(b0, b1):
        m = (ct >= b0) & (ct < b1)
        return np.concatenate([chroma[:, m].mean(axis=1), mfcc[1:, m].mean(axis=1) / 50]), float(rms[m].mean())

    feats = [bar_feat(bars[i], bars[i + 1]) for i in range(len(bars) - 1)]
    loud = np.array([f[1] for f in feats])
    best = None
    for s in range(0, len(feats) - 2 * BARS):
        a = np.array([f[0] for f in feats[s:s + BARS]])
        b = np.array([f[0] for f in feats[s + BARS:s + 2 * BARS]])
        sim = float(np.mean([np.dot(x, z) / (np.linalg.norm(x) * np.linalg.norm(z) + 1e-9) for x, z in zip(a, b)]))
        # the loop should be a full, steady part of the song (not the intro or the fade)
        full = float(loud[s:s + BARS].min() / (np.percentile(loud, 75) + 1e-9))
        score = sim + 0.25 * min(1, full)
        if best is None or score > best[0]:
            best = (score, s, sim, full)
    _, s, sim, full = best
    t0, t1 = float(bars[s]), float(bars[s + BARS])
    # the key, from the loop itself: its chroma, and how many of its chords belong to each key
    m = (ct >= t0) & (ct < t1)
    loop_chroma = chroma[:, m].mean(axis=1)
    bar_chords = [chord_of(chroma[:, (ct >= bars[s + i]) & (ct < bars[s + i + 1])].mean(axis=1)) for i in range(BARS)]
    best_key = None
    for pc in range(12):
        for mode, prof in (('major', MAJOR), ('minor', MINOR)):
            r = float(np.corrcoef(np.roll(prof, pc), loop_chroma)[0, 1])
            tonic = pc if mode == 'major' else (pc + 3) % 12  # its relative major
            scale = {(tonic + i) % 12 for i in (0, 2, 4, 5, 7, 9, 11)}
            fit = np.mean([((c + (3 if q == 'min' else 4)) % 12 in scale and c in scale and (c + 7) % 12 in scale) for c, q in bar_chords])
            sc = r + 0.6 * fit
            if best_key is None or sc > best_key[0]:
                best_key = (sc, pc, mode, r, fit)
    k_r, k_pc, k_mode = best_key[3], best_key[1], best_key[2]
    key_fit = float(best_key[4])
    seg_beats = beats[(beats >= t0 - 1e-3) & (beats < t1 - 1e-3)]
    # drum hits in the loop, on its sixteenth-note grid
    snare, sdt = band_onsets(y, 1500, 5000)
    hat, hdt = band_onsets(y, 7000, 11000)
    steps = BARS * 16
    step = (t1 - t0) / steps

    def hits(env, dt, rel):
        vals = np.array([at(env, dt, t0 + i * step) for i in range(steps)])
        thr = max(vals.max() * rel, np.percentile(vals, 70))
        return [i for i, v in enumerate(vals) if v >= thr and v > 0]

    chords = [[pc, q] for pc, q in bar_chords]
    return {
        'file': path.name, 'duration': round(dur, 1), 'tempo': round(60 * 4 * BARS / (t1 - t0), 2), 'tracker_tempo': round(tempo, 1),
        'steady': round(steady, 3), 'key': f'{NAMES[k_pc]} {k_mode}', 'key_pc': k_pc, 'key_mode': k_mode, 'key_conf': round(float(k_r), 2), 'key_fit': round(key_fit, 2),
        'loop': [round(t0, 4), round(t1, 4)], 'loop_bar': int(s), 'repeat_sim': round(sim, 3), 'fullness': round(full, 2),
        'kick': hits(kick, kdt, 0.45), 'snare': hits(snare, sdt, 0.45), 'hat': hits(hat, hdt, 0.5),
        'chords': [[NAMES[pc] + ('' if q == 'maj' else 'm'), pc] for pc, q in chords], 'beats_in_loop': int(len(seg_beats)),
    }


out = []
for p in sorted(pathlib.Path(sys.argv[1]).glob('*.wav')):
    try:
        r = analyse(p)
    except Exception as e:  # keep going
        r = {'file': p.name, 'error': str(e)}
    out.append(r)
    print(json.dumps({k: v for k, v in r.items() if k not in ('kick', 'snare', 'hat')}))
json.dump(out, open(sys.argv[2], 'w'), indent=1)
