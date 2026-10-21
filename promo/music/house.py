"""Deep-house bed for the v2 promo, synthesised from scratch (no samples, no licences).

Modelled on the reference's measured profile: ~127 bpm, sub-heavy (about half the
energy under 100 Hz), dark top end, F# minor, a boom on the first frame, a short
build, and the full groove dropping on the cut to the light stage (3.0 s).

Four-on-the-floor kick, sidechained sub bass, clap on 2 and 4, offbeat open hats,
16th shaker, jazzy minor-9 chord stabs (the "jazzier, not jazz" part) with reverb,
a riser into the drop and a filtered tail on the end card.

    python music/house.py public/house.wav
"""
import sys
import wave

import numpy as np
from scipy import signal

SR = 48000
BPM = 127.0
BEAT = 60 / BPM
DUR = 20.4
DROP = 3.0            # first downbeat of the groove (the mint wipe)
DROP2 = DROP + 3 * 4 * 60 / 127.0  # bass drop three bars later (8.67 s), on the "Receipt read" card
END_CARD = 18.5       # filter down for the end card
N = int(SR * DUR)
rng = np.random.default_rng(11)

L = np.zeros(N)
R = np.zeros(N)
kick_times = []


def add(sig, t, pan=0.0, gain=1.0, dest=None):
    i = int(round(t * SR))
    if i < 0 or i >= N:
        return
    sig = sig[: N - i] * gain
    l, r = (dest if dest is not None else (L, R))
    l[i : i + len(sig)] += sig * np.sqrt((1 - pan) / 2)
    r[i : i + len(sig)] += sig * np.sqrt((1 + pan) / 2)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def tt(sec):
    return np.arange(int(SR * sec)) / SR


def lp(x, hz, order=2):
    return signal.sosfilt(signal.butter(order, hz, "low", fs=SR, output="sos"), x)


def hp(x, hz, order=2):
    return signal.sosfilt(signal.butter(order, hz, "high", fs=SR, output="sos"), x)


def bp(x, lo, hi):
    return signal.sosfilt(signal.butter(2, [lo, hi], "band", fs=SR, output="sos"), x)


# ---------------------------------------------------------------- instruments

def kick(vel=1.0):
    t = tt(0.45)
    f = 46 + 110 * np.exp(-t * 32)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7.5)
    click = hp(rng.standard_normal(len(t)), 2500) * np.exp(-t * 300) * 0.25
    return np.tanh((body + click) * 1.8) * vel


def clap(vel=1.0):
    n = np.zeros(int(SR * 0.35))
    for k, d in enumerate((0.0, 0.011, 0.022)):
        i = int(d * SR)
        burst = rng.standard_normal(len(n) - i) * np.exp(-np.arange(len(n) - i) / SR * (90 if k < 2 else 16))
        n[i:] += burst
    return bp(n, 900, 2600) * vel


def hat(open_=False, vel=1.0):
    t = tt(0.25 if open_ else 0.06)
    return lp(hp(rng.standard_normal(len(t)), 3800), 9000) * np.exp(-t * (14 if open_ else 70)) * vel


def shaker(vel=1.0):
    t = tt(0.08)
    env = np.minimum(1, t / 0.012) * np.exp(-t * 45)
    return bp(rng.standard_normal(len(t)), 4500, 11000) * env * vel


def sub(note, length, vel=1.0):
    t = tt(length)
    f = midi(note)
    x = np.sin(2 * np.pi * f * t) + 0.18 * np.sin(2 * np.pi * 2 * f * t) + 0.06 * np.sin(2 * np.pi * 3 * f * t)
    env = np.minimum(1, t / 0.006) * np.clip((length - t) / 0.02, 0, 1)
    return x * env * vel


def stab(notes, length=0.32, vel=1.0, cutoff=2600):
    """Deep-house chord stab: detuned saw-ish voices, plucky envelope, low-passed."""
    t = tt(length + 0.25)
    out = np.zeros(len(t))
    for n in notes:
        for det in (-0.07, 0.07):
            f = midi(n + det)
            saw = sum(np.sin(2 * np.pi * k * f * t) / k for k in range(1, 9))
            out += saw
    env = np.minimum(1, t / 0.004) * np.exp(-t * 6.5) * np.clip((length + 0.25 - t) / 0.05, 0, 1)
    return lp(out * env, cutoff, 2) / len(notes) * vel


def pluck(note, vel=1.0):
    t = tt(0.22)
    f = midi(note)
    x = sum(np.sin(2 * np.pi * k * f * t) * (0.6 ** k) for k in range(1, 6))
    return lp(x * np.exp(-t * 18) * np.minimum(1, t / 0.002), 4200) * vel


def rhodes(notes, length, vel=1.0):
    t = tt(length)
    out = np.zeros(len(t))
    for n in notes:
        f = midi(n)
        mod = np.sin(2 * np.pi * f * 14 * t) * np.exp(-t * 16) * 1.3
        out += np.sin(2 * np.pi * f * t + mod) * (1 + 0.1 * np.sin(2 * np.pi * 5 * t))
    env = np.minimum(1, t / 0.005) * np.exp(-t * 1.2) * np.clip((length - t) / 0.1, 0, 1)
    return out * env / len(notes) * vel


def reverb(x, seconds=1.8, mix=0.25):
    ir_t = tt(seconds)
    ir = rng.standard_normal(len(ir_t)) * np.exp(-ir_t * 3.2)
    ir = lp(ir, 5000)
    ir /= np.sqrt(np.sum(ir ** 2))
    wet = signal.fftconvolve(x, ir)[: len(x)]
    return x * (1 - mix) + wet * mix * 1.4


# ---------------------------------------------------------------- arrangement
# F# minor: F#m9 - Dmaj9 - Bm9 - C#m7 (i - VI - iv - v), one chord per bar.
CHORDS = [
    [57, 61, 64, 68],   # F#m9 voicing: A C# E G#
    [57, 61, 64, 66],   # Dmaj9: A C# E F#  (over D)
    [57, 61, 62, 66],   # Bm9: A C# D F#
    [56, 59, 61, 64],   # C#m7: G# B C# E
]
ROOTS = [30, 26, 23, 25]   # F#1, D1, B0, C#1
BASS_RHYTHM = [(0.0, 0.40), (0.75, 0.22), (1.5, 0.35), (2.5, 0.22), (2.75, 0.22), (3.5, 0.35)]  # (beat, length in beats)

chords_l = np.zeros(N)
chords_r = np.zeros(N)
bar = 4 * BEAT
first_bar = DROP - bar * 2       # two bars before the drop belong to the intro/build
n_bars = int((DUR - first_bar) / bar) + 1

# Intro: boom on frame one, filtered Rhodes pad, kicks thinning in.
boom_t = tt(1.6)
boom = np.sin(2 * np.pi * np.cumsum(38 + 60 * np.exp(-boom_t * 6)) / SR) * np.exp(-boom_t * 2.2)
add(np.tanh(boom * 2.6) * 1.3, 0.02)
add(lp(rng.standard_normal(len(boom_t)), 900) * np.exp(-boom_t * 5) * 0.25, 0.02)
add(reverb(rhodes(CHORDS[0], 3.0, 1.1), 2.4, 0.4), 0.05, dest=(chords_l, chords_r))
add(reverb(stab([n - 12 for n in CHORDS[0]], 1.2, 1.4, 1400), 2.2, 0.4), 0.05, dest=(chords_l, chords_r))

for b in range(n_bars):
    start = first_bar + b * bar
    if start >= DUR:
        break
    ci = b % 4
    in_build = start < DROP - 1e-6
    for k in range(4):
        tb = start + k * BEAT
        if tb < 0.05 or tb >= DUR:
            continue
        # Kick: from 1.6 s in the build (the "Lost/Faded/Forgotten" punches), always after the drop.
        full = tb >= DROP2 - 1e-6
        if not in_build or tb >= 1.55:
            if tb < END_CARD + 0.6:
                add(kick(0.8 if full else 0.55), tb)
                kick_times.append(tb)
        if not in_build:
            if k in (1, 3):
                add(reverb(clap(1.0), 0.6, 0.2), tb, pan=0.05)
            add(hat(True, 0.36), tb + BEAT / 2, pan=0.35)
            for s in range(4):
                add(hat(False, 0.13 if s % 2 else 0.07), tb + s * BEAT / 4, pan=-0.35)
                add(shaker(0.05 if s % 2 else 0.03), tb + s * BEAT / 4, pan=0.3)
            # Bright plucked arpeggio in the lighter section (3 s to the bass drop), like the reference's breakdown.
            if not full:
                tones = CHORDS[ci]
                for s in range(4):
                    add(pluck(tones[(k * 4 + s) % len(tones)] + 12, 0.30), tb + s * BEAT / 4, pan=0.25 if s % 2 else -0.25, dest=(chords_l, chords_r))
    if not in_build:
        # Sub bass pattern, from the drop on the read card.
        if start >= DROP2 - 1e-6:
            for beat, length in BASS_RHYTHM:
                add(sub(ROOTS[ci] + (12 if beat == 2.5 else 0), length * BEAT, 0.34), start + beat * BEAT)
        # Chord stabs: offbeat of 1, the "and" of 2, and a push into the next bar.
        for beat, vel in ((0.5, 1.55), (1.75, 1.2), (3.5, 1.4)):
            st = stab(CHORDS[ci], 0.28, vel, cutoff=2600 + 1200 * (b % 2))
            add(st, start + beat * BEAT, pan=0.2 if beat != 1.75 else -0.2, dest=(chords_l, chords_r))
        # A soft Rhodes bed under the stabs, every other bar.
        if b % 2 == 0:
            add(rhodes([n + 12 for n in CHORDS[ci][1:]], bar * 1.9, 0.35), start, pan=-0.15, dest=(chords_l, chords_r))

# Build into the drop: noise riser and a snare-ish roll.
rise_len = 1.35
rt = tt(rise_len)
riser = hp(rng.standard_normal(len(rt)), 1500) * (rt / rise_len) ** 2.2
add(riser * 0.22, DROP - rise_len)
for i, tb in enumerate(np.arange(DROP - 2 * BEAT, DROP - 0.01, BEAT / 4)):
    add(clap(0.12 + 0.03 * i), tb)
# Impact on the wipe, and a one-bar riser plus impact into the bass drop.
add(np.tanh(boom * 1.8) * 0.45, DROP)
rt2 = tt(bar)
add(hp(rng.standard_normal(len(rt2)), 2500) * (rt2 / bar) ** 2.5 * 0.16, DROP2 - bar)
add(np.tanh(boom * 1.8) * 0.5, DROP2)

# Reverb on the chord bus, then sidechain everything musical to the kick.
chords_l = reverb(chords_l, 2.0, 0.3)
chords_r = reverb(chords_r, 2.1, 0.3)
t_all = np.arange(N) / SR
duck = np.ones(N)
for k in kick_times:
    i = int(k * SR)
    seg = t_all[i:] - k
    duck[i:] = np.minimum(duck[i:], 1 - 0.65 * np.exp(-seg / 0.11))
L += chords_l * duck
R += chords_r * duck

# Sub bass was mixed straight into L/R; give it the same pump by re-ducking the low band.
low_l, low_r = lp(L, 140), lp(R, 140)
L = L - low_l + low_l * (0.55 + 0.45 * duck)
R = R - low_r + low_r * (0.55 + 0.45 * duck)

# End card: filter the whole mix down and let it ring.
mix = np.stack([L, R], axis=1)
e = int(END_CARD * SR)
tail = mix[e:].copy()
cut = np.linspace(1, 0, len(tail)) ** 1.5
mix[e:] = np.stack([lp(tail[:, 0], 600) * (1 - cut) + tail[:, 0] * cut, lp(tail[:, 1], 600) * (1 - cut) + tail[:, 1] * cut], axis=1)

# Master: gentle glue, soft clip, fades.
mix = np.tanh(mix * 1.3) / 1.3
mix *= np.clip(np.arange(N) / (SR * 0.01), 0, 1)[:, None]
mix *= np.clip((DUR - np.arange(N) / SR) / 1.2, 0, 1)[:, None]
mix /= np.max(np.abs(mix)) * 1.1

path = sys.argv[1] if len(sys.argv) > 1 else "house.wav"
with wave.open(path, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype("<i2").tobytes())
print(f"{path}: {DUR}s at {BPM} bpm, drop at {DROP}s, {len(kick_times)} kicks")
