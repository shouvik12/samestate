"""Build the narrated 30-second showcase with the same natural AI voice as the app.

python promo/voiceover.py --model /path/to/kokoro-v1.0.onnx --voices /path/to/voices-v1.0.bin
Needs the build-only kokoro-onnx, soundfile and ffmpeg dependencies. See showcase.json
for scene timing and narration. No voice model or build dependency ships in the app.
"""
import argparse
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

import numpy as np
import onnxruntime as ort
import soundfile as sf
from kokoro_onnx import Kokoro

HERE = Path(__file__).resolve().parent


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--model', required=True)
    parser.add_argument('--voices', required=True)
    parser.add_argument('--story', default=str(HERE / 'showcase.json'), help='showcase.json (scenes) or motion.json (cues)')
    parser.add_argument('--ffmpeg', default=shutil.which('ffmpeg') or '/opt/homebrew/bin/ffmpeg')
    args = parser.parse_args()
    story = json.loads(Path(args.story).read_text())
    output = HERE / 'out'; output.mkdir(exist_ok=True)
    if not (output / 'music.wav').exists():
        subprocess.run([sys.executable, str(HERE / 'music.py'), str(output / 'music.wav')], check=True)
    music_file = output / story.get('music', 'music.wav')
    if 'musicLoop' in story:
        # A longer bed from the same track: the intro, a bar-aligned section repeated, then the ending.
        loop = story['musicLoop']
        base, base_rate = sf.read(output / 'music.wav')
        cut = lambda a, b: base[int(a * base_rate):int(b * base_rate)]
        parts = [cut(*loop['intro'])] + [cut(*loop['loop'])] * loop['times'] + [cut(*loop['outro'])]
        fade = int(.012 * base_rate)  # a short crossfade at each join keeps decaying notes from clicking
        bed = parts[0]
        for part in parts[1:]:
            ramp = np.linspace(0, 1, fade)[:, None] if bed.ndim == 2 else np.linspace(0, 1, fade)
            bed = np.concatenate([bed[:-fade], bed[-fade:] * (1 - ramp) + part[:fade] * ramp, part[fade:]])
        sf.write(music_file, bed, base_rate)
    options = ort.SessionOptions(); options.intra_op_num_threads = 4; options.inter_op_num_threads = 1
    model = Kokoro.from_session(ort.InferenceSession(args.model, sess_options=options, providers=['CPUExecutionProvider']), args.voices)
    rate = 24000
    narration = np.zeros(int(story['duration'] * rate), dtype=np.float32)
    spans = []
    for scene in story.get('cues') or story['scenes']:
        text = scene['voice'].replace('Samestate', 'Same state')
        samples, sample_rate = model.create(text, voice=story['voice'], speed=1.0, lang='en-us')
        room = scene['duration'] - .16
        if len(samples) / sample_rate > room:
            speed = min(1.15, len(samples) / sample_rate / room + .02)
            samples, sample_rate = model.create(text, voice=story['voice'], speed=speed, lang='en-us')
        assert sample_rate == rate and len(samples) / rate <= room, 'Shorten the narration for ' + scene.get('id', scene['voice'])
        start = int((scene['start'] + .08) * rate)
        narration[start:start + len(samples)] = samples
        spans.append((start / rate, (start + len(samples)) / rate))
        print(f"{scene.get('id', scene['voice'])}: {len(samples) / rate:.2f}s within {scene['duration']}s", flush=True)
    with tempfile.TemporaryDirectory(prefix='samestate-promo-voice-') as temp:
        temp = Path(temp)
        raw = temp / 'raw.wav'; sf.write(raw, narration, rate)
        voice_path = output / 'voice.wav'; music_path = temp / 'music.wav'
        def run(*parts): subprocess.run([args.ffmpeg, '-y', '-loglevel', 'error', *map(str, parts)], check=True)
        run('-i', raw, '-af', 'highpass=f=70,loudnorm=I=-18:TP=-2:LRA=7', '-ar', 48000, '-ac', 2, voice_path)
        run('-i', music_file, '-ar', 48000, '-ac', 2, music_path)
        voice, sr = sf.read(voice_path); music, _ = sf.read(music_path)
        n = min(len(voice), len(music)); voice, music = voice[:n], music[:n]
        gain = np.ones(n)
        fade = int(.10 * sr)
        for a, b in spans:
            start, end = max(0, int((a - .06) * sr)), min(n, int((b + .12) * sr))
            gain[start:end] = np.minimum(gain[start:end], .25)
            left, right = max(0, start - fade), min(n, end + fade)
            gain[left:start] = np.minimum(gain[left:start], np.linspace(1, .25, start - left))
            gain[end:right] = np.minimum(gain[end:right], np.linspace(.25, 1, right - end))
        mixed = temp / 'mixed.wav'; sf.write(mixed, voice + music * .28 * gain[:, None], sr)
        run('-i', mixed, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=9', '-ar', 48000, '-t', story['duration'], output / story.get('soundtrack', 'soundtrack.wav'))
    print(f"Wrote promo/out/{story.get('soundtrack', 'soundtrack.wav')} with the app’s Kokoro af_heart voice.", flush=True)


if __name__ == '__main__':
    main()
