"""Voiceover with Kokoro (open-source TTS, runs locally), one file per scene.

    voice/.venv/Scripts/python voice/speak.py [voice] [speed]

Writes public/vo-<n>.wav and public/vo.json with each line's duration, which the
video reads to time captions.
"""
import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

HERE = Path(__file__).parent
PUBLIC = HERE.parent / "public"
VOICE = sys.argv[1] if len(sys.argv) > 1 else "af_heart"
SPEED = float(sys.argv[2]) if len(sys.argv) > 2 else 1.05

LINES = [
    "Still keeping receipts in a drawer?",
    "Snap it with LedgerQuarry.",
    "A private AI on your own PC reads the shop, total and tax.",
    "Your spending, sorted. Budgets and all.",
    "Paired by QR over Tailscale. Nothing in the cloud.",
    "LedgerQuarry. Free and open source.",
]

kokoro = Kokoro(str(HERE / "models" / "kokoro-v1.0.onnx"), str(HERE / "models" / "voices-v1.0.bin"))
meta = []
for i, line in enumerate(LINES):
    samples, sr = kokoro.create(line, voice=VOICE, speed=SPEED, lang="en-us" if VOICE.startswith("a") else "en-gb")
    # Trim leading/trailing near-silence so lines land on their cut.
    idx = np.where(np.abs(samples) > 0.01)[0]
    samples = samples[max(idx[0] - int(0.02 * sr), 0) : idx[-1] + int(0.08 * sr)]
    path = PUBLIC / f"vo-{i + 1}.wav"
    sf.write(path, samples, sr)
    meta.append({"file": path.name, "text": line, "seconds": round(len(samples) / sr, 3)})
    print(f"{path.name}: {len(samples) / sr:.2f}s  {line}")
(PUBLIC / "vo.json").write_text(json.dumps({"voice": VOICE, "speed": SPEED, "lines": meta}, indent=1))
