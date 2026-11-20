import { Engine } from './engine.js';
import { SCAPES } from './scapes.js';
import { CALIB } from './calib.js';
import { CREDITS, CREDITS_NOTE } from './credits.js';

const $ = (s) => document.querySelector(s);
const engine = new Engine(); window.__eng = engine;
const KEY = 'driftwave.v1';

const state = Object.assign(
  { scape: SCAPES[0].id, mixes: {}, presets: [], master: 0.8, timer: 0 },
  JSON.parse(localStorage.getItem(KEY) || '{}'),
);
const save = () => localStorage.setItem(KEY, JSON.stringify(state));

let scape, values, sliders = [], animTimer = null, timerEnd = 0, timerTick = null;
const defaults = (s) => s.channels.map((c) => c.def ?? 0.5);

// Recorded soundscapes need the sounds/ folder, which the single-file (file://) version doesn't have.
const CAN_RECORDED = location.protocol !== 'file:';
const AVAILABLE = SCAPES.filter((s) => CAN_RECORDED || !s.recorded);

// Apply calibrated gain so each layer is comparable in loudness at the same slider position.
for (const s of SCAPES) s.channels.forEach((c, i) => { c.gain = (s.trim ?? 1) * (c.level ?? 1) * (CALIB[`${s.id}:${i}`] ?? 1); });

// ---- UI building ----
function renderScapes() {
  const nav = $('#scapes'); nav.innerHTML = '';
  AVAILABLE.forEach((s, k) => {
    if (s.recorded && !AVAILABLE[k - 1]?.recorded) {
      const sep = document.createElement('span'); sep.className = 'scape-sep'; sep.textContent = 'Recorded'; nav.appendChild(sep);
    }
    const b = document.createElement('button');
    b.className = 'scape'; b.style.setProperty('--h', s.hue);
    b.innerHTML = `<b>${s.icon}</b>${s.name}`;
    b.setAttribute('aria-current', s.id === state.scape);
    b.onclick = () => selectScape(s.id);
    nav.appendChild(b);
  });
}

function renderMixer() {
  const m = $('#mixer'); m.innerHTML = ''; sliders = [];
  scape.channels.forEach((c, i) => {
    const wrap = document.createElement('div'); wrap.className = 'ch';
    const val = document.createElement('span'); val.className = 'val';
    const r = document.createElement('input');
    Object.assign(r, { type: 'range', min: 0, max: 1, step: 0.01, className: 'vs', id: `ch${i}` });
    r.setAttribute('aria-label', c.name);
    const lab = document.createElement('label'); lab.htmlFor = r.id; lab.textContent = hyphenate(c.name);
    r.oninput = () => { values[i] = +r.value; paint(i); engine.channels.length && engine.setLevel(i, values[i]); persistMix(); };
    wrap.append(val, r, lab); m.appendChild(wrap);
    sliders.push({ r, val, wrap });
  });
  sliders.forEach((_, i) => paint(i));
}

// Soft hyphens so long words wrap neatly in the narrow slider columns.
const SPLITS = { Songbirds: 'Song|birds', Woodpecker: 'Wood|pecker', Waterfall: 'Water|fall', Campfire: 'Camp|fire',
  Downpour: 'Down|pour', Underwater: 'Under|water', Restaurant: 'Restau|rant', Typewriter: 'Type|writer',
  Fireplace: 'Fire|place', Submarine: 'Sub|marine', Seagulls: 'Sea|gulls', Sailboat: 'Sail|boat', Airplane: 'Air|plane',
  Highway: 'High|way', Crickets: 'Crick|ets', Crackle: 'Crack|le', Thunder: 'Thun|der', Distant: 'Dis|tant',
  Morning: 'Morn|ing', Village: 'Vil|lage', Tempest: 'Tem|pest', Harbour: 'Har|bour', chatter: 'chat|ter',
  Library: 'Li|brary', outside: 'out|side', purring: 'purr|ing', Ceiling: 'Ceil|ing', Singing: 'Sing|ing',
  Cascade: 'Cas|cade', Trickle: 'Trick|le', Airflow: 'Air|flow', Turbine: 'Tur|bine', Shimmer: 'Shim|mer', Pebbles: 'Peb|bles', Canopy: 'Can|opy' };
const hyphenate = (n) => n.split(' ').map((w) => (SPLITS[w] || w).replace('|', '\u00ad')).join(' ');

function paint(i) {
  const s = sliders[i], v = values[i];
  s.r.value = v; s.r.style.setProperty('--p', `${v * 100}%`);
  s.val.textContent = Math.round(v * 100);
  s.wrap.classList.toggle('on', v > 0.01);
}

let persistT;
function persistMix() { clearTimeout(persistT); persistT = setTimeout(() => { state.mixes[scape.id] = values.slice(); save(); }, 250); }

function selectScape(id, vals) {
  scape = AVAILABLE.find((s) => s.id === id) || AVAILABLE[0];
  state.scape = scape.id;
  values = (vals || state.mixes[scape.id] || defaults(scape)).slice();
  document.documentElement.style.setProperty('--hue', scape.hue);
  $('#scapeName').textContent = scape.name;
  $('#scapeDesc').textContent = scape.desc;
  renderScapes(); renderMixer();
  if (engine.ctx) engine.build(scape, values);
  state.mixes[scape.id] = values.slice(); save();
  updateMediaSession();
  if (engine.playing) nativeStart();
}

// ---- Native background playback (Android app only; no-op in the browser) ----
const isNative = !!window.Capacitor?.isNativePlatform?.();
const Native = isNative ? window.Capacitor.registerPlugin('Playback') : null;
if (Native) Native.addListener('stop', () => { if (engine.playing) togglePlay(); });
const nativeStart = () => Native?.start({ title: `Driftwave · ${scape.name}` }).catch(() => {});
const nativeStop = () => Native?.stop().catch(() => {});

// ---- Transport ----
async function togglePlay() {
  if (engine.playing) { engine.pause(); setPlayUI(false); stopTimer(); nativeStop(); return; }
  const first = !engine.ctx;
  engine.init();
  if (first || !engine.channels.length) engine.build(scape, values);
  engine.setMaster(state.master);
  await engine.play(); setPlayUI(true); nativeStart();
  if (state.timer) startTimer(state.timer);
}
function setPlayUI(on) {
  const b = $('#playBtn'); b.textContent = on ? '❚❚' : '▶'; b.classList.toggle('on', on);
  b.setAttribute('aria-label', on ? 'Pause' : 'Play');
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = on ? 'playing' : 'paused';
}

// ---- Sleep timer ----
function startTimer(min) {
  stopTimer();
  if (!min || !engine.playing) return;
  engine.scheduleFadeOut(min);
  timerEnd = Date.now() + min * 60000;
  timerTick = setInterval(() => {
    const left = timerEnd - Date.now();
    if (left <= 0) { stopTimer(); engine.pause(); setPlayUI(false); nativeStop(); return; }
    const m = Math.floor(left / 60000), s = Math.floor(left / 1000) % 60;
    $('#timerLeft').textContent = `${m}:${String(s).padStart(2, '0')} left`;
  }, 1000);
}
function stopTimer() { clearInterval(timerTick); timerTick = null; $('#timerLeft').textContent = ''; }

// ---- Animate: sliders drift gently around where you set them ----
function toggleAnimate() {
  const b = $('#animBtn');
  if (animTimer) { clearInterval(animTimer); animTimer = null; b.setAttribute('aria-pressed', 'false'); return; }
  b.setAttribute('aria-pressed', 'true');
  const base = values.slice();
  animTimer = setInterval(() => {
    values = values.map((v, i) => {
      if (base[i] < 0.02) return v;
      const nv = Math.min(1, Math.max(0, v + (Math.random() - 0.5) * 0.12));
      return Math.min(base[i] + 0.25, Math.max(base[i] - 0.25, nv));
    });
    values.forEach((v, i) => { paint(i); engine.channels.length && engine.glideLevel(i, v, 4); });
  }, 4000);
}

function shuffle() {
  values = values.map(() => Math.round(Math.pow(Math.random(), 1.3) * 100) / 100);
  values.forEach((v, i) => { paint(i); engine.channels.length && engine.setLevel(i, v); });
  persistMix();
}
function reset() {
  values = defaults(scape);
  values.forEach((v, i) => { paint(i); engine.channels.length && engine.setLevel(i, v); });
  persistMix();
}

// ---- Presets ----
function renderPresets() {
  const ul = $('#presetList'); ul.innerHTML = '';
  if (!state.presets.length) { ul.innerHTML = '<li><small>No saved mixes yet.</small></li>'; return; }
  state.presets.forEach((p, idx) => {
    const li = document.createElement('li');
    const sc = AVAILABLE.find((s) => s.id === p.scape);
    if (!sc) return;
    const load = document.createElement('button'); load.className = 'load';
    load.innerHTML = `${escapeHtml(p.name)}<small>${sc ? sc.name : p.scape}</small>`;
    load.onclick = () => { selectScape(p.scape, p.values); closeDrawer(); };
    const del = document.createElement('button'); del.className = 'del'; del.textContent = '×';
    del.setAttribute('aria-label', `Delete ${p.name}`);
    del.onclick = () => { state.presets.splice(idx, 1); save(); renderPresets(); };
    li.append(load, del); ul.appendChild(li);
  });
}
const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let pending = 0;
engine.onLoading = (d) => { pending = Math.max(0, pending + d); $('#loading').hidden = pending === 0; };

function renderCredits() {
  $('#creditList').innerHTML = CREDITS.map((c) =>
    `<li><a href="${c.url}" target="_blank" rel="noopener">${escapeHtml(c.what)}</a> by ${escapeHtml(c.who)} (${c.license})</li>`).join('');
  $('#creditNote').textContent = CREDITS_NOTE;
}
function openDrawer() { renderCredits(); renderPresets(); $('#drawer').hidden = false; }
function closeDrawer() { $('#drawer').hidden = true; }

// ---- Media session (lock-screen / notification controls where supported) ----
function updateMediaSession() {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({ title: scape.name, artist: 'Driftwave',
    artwork: [{ src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }] });
  navigator.mediaSession.setActionHandler('play', () => { if (!engine.playing) togglePlay(); });
  navigator.mediaSession.setActionHandler('pause', () => { if (engine.playing) togglePlay(); });
}

// ---- Wire up ----
$('#playBtn').onclick = togglePlay;
$('#master').value = state.master;
$('#master').oninput = (e) => { state.master = +e.target.value; engine.setMaster(state.master); save(); };
$('#animBtn').onclick = toggleAnimate;
$('#randBtn').onclick = shuffle;
$('#resetBtn').onclick = reset;
$('#timer').value = String(state.timer);
$('#timer').onchange = (e) => {
  state.timer = +e.target.value; save();
  if (state.timer) startTimer(state.timer); else { stopTimer(); engine.cancelFadeOut(); }
};
$('#menuBtn').onclick = openDrawer;
$('#closeDrawer').onclick = closeDrawer;
$('#drawer').onclick = (e) => { if (e.target.id === 'drawer') closeDrawer(); };
$('#saveForm').onsubmit = (e) => {
  e.preventDefault();
  const name = $('#presetName').value.trim(); if (!name) return;
  state.presets.unshift({ name, scape: scape.id, values: values.slice() });
  save(); $('#presetName').value = ''; renderPresets();
};
document.addEventListener('keydown', (e) => { if (e.code === 'Space' && e.target === document.body) { e.preventDefault(); togglePlay(); } });

selectScape(state.scape);

// Offline support (service workers don't run from file:// or inside the Android wrapper's local scheme — not needed there).
if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !isNative) {
  navigator.serviceWorker.register('sw.js');
}
