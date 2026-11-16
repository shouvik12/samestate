"""Synthesizes the promo soundtrack: 30 seconds of upbeat electronic music at 128 BPM (16 bars), original and
royalty-free because every sound is generated here.

    python3 promo/music.py promo/out/music.wav

Bars 1-2 intro and riser, drop on bar 3, groove to bar 12, a lift in bars 13-14, final hit on bar 15, tail on 16.
The video cuts on the same bar lines (see stage.js).
"""
import os
import sys
import wave
import numpy as np

SR = 44100
BPM = 128
BEAT = 60 / BPM
BAR = BEAT * 4
LENGTH = 30.0
N = int(SR * LENGTH)
rng = np.random.default_rng(7)

def t_of(seconds):
    return np.arange(int(SR * seconds)) / SR

def place(track, sound, at):
    start = int(at * SR)
    end = min(len(track), start + len(sound))
    if start < len(track):
        track[start:end] += sound[:end - start]

def lowpass(signal, cutoff):
    spectrum = np.fft.rfft(signal)
    freqs = np.fft.rfftfreq(len(signal), 1 / SR)
    spectrum *= 1 / np.sqrt(1 + (freqs / cutoff) ** 4)
    return np.fft.irfft(spectrum, len(signal))

def highpass(signal, cutoff):
    return signal - lowpass(signal, cutoff)

def note(name):
    names = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11}
    pitch, octave = name[:-1], int(name[-1])
    return 440 * 2 ** ((names[pitch] + (octave - 4) * 12 - 9) / 12)

def saw(freq, seconds, detune=0.0, phase=0.0):
    t = t_of(seconds)
    f = freq * (1 + detune)
    return 2 * ((t * f + phase) % 1) - 1

def envelope(length, attack, decay, sustain, release):
    n = length
    env = np.ones(n) * sustain
    a, d, r = int(attack * SR), int(decay * SR), int(release * SR)
    a = max(a, 1)
    env[:a] = np.linspace(0, 1, a)
    if d:
        env[a:a + d] = np.linspace(1, sustain, len(env[a:a + d]))
    if r and r < n:
        env[-r:] *= np.linspace(1, 0, r)
    return env

# ---------------------------------------------------------------- drums
def kick():
    t = t_of(0.45)
    freq = 45 + 110 * np.exp(-t * 28)
    body = np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-t * 7)
    click = rng.standard_normal(len(t)) * np.exp(-t * 400) * 0.25
    return np.tanh((body + click) * 1.6)

def clap():
    t = t_of(0.3)
    noise = rng.standard_normal(len(t))
    band = highpass(lowpass(noise, 2400), 900)
    bursts = np.zeros(len(t))
    for offset in (0, 0.011, 0.022):
        s = int(offset * SR)
        bursts[s:] += np.exp(-np.arange(len(t) - s) / SR * 30)
    return band * bursts * 0.6 + np.sin(2 * np.pi * 190 * t) * np.exp(-t * 40) * 0.25

def hat(open_=False):
    t = t_of(0.25 if open_ else 0.06)
    noise = highpass(rng.standard_normal(len(t)), 7000)
    return noise * np.exp(-t * (14 if open_ else 70)) * (0.35 if open_ else 0.25)

def snare_roll(start, bars, track):
    steps = int(bars * 16)
    for i in range(steps):
        step = i / steps
        density = 1 if step < 0.5 else 2
        for sub in range(density):
            at = start + (i + sub / density) * BEAT / 4
            place(track, clap() * (0.25 + 0.75 * step), at)

# ---------------------------------------------------------------- harmony
# Am - F - C - G, one chord per bar.
CHORDS = [['A3', 'C4', 'E4'], ['F3', 'A3', 'C4'], ['C4', 'E4', 'G4'], ['G3', 'B3', 'D4']]
BASS = ['A1', 'F1', 'C2', 'G1']

def supersaw_chord(names, seconds):
    out = np.zeros(int(SR * seconds))
    for name in names:
        f = note(name)
        for d in (-0.012, -0.006, 0, 0.006, 0.012):
            out += saw(f, seconds, d, rng.random())
    return out / (len(names) * 5)

def pluck(freq, seconds=0.22, bright=5200):
    t = t_of(seconds)
    tone = (saw(freq, seconds) * 0.6 + np.sign(np.sin(2 * np.pi * freq * t)) * 0.4)
    return lowpass(tone, bright) * np.exp(-t * 16)

def sidechain(length, bars_start, bars_end, depth=0.75):
    """Ducks on every beat, the classic pumping feel under the kick."""
    gain = np.ones(length)
    beat_n = int(BEAT * SR)
    curve = 1 - depth * np.exp(-np.arange(beat_n) / SR * 9)
    start = int(bars_start * BAR * SR)
    end = int(bars_end * BAR * SR)
    for b in range(start, end, beat_n):
        seg = gain[b:min(end, b + beat_n)]
        seg *= curve[:len(seg)]
    return gain

# ---------------------------------------------------------------- arrangement
drums = np.zeros(N); chords = np.zeros(N); bass = np.zeros(N); arp = np.zeros(N); fx = np.zeros(N)

GROOVE = range(2, 14)    # bars 3-14 (0-based 2..13)
for bar in range(16):
    t0 = bar * BAR
    chord = CHORDS[bar % 4]
    if bar in GROOVE:
        for beat in range(4):
            place(drums, kick() * 0.95, t0 + beat * BEAT)
            place(drums, hat(open_=True) * 0.7, t0 + beat * BEAT + BEAT / 2)
            for s in range(4):
                if s != 2:
                    place(drums, hat() * (0.8 if s % 2 else 0.5), t0 + beat * BEAT + s * BEAT / 4)
        place(drums, clap(), t0 + BEAT)
        place(drums, clap(), t0 + 3 * BEAT)
        # Bass: offbeat eighths with a sub on the downbeat.
        f = note(BASS[bar % 4])
        for eighth in range(8):
            at = t0 + eighth * BEAT / 2
            length = BEAT / 2 * 0.9
            t = t_of(length)
            tone = lowpass(saw(f * (2 if eighth % 2 else 1), length), 900) * 0.7 + np.sin(2 * np.pi * f * t) * 0.6
            place(bass, tone * envelope(len(t), 0.004, 0.05, 0.8, 0.03) * (0.9 if eighth % 2 else 0.6), at)
    # Chords: whole bar pads, opening the filter through the intro.
    pad = supersaw_chord(chord, BAR)
    if bar < 2:
        pad = lowpass(pad, 500 + bar * 900)
    elif bar >= 14:
        pad = lowpass(pad, 6000)
    else:
        pad = lowpass(pad, 4200)
    place(chords, pad * envelope(len(pad), 0.02, 0.0, 1.0, 0.05), t0)
    # Arp: sixteenth-note plucks over the chord tones, one octave up.
    tones = [note(n[:-1] + str(int(n[-1]) + 1)) for n in chord] + [note(chord[0][:-1] + str(int(chord[0][-1]) + 2))]
    pattern = [0, 1, 2, 3, 2, 1, 2, 3, 0, 2, 1, 3, 2, 1, 3, 2]
    for s in range(16):
        bright = 1200 + bar * 600 if bar < 2 else 5200
        place(arp, pluck(tones[pattern[s]], bright=bright) * (0.55 if bar < 2 else 0.8), t0 + s * BEAT / 4)

# Sidechain the pads and arp under the kick through the groove.
duck = sidechain(N, 2, 14)
chords *= duck
arp *= 0.6 + 0.4 * duck

# Riser into the drop (bars 1-2) and into the end card (bars 13-14), with snare rolls.
for start_bar, bars in ((0, 2), (12, 2)):
    t = t_of(bars * BAR)
    progress = t / t[-1]
    noise = rng.standard_normal(len(t))
    sweep = np.zeros(len(t))
    chunk = int(0.1 * SR)
    for i in range(0, len(t), chunk):
        cutoff = 400 + 9000 * progress[i] ** 2
        sweep[i:i + chunk] = lowpass(noise[i:i + chunk + 2000], cutoff)[:len(sweep[i:i + chunk])]
    tone = np.sin(2 * np.pi * np.cumsum(220 + 880 * progress ** 2) / SR) * 0.15
    place(fx, (sweep * 0.5 + tone) * progress ** 2, start_bar * BAR)
snare_roll(1 * BAR, 1, drums)
snare_roll(13 * BAR, 1, drums)

# Impacts on the drop (bar 3) and the end card (bar 15).
for at in (2 * BAR, 14 * BAR):
    t = t_of(2.5)
    boom = np.sin(2 * np.pi * np.cumsum(30 + 60 * np.exp(-t * 6)) / SR) * np.exp(-t * 2.2)
    crash = highpass(rng.standard_normal(len(t)), 3000) * np.exp(-t * 2.5) * 0.35
    place(fx, boom * 0.9 + crash, at)
    place(drums, kick(), at)

# End: bar 15 holds a bright chord with the arp, bar 16 rings out.
end_chord = supersaw_chord(['A3', 'C4', 'E4', 'A4'], 2 * BAR)
end_chord = lowpass(end_chord, 5000) * np.linspace(1, 0, len(end_chord)) ** 1.5
place(chords, end_chord * 1.2, 14 * BAR)

# ---------------------------------------------------------------- mix
def reverb(signal, seconds=1.6, mix=0.25):
    ir_t = t_of(seconds)
    ir = rng.standard_normal(len(ir_t)) * np.exp(-ir_t * 3.2)
    ir = lowpass(ir, 6000)
    size = len(signal) + len(ir)
    wet = np.fft.irfft(np.fft.rfft(signal, size) * np.fft.rfft(ir, size), size)[:len(signal)]
    wet /= np.max(np.abs(wet)) + 1e-9
    return signal * (1 - mix) + wet * mix * np.max(np.abs(signal))

def echo(signal, delay, feedback=0.35, taps=4):
    out = signal.copy()
    d = int(delay * SR)
    for k in range(1, taps + 1):
        out[d * k:] += signal[:-d * k] * feedback ** k
    return out

arp_l = echo(arp, BEAT * 0.75)
arp_r = echo(np.roll(arp, int(BEAT * 0.375 * SR)), BEAT * 0.75)
chords_v = reverb(chords, mix=0.3)
fx_v = reverb(fx, 2.2, 0.35)

def norm(x):
    return x / (np.max(np.abs(x)) + 1e-9)

left = norm(drums) * 0.9 + norm(bass) * 0.75 + norm(chords_v) * 0.5 + norm(arp_l) * 0.32 + norm(fx_v) * 0.45
right = norm(drums) * 0.9 + norm(bass) * 0.75 + norm(chords_v) * 0.5 + norm(arp_r) * 0.32 + norm(fx_v) * 0.45
stereo = np.stack([left, right], axis=1)
stereo = np.tanh(stereo * 1.4)          # gentle saturation for loudness
fade = int(0.6 * SR)
stereo[-fade:] *= np.linspace(1, 0, fade)[:, None]
stereo /= np.max(np.abs(stereo)) / 0.89  # about -1 dBFS

os.makedirs(os.path.dirname(os.path.abspath(sys.argv[1])), exist_ok=True)  # promo/out/ is not in git
with wave.open(sys.argv[1], 'wb') as out:
    out.setnchannels(2)
    out.setsampwidth(2)
    out.setframerate(SR)
    out.writeframes((stereo * 32767).astype('<i2').tobytes())
print('wrote', sys.argv[1], f'{LENGTH:.0f}s at {BPM} BPM')
