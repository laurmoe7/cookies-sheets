"""Brings every sound in web/sounds/ to about the same loudness (average level of the part that is actually sound).

Usage: python tools/normalize_sounds.py [target dBFS, default -19]
Each file keeps its format and sample rate. A little soft clipping catches the occasional peak, so quiet files can be
raised a lot without distortion. Run it after adding a new sound, then play it once to check.
"""
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

SOUNDS = Path(__file__).resolve().parent.parent / 'web' / 'sounds'
SUBTYPE = {'.ogg': ('OGG', 'VORBIS'), '.mp3': ('MP3', 'MPEG_LAYER_III')}


def active_rms_db(x):
    """Average level in dBFS of the samples louder than -50 dB (so silence does not drag it down)."""
    m = x.mean(axis=1)
    act = m[np.abs(m) > 10 ** (-50 / 20)]
    return 20 * np.log10(np.sqrt((act ** 2).mean()) + 1e-9) if len(act) else -99.0


def main(target=-19.0):
    for f in sorted(SOUNDS.iterdir()):
        if f.suffix.lower() not in SUBTYPE:
            continue
        x, sr = sf.read(f, always_2d=True)
        before = active_rms_db(x)
        y = x * 10 ** ((target - before) / 20)
        y = np.tanh(y / 0.95) * 0.95  # soft ceiling, so peaks never clip
        fmt, sub = SUBTYPE[f.suffix.lower()]
        sf.write(f, y, sr, format=fmt, subtype=sub)
        print(f'{f.name:18} {before:6.1f} dB -> {active_rms_db(sf.read(f, always_2d=True)[0]):6.1f} dB')


if __name__ == '__main__':
    main(float(sys.argv[1]) if len(sys.argv) > 1 else -19.0)
