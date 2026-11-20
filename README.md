# Driftwave — offline ambient noise generator

<img src="docs/screenshot.png" width="300" align="right" alt="Driftwave screenshot">

**[⬇ Downloads](downloads/)**: Android APK, PC version (Windows/Mac/Linux) and a single-file browser version.

An ambient-sound mixer: 16 soundscapes × 10 layers, each with its own slider. Works fully offline.

- **Synthesized** (generated live, no audio files): Spectrum (10-band noise EQ), Rainfall, Shoreline,
  Hearth, Woodland, Brook, Night Flight, Deep Space.
- **Recorded** (real field recordings bundled in `www/sounds/`, ~12 MB; Ogg Opus data saved as `.txt` so download managers like IDM don't intercept them): Forest Dawn (birdsong),
  Summer Night, Thunderstorm, Sea Voyage, Café Corner, Countryside, Cozy Home, On the Move.

Recordings come from the open-source [Blanket](https://github.com/rafaelmardojai/blanket) and
[Moodist](https://github.com/remvze/moodist) projects. See `www/js/credits.js` (also shown in-app under
☰ → Sound credits). Moodist's sounds are CC0 or Pixabay Content License; Blanket's are CC0, public domain
or CC BY (credited). Recordings are only loaded when their slider is up, to save phone memory.

To regenerate the loops from the source repos: `python3 tools/prepare-sounds.py <moodist>/public/sounds <blanket>/data/resources/sounds` (needs ffmpeg + numpy).

Features: per-layer sliders, master volume, **Animate** (layers drift gently), **Shuffle**,
**Reset**, sleep timer with fade-out, saved presets (stored on the device), lock-screen media
controls, and on Android a background-playback notification with a Stop button.

## Ways to run it

| Option | How |
|---|---|
| Single file (simplest) | Open `downloads/driftwave-offline.html` in any modern browser. No server needed. (Synth soundscapes only, since browsers block loading the sound files from disk.) |
| PC (full version) | Unzip `downloads/Driftwave-PC.zip` and double-click the launcher for your system. Rebuild it with `npm run pc`. |
| Installable web app (PWA) | `npm run serve` → open http://localhost:8080, then "Install app". After the first load it works offline. |
| Android APK | Install `downloads/Driftwave-1.2-debug.apk` on your phone (allow "install unknown apps"). |

## Project layout

```
www/                 the app (HTML/CSS/JS) — this is the source of truth
  js/engine.js       audio synthesis engine
  js/scapes.js       soundscape + layer definitions  ← add your own here
  js/calib.js        auto-generated loudness calibration
  js/app.js          UI logic
  sw.js              service worker (offline cache for the PWA)
android/             Capacitor Android project (native wrapper)
  app/src/main/java/com/driftwave/noise/PlaybackService.java  keeps audio playing with screen off
tools/build-single.py  bundles www/ into dist/driftwave-offline.html
```

## Rebuilding the APK

Requirements: Node 18+, JDK 21, Android SDK (platform 36, build-tools). Then:

```bash
npm install
npm run android:apk        # → android/app/build/outputs/apk/debug/app-debug.apk
```

Or open the `android/` folder in Android Studio and press Run.

For a Play-Store/release build, create a keystore and run `./gradlew assembleRelease`
(or `bundleRelease`) with signing configured in `android/app/build.gradle`.

## Adding a soundscape

Add an entry to `SCAPES` in `www/js/scapes.js`. Each layer chooses a source
(`white`/`pink`/`brown` noise, an event texture like `ev:drops`, or `osc: [freqs]`),
optional filters, panning and slow modulation. If you add layers, re-run the loudness
calibration (`node tools/calibrate/calibrate.js`, needs Playwright) or just tune each layer's `level`.
