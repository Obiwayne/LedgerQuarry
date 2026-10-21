"""Measures a track like the reference analysis: band energy shares, brightness, tempo, energy per 2 s."""
import sys
import wave
import numpy as np
from scipy import signal

with wave.open(sys.argv[1]) as w:
    sr = w.getframerate(); ch = w.getnchannels()
    x = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(float).reshape(-1, ch).mean(axis=1) / 32768
f, t, Z = signal.stft(x, sr, nperseg=8192, noverlap=8192 - 480)
P = np.abs(Z) ** 2
bands = {"sub": f < 100, "low": (f >= 100) & (f < 300), "mid": (f >= 300) & (f < 2000), "hi": (f >= 2000) & (f < 6000), "air": f >= 6000}
tot = {k: P[m].sum() for k, m in bands.items()}
s = sum(tot.values())
print("energy share", {k: f"{v / s * 100:.1f}%" for k, v in tot.items()})
cent = (f[:, None] * P).sum(0) / (P.sum(0) + 1e-12)
print("mean centroid Hz", int(cent.mean()))
on = np.maximum(0, np.diff(np.log(P[f < 300].sum(0) + 1e-9))) + np.maximum(0, np.diff(np.log(P[f >= 2000].sum(0) + 1e-9)))
dt = t[1] - t[0]
best = max(((bpm, np.dot(on[int(round(60 / bpm / dt)):], on[: -int(round(60 / bpm / dt))]) / len(on)) for bpm in np.arange(70, 180, 0.5)), key=lambda r: r[1])
print("tempo", best[0])
rms = lambda a, b: np.sqrt(np.mean(x[int(a * sr):int(b * sr)] ** 2))
print(" | ".join(f"{a}-{a+2}s {rms(a, a + 2):.3f}" for a in range(1, 21, 2) if a + 2 <= len(x) / sr + 1))
