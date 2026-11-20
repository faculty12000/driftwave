// Driftwave audio engine — everything is synthesized locally with the Web Audio API.
// No audio files, no network. Modulation (waves, gusts, swells) runs inside the audio
// graph so it keeps working when JS timers are throttled (screen off / background).

const LOOP_SECONDS = 12;
const EVENT_SECONDS = 24;

function rand(a, b) { return a + Math.random() * (b - a); }

// Build a seamless stereo loop: generate N+F samples, crossfade the tail into the head.
function makeLoop(ctx, seconds, fill) {
  const sr = ctx.sampleRate;
  const N = Math.floor(seconds * sr);
  const F = Math.floor(0.5 * sr);
  const buf = ctx.createBuffer(2, N, sr);
  for (let ch = 0; ch < 2; ch++) {
    const raw = new Float32Array(N + F);
    fill(raw, sr, ch);
    const out = buf.getChannelData(ch);
    for (let i = 0; i < N; i++) out[i] = raw[i];
    for (let i = 0; i < F; i++) {
      const t = i / F;
      out[i] = raw[i] * Math.sqrt(t) + raw[N + i] * Math.sqrt(1 - t);
    }
  }
  return buf;
}

const noiseFills = {
  white(d) { for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.5; },
  pink(d) {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.96900 * b2 + w * 0.1538520; b3 = 0.86650 * b3 + w * 0.3104856;
      b4 = 0.55000 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.0168980;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
  },
  brown(d) {
    let last = 0, dc = 0;
    for (let i = 0; i < d.length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      d[i] = last * 3.5;
    }
    for (let i = 0; i < d.length; i++) dc += d[i];
    dc /= d.length;
    for (let i = 0; i < d.length; i++) d[i] -= dc;
  },
};

// ---- Event textures (drops, crackles, chimes, birds...) rendered once into loops ----
function scatter(d, sr, perSecond, render) {
  const n = Math.floor((d.length / sr) * perSecond);
  for (let k = 0; k < n; k++) render(d, sr, Math.floor(Math.random() * d.length));
}
function add(d, i, v) { if (i >= 0 && i < d.length) d[i] += v; }

const eventFills = {
  drops(d, sr) { // water droplets: short rising sine "plinks"
    scatter(d, sr, 14, (d, sr, at) => {
      const f0 = rand(600, 2600), amp = Math.pow(Math.random(), 2) * 0.6;
      const len = Math.floor(sr * 0.06); let ph = 0;
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        ph += 2 * Math.PI * f0 * (1 + 0.8 * Math.min(t / 0.02, 1)) / sr;
        add(d, at + i, Math.sin(ph) * amp * Math.exp(-t / 0.012));
      }
    });
  },
  patter(d, sr) { // dense tiny ticks: rain on surfaces
    scatter(d, sr, 260, (d, sr, at) => {
      const amp = Math.pow(Math.random(), 3) * 0.5, len = Math.floor(sr * 0.004);
      for (let i = 0; i < len; i++) add(d, at + i, (Math.random() * 2 - 1) * amp * Math.exp(-i / (sr * 0.0008)));
    });
  },
  crackle(d, sr) { // fire crackles and occasional pops
    scatter(d, sr, 22, (d, sr, at) => {
      const big = Math.random() < 0.12;
      const amp = (big ? 0.9 : 0.35) * Math.pow(Math.random(), 1.5);
      const len = Math.floor(sr * (big ? 0.03 : 0.008)), tau = sr * (big ? 0.006 : 0.0015);
      for (let i = 0; i < len; i++) add(d, at + i, (Math.random() * 2 - 1) * amp * Math.exp(-i / tau));
      if (Math.random() < 0.3) { // tiny burst cluster
        for (let j = 0; j < 4; j++) {
          const o = at + Math.floor(rand(0.005, 0.06) * sr), a = amp * rand(0.1, 0.4);
          for (let i = 0; i < sr * 0.003; i++) add(d, o + i, (Math.random() * 2 - 1) * a * Math.exp(-i / (sr * 0.0007)));
        }
      }
    });
  },
  embers(d, sr) { // soft hiss pulses
    scatter(d, sr, 3, (d, sr, at) => {
      const len = Math.floor(sr * rand(0.3, 1.2)), amp = rand(0.05, 0.2);
      for (let i = 0; i < len; i++) add(d, at + i, (Math.random() * 2 - 1) * amp * Math.sin(Math.PI * i / len));
    });
  },
  chimes(d, sr) { // pentatonic glass chimes
    const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
    scatter(d, sr, 0.7, (d, sr, at) => {
      const f = 523.25 * Math.pow(2, scale[Math.floor(Math.random() * scale.length)] / 12);
      const amp = rand(0.08, 0.22), len = Math.floor(sr * 4);
      const parts = [[1, 1], [2.76, 0.4], [5.4, 0.2], [8.93, 0.1]];
      for (let i = 0; i < len; i++) {
        const t = i / sr; let s = 0;
        for (const [m, a] of parts) s += Math.sin(2 * Math.PI * f * m * t) * a * Math.exp(-t * (0.9 + m * 0.5));
        add(d, at + i, s * amp * Math.min(1, t * 400));
      }
    });
  },
  birds(d, sr) { // phrases of synthetic chirps
    scatter(d, sr, 0.45, (d, sr, at) => {
      const base = rand(2200, 4800), n = 2 + Math.floor(Math.random() * 6), amp = rand(0.05, 0.18);
      const dir = Math.random() < 0.5 ? 1 : -1, gap = rand(0.07, 0.16), clen = rand(0.04, 0.09);
      let off = at;
      for (let c = 0; c < n; c++) {
        const len = Math.floor(sr * clen); let ph = 0;
        for (let i = 0; i < len; i++) {
          const x = i / len;
          const f = base * (1 + dir * 0.35 * x) + 300 * Math.sin(2 * Math.PI * 30 * i / sr);
          ph += 2 * Math.PI * f / sr;
          add(d, off + i, Math.sin(ph) * amp * Math.sin(Math.PI * x));
        }
        off += Math.floor(sr * gap);
      }
    });
  },
  crickets(d, sr) { // pulsed narrow tone
    let t0 = 0;
    while (t0 < d.length) {
      const f = rand(4300, 4600), pulses = 3 + Math.floor(Math.random() * 3), amp = rand(0.04, 0.1);
      for (let p = 0; p < pulses; p++) {
        const at = t0 + Math.floor(p * 0.025 * sr), len = Math.floor(0.015 * sr);
        for (let i = 0; i < len; i++) add(d, at + i, Math.sin(2 * Math.PI * f * i / sr) * amp * Math.sin(Math.PI * i / len));
      }
      t0 += Math.floor(rand(0.35, 0.8) * sr);
    }
  },
  bubbles(d, sr) { // stream bubbles: falling-pitch blips
    scatter(d, sr, 30, (d, sr, at) => {
      const f0 = rand(300, 1400), amp = Math.pow(Math.random(), 2) * 0.35, len = Math.floor(sr * 0.04); let ph = 0;
      for (let i = 0; i < len; i++) {
        const t = i / sr; ph += 2 * Math.PI * f0 * (1 + 2.5 * t / 0.04) / sr;
        add(d, at + i, Math.sin(ph) * amp * Math.exp(-t / 0.01));
      }
    });
  },
  clock(d, sr) { // soft ticking, one tick per second
    for (let s = 0; s < d.length; s += sr) {
      const amp = (s / sr) % 2 ? 0.25 : 0.2;
      for (let i = 0; i < sr * 0.01; i++) add(d, s + i, (Math.random() * 2 - 1) * amp * Math.exp(-i / (sr * 0.0012)));
    }
  },
};

// Shaper curve mapping an LFO in [-1,1] to an envelope in [0,1] with sharpness p.
function shaperCurve(p) {
  const n = 1024, c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = i / (n - 1); c[i] = Math.pow(x, p); }
  return c;
}

export class Engine {
  constructor() {
    this.ctx = null;
    this.buffers = {};
    this.recs = new Map();
    this.channels = [];
    this.playing = false;
    this.masterLevel = 0.8;
  }

  init() {
    if (this.ctx) return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'playback' });
    this.ctx = ctx;
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -6; this.limiter.knee.value = 6;
    this.limiter.ratio.value = 12; this.limiter.attack.value = 0.005; this.limiter.release.value = 0.25;
    this.fade = ctx.createGain(); this.fade.gain.value = 0;        // play/pause + sleep timer fades
    this.master = ctx.createGain(); this.master.gain.value = this.masterLevel;
    this.master.connect(this.limiter).connect(this.fade).connect(ctx.destination);
  }

  buffer(src) {
    if (!this.buffers[src]) {
      if (noiseFills[src]) this.buffers[src] = makeLoop(this.ctx, LOOP_SECONDS, noiseFills[src]);
      else {
        const fill = eventFills[src.replace('ev:', '')];
        this.buffers[src] = makeLoop(this.ctx, EVENT_SECONDS, fill);
      }
    }
    return this.buffers[src];
  }

  lfo(rate, spread) { // returns a node producing a smooth signal in [-1,1]
    const ctx = this.ctx, sum = ctx.createGain();
    const parts = spread ? 3 : 1;
    sum.gain.value = 1 / parts;
    for (let i = 0; i < parts; i++) {
      const o = ctx.createOscillator();
      o.frequency.value = rate * (spread ? [1, 1.618, 2.414][i] * rand(0.85, 1.15) : rand(0.9, 1.1));
      o.connect(sum); o.start(ctx.currentTime + rand(0, 1)); this.nodes.push(o);
    }
    return sum;
  }

  build(scape, values) {
    this.teardown();
    const ctx = this.ctx;
    this.nodes = [];
    this.channels = scape.channels.map((c, i) => {
      const out = ctx.createGain();           // slider level
      out.gain.value = 0;
      const modGain = ctx.createGain();       // modulation envelope
      let src;
      if (c.osc) {
        src = ctx.createGain(); src.gain.value = 1 / c.osc.length;
        for (const f of c.osc) {
          const o = ctx.createOscillator(); o.type = c.wave || 'sine';
          o.frequency.value = f; o.detune.value = rand(-6, 6);
          o.connect(src); o.start(); this.nodes.push(o);
        }
      } else if (c.src.startsWith('rec:')) {
        src = ctx.createGain();               // recording is attached here once loaded (lazily)
      } else {
        src = ctx.createBufferSource(); src.buffer = this.buffer(c.src); src.loop = true;
        src.playbackRate.value = c.rate || 1;
        src.start(0, rand(0, src.buffer.duration)); this.nodes.push(src);
      }
      let node = src, fmodDone = false;
      for (const f of (c.f ? (Array.isArray(c.f[0]) ? c.f : [c.f]) : [])) {
        const bq = ctx.createBiquadFilter(); bq.type = f[0]; bq.frequency.value = f[1];
        if (f[2] != null) bq.Q.value = f[2];
        if (c.fmod && !fmodDone) {
          const l = this.lfo(c.fmod.rate, true), g = ctx.createGain();
          g.gain.value = f[1] * c.fmod.depth; l.connect(g).connect(bq.frequency); fmodDone = true;
        }
        node.connect(bq); node = bq;
      }
      node.connect(modGain);
      if (c.mod) {
        const { rate, depth, p = 1, gust } = c.mod;
        modGain.gain.value = 1 - depth;
        const l = this.lfo(rate, !!gust);
        const sh = ctx.createWaveShaper(); sh.curve = shaperCurve(p);
        // shaper input domain is [-1,1]; curve indexed over that range, so x→((x+1)/2)^p
        const g = ctx.createGain(); g.gain.value = depth;
        l.connect(sh).connect(g).connect(modGain.gain);
      }
      let tail = modGain;
      if (c.pan) { const pn = ctx.createStereoPanner(); pn.pan.value = c.pan; tail.connect(pn); tail = pn; }
      tail.connect(out); out.connect(this.master);
      return { spec: c, out, input: src, rec: c.src && c.src.startsWith('rec:') ? c.src.slice(4) : null };
    });
    // Free decoded recordings that the new soundscape doesn't use (keeps phone memory low).
    const keep = new Set(this.channels.map((ch) => ch.rec).filter(Boolean));
    for (const k of this.recs.keys()) if (!keep.has(k)) this.recs.delete(k);
    this.channels.forEach((ch, i) => this.setLevel(i, values[i], true));
  }

  // Recorded loops are decoded at 32 kHz (plenty for ambience, ~1/3 less memory) and only when a slider is up.
  loadRec(name) {
    if (!this.recs.has(name)) {
      // Stored as .txt (Ogg Opus data inside) so download managers like IDM don't hijack them as audio downloads.
      const p = fetch(`sounds/${name}.txt`).then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
        .then((ab) => new OfflineAudioContext(2, 1, 32000).decodeAudioData(ab.slice(0))
          .catch(() => this.ctx.decodeAudioData(ab)));
      p.catch((e) => { console.warn('sound failed', name, e); this.recs.delete(name); });
      this.recs.set(name, p);
    }
    return this.recs.get(name);
  }

  ensureRec(ch, v) {
    if (!ch.rec || ch.started || v < 0.01) return;
    ch.started = true;
    this.loadRec(ch.rec).then((buf) => {
      if (!this.channels.includes(ch)) return;   // soundscape changed while loading
      const s = this.ctx.createBufferSource(); s.buffer = buf; s.loop = true;
      s.playbackRate.value = ch.spec.rate || 1;
      s.connect(ch.input); s.start(0, rand(0, buf.duration)); this.nodes.push(s);
      this.onLoading?.(-1);
    }, () => { ch.started = false; this.onLoading?.(-1); });
    this.onLoading?.(1);
  }

  teardown() {
    for (const n of this.nodes || []) { try { n.stop(); } catch (e) {} try { n.disconnect(); } catch (e) {} }
    for (const ch of this.channels) ch.out.disconnect();
    this.nodes = []; this.channels = [];
  }

  setLevel(i, v, instant) {
    const ch = this.channels[i]; if (!ch) return;
    this.ensureRec(ch, v);
    const target = (ch.spec.gain || 1) * v * v;
    const p = ch.out.gain, t = this.ctx.currentTime;
    p.cancelScheduledValues(t);
    if (instant) p.setValueAtTime(target, t); else p.setTargetAtTime(target, t, 0.08);
  }
  // Slow glide used by "Animate"
  glideLevel(i, v, seconds) {
    const ch = this.channels[i]; if (!ch) return;
    this.ensureRec(ch, v);
    const p = ch.out.gain, t = this.ctx.currentTime;
    p.cancelScheduledValues(t); p.setTargetAtTime((ch.spec.gain || 1) * v * v, t, seconds / 3);
  }

  setMaster(v) {
    this.masterLevel = v;
    if (this.master) this.master.gain.setTargetAtTime(v * v, this.ctx.currentTime, 0.05);
  }

  async play() {
    this.init(); await this.ctx.resume();
    const g = this.fade.gain, t = this.ctx.currentTime;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(1, t + 1.5);
    this.playing = true;
  }

  pause() {
    if (!this.ctx) return;
    const g = this.fade.gain, t = this.ctx.currentTime;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + 0.6);
    this.playing = false;
    clearTimeout(this._suspendT);
    this._suspendT = setTimeout(() => { if (!this.playing) this.ctx.suspend(); }, 800);
  }

  // Sleep timer scheduled inside the audio clock, so it fires even if the page is throttled.
  scheduleFadeOut(minutes) {
    if (!this.ctx) return;
    const g = this.fade.gain, t = this.ctx.currentTime, end = t + minutes * 60;
    const fadeLen = Math.min(90, minutes * 60 * 0.2);
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
    g.setValueAtTime(1, end - fadeLen); g.linearRampToValueAtTime(0, end);
  }
  cancelFadeOut() {
    if (!this.ctx || !this.playing) return;
    const g = this.fade.gain, t = this.ctx.currentTime;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(1, t + 1);
  }
}
