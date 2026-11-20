#!/usr/bin/env python3
"""Turn source recordings into small, seamless, loudness-matched Opus loops for the app.

Usage: python3 tools/prepare-sounds.py <moodist/public/sounds> <blanket/data/resources/sounds>
Each output loop: 36 s, stereo, 48 kbps Opus, -20 LUFS, tail crossfaded into head (no click at the loop point).
"""
import subprocess, sys, pathlib, numpy as np

M, B = map(pathlib.Path, sys.argv[1:3])
OUT = pathlib.Path(__file__).resolve().parent.parent / 'www' / 'sounds'
SR, LOOP, XF = 48000, 36.0, 3.0

# output name -> source file
SRC = {n: M / p for n, p in {
  'woodpecker': 'animals/woodpecker.mp3', 'crows': 'animals/crows.mp3', 'birds-morning': 'animals/birds.mp3',
  'crickets': 'animals/crickets.mp3', 'frog': 'animals/frog.mp3', 'owl': 'animals/owl.mp3', 'wolf': 'animals/wolf.mp3',
  'seagulls': 'animals/seagulls.mp3', 'whale': 'animals/whale.mp3', 'chickens': 'animals/chickens.mp3',
  'cows': 'animals/cows.mp3', 'sheep': 'animals/sheep.mp3', 'horse': 'animals/horse-gallop.mp3', 'beehive': 'animals/beehive.mp3',
  'dog': 'animals/dog-barking.mp3', 'cat-purring': 'animals/cat-purring.mp3',
  'wind-in-trees': 'nature/wind-in-trees.mp3', 'river': 'nature/river.mp3', 'jungle': 'nature/jungle.mp3', 'campfire': 'nature/campfire.mp3', 'howling-wind': 'nature/howling-wind.mp3',
  'waves-soft': 'nature/waves.mp3', 'waterfall': 'nature/waterfall.mp3', 'droplets': 'nature/droplets.mp3',
  'wind-open': 'nature/wind.mp3',
  'heavy-rain': 'rain/heavy-rain.mp3', 'light-rain': 'rain/light-rain.mp3', 'rain-window': 'rain/rain-on-window.mp3',
  'rain-tent': 'rain/rain-on-tent.mp3', 'rain-leaves': 'rain/rain-on-leaves.mp3',
  'rain-car': 'rain/rain-on-car-roof.mp3', 'thunder': 'rain/thunder.mp3',
  'cafe': 'places/cafe.mp3', 'restaurant': 'places/restaurant.mp3', 'library': 'places/library.mp3',
  'night-village': 'places/night-village.mp3', 'underwater': 'places/underwater.mp3', 'subway': 'places/subway-station.mp3',
  'keyboard': 'things/keyboard.mp3', 'typewriter': 'things/typewriter.mp3', 'paper': 'things/paper.mp3',
  'clock': 'things/clock.mp3', 'vinyl': 'things/vinyl-effect.mp3', 'boiling-water': 'things/boiling-water.mp3',
  'washing-machine': 'things/washing-machine.mp3', 'dryer': 'things/dryer.mp3', 'ceiling-fan': 'things/ceiling-fan.mp3',
  'wind-chimes': 'things/wind-chimes.mp3', 'singing-bowl': 'things/singing-bowl.mp3', 'wipers': 'things/windshield-wipers.mp3',
  'train-inside': 'transport/inside-a-train.mp3', 'airplane': 'transport/airplane.mp3', 'sailboat': 'transport/sailboat.mp3',
  'rowing-boat': 'transport/rowing-boat.mp3', 'submarine': 'transport/submarine.mp3',
  'highway': 'urban/highway.mp3', 'road': 'urban/road.mp3',
}.items()}
SRC.update({n: B / p for n, p in {
  'songbirds': 'birds.ogg', 'boat': 'boat.ogg', 'city': 'city.ogg', 'coffee-shop': 'coffee-shop.ogg',
  'fireplace': 'fireplace.ogg', 'rain-steady': 'rain.ogg', 'summer-night': 'summer-night.ogg',
  'storm': 'storm.ogg', 'creek': 'stream.ogg', 'train-tracks': 'train.ogg', 'waves-shore': 'waves.ogg', 'wind-gusts': 'wind.ogg',
}.items()})

def decode(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-af', 'loudnorm=I=-20:TP=-2:LRA=11',
                          '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).copy()

OUT.mkdir(parents=True, exist_ok=True)
total = 0
for name, src in sorted(SRC.items()):
    x = decode(src)
    dur = len(x) / SR
    skip = min(1.0, max(0.0, dur - LOOP - XF)) if dur > LOOP + XF + 1 else 0.0  # skip fade-ins
    loop = min(LOOP, dur - skip - min(XF, dur * 0.2))
    xf = min(XF, (dur - skip - loop))
    a, n, f = int(skip * SR), int(loop * SR), int(xf * SR)
    seg = x[a:a + n + f]
    out = seg[:n].copy()
    if f > 0:  # equal-power crossfade of the tail (after n) into the head
        t = np.linspace(0, 1, f, dtype=np.float32)[:, None]
        out[:f] = seg[:f] * np.sqrt(t) + seg[n:n + f] * np.sqrt(1 - t)
    dst = OUT / f'{name}.txt'  # Ogg Opus data; .txt so download managers (IDM) leave it alone
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-',
                    '-c:a', 'libopus', '-b:a', '48k', '-vbr', 'on', '-f', 'ogg', str(dst)], input=out.tobytes(), check=True)
    total += dst.stat().st_size
    print(f'{name:16s} src {dur:6.1f}s -> loop {loop:5.1f}s  {dst.stat().st_size // 1024:4d} KB')
print(f'{len(SRC)} loops, {total / 1e6:.1f} MB')
