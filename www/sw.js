// Cache-first service worker: after the first visit the app works with no connection.
const CACHE = 'driftwave-v3';
const FILES = ['./', 'index.html', 'css/style.css', 'js/app.js', 'js/engine.js', 'js/scapes.js', 'js/calib.js', 'js/credits.js', 'js/vendor/capacitor.js',
  'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
  // recorded loops (~12 MB) so every soundscape works offline after the first visit
  ...["sounds/airplane.txt", "sounds/beehive.txt", "sounds/birds-morning.txt", "sounds/boat.txt", "sounds/boiling-water.txt", "sounds/cafe.txt", "sounds/campfire.txt", "sounds/cat-purring.txt", "sounds/ceiling-fan.txt", "sounds/chickens.txt", "sounds/city.txt", "sounds/clock.txt", "sounds/coffee-shop.txt", "sounds/cows.txt", "sounds/creek.txt", "sounds/crickets.txt", "sounds/crows.txt", "sounds/dog.txt", "sounds/droplets.txt", "sounds/dryer.txt", "sounds/fireplace.txt", "sounds/frog.txt", "sounds/heavy-rain.txt", "sounds/highway.txt", "sounds/horse.txt", "sounds/howling-wind.txt", "sounds/jungle.txt", "sounds/keyboard.txt", "sounds/library.txt", "sounds/light-rain.txt", "sounds/night-village.txt", "sounds/owl.txt", "sounds/paper.txt", "sounds/rain-car.txt", "sounds/rain-leaves.txt", "sounds/rain-steady.txt", "sounds/rain-tent.txt", "sounds/rain-window.txt", "sounds/restaurant.txt", "sounds/river.txt", "sounds/road.txt", "sounds/rowing-boat.txt", "sounds/sailboat.txt", "sounds/seagulls.txt", "sounds/sheep.txt", "sounds/singing-bowl.txt", "sounds/songbirds.txt", "sounds/storm.txt", "sounds/submarine.txt", "sounds/subway.txt", "sounds/summer-night.txt", "sounds/thunder.txt", "sounds/train-inside.txt", "sounds/train-tracks.txt", "sounds/typewriter.txt", "sounds/underwater.txt", "sounds/vinyl.txt", "sounds/washing-machine.txt", "sounds/waterfall.txt", "sounds/waves-shore.txt", "sounds/waves-soft.txt", "sounds/whale.txt", "sounds/wind-chimes.txt", "sounds/wind-gusts.txt", "sounds/wind-in-trees.txt", "sounds/wind-open.txt", "sounds/wipers.txt", "sounds/wolf.txt", "sounds/woodpecker.txt"]];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((r) => r || fetch(e.request).then((res) => {
    const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res;
  })));
});
