"""Records the promo narration and mixes it over the music, lowering the music while the narrator speaks. Each line
starts with its scene (see stage.js) and must end before the next one.

    python3 promo/voiceover.py                      → promo/out/soundtrack.wav

The voice is Piper, a local neural text-to-speech that sounds like a real person, when it is set up:

    python3 -m venv promo/.venv && promo/.venv/bin/pip install piper-tts
    curl -L --create-dirs -o promo/voices/en_US-lessac-high.onnx \
      https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/high/en_US-lessac-high.onnx
    curl -L --create-dirs -o promo/voices/en_US-lessac-high.onnx.json \
      https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/high/en_US-lessac-high.onnx.json

PIPER_MODEL picks another Piper voice. Without Piper it falls back to macOS say: VOICE="Ava (Premium)" picks any
installed voice (System Settings → Accessibility → Spoken Content → System voice → Manage Voices).
"""
import glob
import os
import subprocess
import sys
import tempfile
import wave

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')
PIPER = os.path.join(HERE, '.venv', 'bin', 'piper')
PIPER_MODEL = os.environ.get('PIPER_MODEL', os.path.join(HERE, 'voices', 'en_US-lessac-high.onnx'))
ENGINE = 'piper' if os.path.exists(PIPER) and os.path.exists(PIPER_MODEL) and 'VOICE' not in os.environ else 'say'
VOICE = os.environ.get('VOICE', 'Samantha') if ENGINE == 'say' else os.path.basename(PIPER_MODEL).removesuffix('.onnx')
RATE = int(os.environ.get('RATE', '172'))  # words per minute (say)
PACE = float(os.environ.get('PACE', '0.92'))  # Piper length scale: below 1 speaks a little faster
PIPER_DIR = next(iter(glob.glob(os.path.join(HERE, '.venv', 'lib', 'python*', 'site-packages', 'piper'))), HERE)
PIPER_SCRIPT = '''
import sys, wave
from piper import PiperVoice, SynthesisConfig
voice = PiperVoice.load(sys.argv[1], espeak_data_dir='espeak-ng-data')
with wave.open(sys.argv[2], 'wb') as out:
    voice.synthesize_wav(sys.stdin.read(), out, syn_config=SynthesisConfig(length_scale=float(sys.argv[3])))
'''

# (starts at, must end by, words). Times are seconds in the 30-second video.
LINES = [
    # The hook: the chore Samestate removes, then the answer.
    (0.45, 3.55, 'Still testing your site, one device at a time?'),
    (4.10, 7.40, 'Meet Samestate. Every screen, side by side.'),
    (7.70, 11.10, 'Click once, and every screen follows.'),
    (11.45, 14.90, 'Even when the layout changes, like dark mode.'),
    (15.25, 18.60, 'Catch what breaks, before your users do.'),
    (19.05, 22.30, 'Compare pages, side by side.'),
    (22.80, 23.70, 'Themes.'),
    (23.75, 24.65, 'Video.'),
    (24.70, 25.55, 'Notes.'),
    (25.60, 26.45, 'Reports.'),
    (26.75, 29.70, 'Samestate. One interaction. Every device.'),
]


def find_ffmpeg():
    """ffmpeg on the PATH, or where Homebrew installs it (some shells leave Homebrew off the PATH)."""
    import shutil
    for candidate in (shutil.which('ffmpeg'), '/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg'):
        if candidate and os.path.exists(candidate):
            return candidate
    sys.exit('ffmpeg not found. Install it with: brew install ffmpeg')


FFMPEG = find_ffmpeg()


def check_voice():
    """say quietly falls back to the default voice for a name it does not know, so check the name first."""
    import re
    listing = subprocess.run(['say', '-v', '?'], capture_output=True, text=True).stdout
    voices = [m.groups() for m in (re.match(r'^(.*?)\s+([a-z]{2,3}_[A-Za-z0-9]+)\s+#', line) for line in listing.splitlines()) if m]
    names = [name for name, _ in voices]
    if VOICE not in names:
        english = sorted({name for name, locale in voices if locale.startswith('en_')})
        sys.exit(f'The voice "{VOICE}" is not installed.\n'
                 'Install it in System Settings → Accessibility → Spoken Content (called Read & Speak on newer macOS)\n'
                 '→ System voice → Manage Voices → English (US), wait for the download to finish, then run this again.\n'
                 'Installed English voices: ' + ', '.join(english))


def run(*args):
    if args[0] == 'ffmpeg':
        args = (FFMPEG,) + args[1:]
    subprocess.run(args, check=True, capture_output=True)


def duration(path):
    with wave.open(path) as w:
        return w.getnframes() / w.getframerate()


def speak(text, path, speed):
    """speed: words per minute for say, length scale for Piper."""
    raw = path + '.raw.wav'
    if ENGINE == 'piper':
        # Piper's bundled espeak cannot open its data under a long absolute path, so it is run from its own folder
        # and given the data folder by a relative path.
        subprocess.run([os.path.join(HERE, '.venv', 'bin', 'python'), '-I', '-c', PIPER_SCRIPT, PIPER_MODEL, raw, f'{speed:.3f}'],
                       input=text, text=True, check=True, capture_output=True, cwd=PIPER_DIR)
    else:
        run('say', '-v', VOICE, '-r', str(speed), '-o', raw + '.aiff', text)
        raw += '.aiff'
    # 48 kHz stereo; a little high-pass and compression so the voice sits clearly over the music.
    run('ffmpeg', '-y', '-loglevel', 'error', '-i', raw, '-af',
        'highpass=f=90,acompressor=threshold=-20dB:ratio=3:attack=5:release=80,silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse',
        '-ar', '48000', '-ac', '2', path)
    os.remove(raw)


def main():
    if ENGINE == 'say':
        check_voice()
    work = tempfile.mkdtemp(prefix='samestate-voice-')
    clips = []
    for i, (start, end, text) in enumerate(LINES):
        path = os.path.join(work, f'line{i}.wav')
        speed = PACE if ENGINE == 'piper' else RATE
        speak(text, path, speed)
        # Speed up a line that runs past its scene, a little at a time.
        while start + duration(path) > end:
            if ENGINE == 'piper' and speed > PACE * 0.75:
                speed -= 0.04
            elif ENGINE == 'say' and speed < RATE * 1.35:
                speed += 8
            else:
                break
            speak(text, path, speed)
        length = duration(path)
        flag = '' if start + length <= end else '  (still runs over)'
        shown = f'pace {speed:.2f}' if ENGINE == 'piper' else f'{speed} wpm'
        print(f'{start:5.2f}s  {length:4.2f}s  {shown}  {text}{flag}')
        clips.append((start, path))

    # One narration track: every line delayed to its start.
    inputs, labels, chains = [], [], []
    for i, (start, path) in enumerate(clips):
        inputs += ['-i', path]
        ms = int(start * 1000)
        chains.append(f'[{i}:a]adelay={ms}|{ms}[v{i}]')
        labels.append(f'[v{i}]')
    voice = os.path.join(OUT, 'voice.wav')
    run('ffmpeg', '-y', '-loglevel', 'error', *inputs, '-filter_complex',
        ';'.join(chains) + f';{"".join(labels)}amix=inputs={len(clips)}:normalize=0,apad=whole_dur=30[v]',
        '-map', '[v]', '-t', '30', '-ar', '48000', voice)

    # The narration is brought to a steady level. The music dips by DUCK_DB under each line, with short fades, and
    # comes back up between lines; then both are mixed and brought to streaming loudness.
    import numpy as np
    level = os.path.join(work, 'voice-level.wav')
    music48 = os.path.join(work, 'music48.wav')
    run('ffmpeg', '-y', '-loglevel', 'error', '-i', voice, '-af', 'loudnorm=I=-16:TP=-2:LRA=7,aresample=48000', '-ac', '2', '-t', '30', level)
    run('ffmpeg', '-y', '-loglevel', 'error', '-i', os.path.join(OUT, 'music.wav'), '-ar', '48000', '-ac', '2', '-t', '30', music48)

    def load(path):
        with wave.open(path) as w:
            raw = w.readframes(w.getnframes())
            kind = '<i2' if w.getsampwidth() == 2 else '<i4'
            data = np.frombuffer(raw, dtype=kind).astype(np.float64) / (2 ** (8 * w.getsampwidth() - 1))
            return data.reshape(-1, w.getnchannels())

    v, m = load(level), load(music48)
    n = min(len(v), len(m))
    v, m = v[:n], m[:n]
    sr = 48000
    duck = 10 ** (-float(os.environ.get('DUCK_DB', '14')) / 20)
    gain = np.ones(n)
    fade = int(0.12 * sr)
    for start, path in clips:
        a = max(0, int((start - 0.1) * sr))
        b = min(n, int((start + duration(path) + 0.18) * sr))
        gain[a:b] = np.minimum(gain[a:b], duck)
        ramp_in = np.linspace(1, duck, fade)
        ramp_out = np.linspace(duck, 1, fade)
        gain[max(0, a - fade):a] = np.minimum(gain[max(0, a - fade):a], ramp_in[-len(gain[max(0, a - fade):a]):])
        gain[b:b + fade] = np.minimum(gain[b:b + fade], ramp_out[:len(gain[b:b + fade])])
    mix = m * 0.5 * gain[:, None] + v
    mixed = os.path.join(work, 'mixed.wav')
    with wave.open(mixed, 'wb') as out:
        out.setnchannels(2)
        out.setsampwidth(2)
        out.setframerate(sr)
        out.writeframes((np.clip(mix / max(1.0, np.max(np.abs(mix))), -1, 1) * 32767).astype('<i2').tobytes())
    run('ffmpeg', '-y', '-loglevel', 'error', '-i', mixed, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000', '-t', '30', soundtrack := os.path.join(OUT, 'soundtrack.wav'))
    db = lambda x: 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9)
    for start, path in clips[:3]:
        a, b = int(start * sr), int((start + duration(path)) * sr)
        print(f'  at {start:5.2f}s the voice is {db(v[a:b]) - db((m * 0.5 * gain[:, None])[a:b]):4.1f} dB above the music')
    print('wrote', soundtrack, 'with voice', VOICE)


if __name__ == '__main__':
    sys.exit(main())
