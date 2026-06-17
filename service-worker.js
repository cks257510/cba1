const CACHE_NAME = 'character-brawl-v34-adventure-building-vehicle';
const ASSET_MANIFEST = [
  './',
  './index.html',
  './favicon.ico',
  './styles.css',
  './src/app.js',
  './src/config.js',
  './src/data/characters.js',
  './src/data/items.js',
  './src/data/missions.js',
  './src/services/firebaseService.js',
  './src/services/gameService.js',
  './src/ui/render.js',
  './src/battle/realtimeClient.js',
  './src/battle/liveBattle.js',
  './GAME_NUMBERS.md',
  './src/services/audioService.js',
  './assets/skins/Caitlyn.png',
  './assets/ui/craft.png',
  './assets/ui/market.png',
  './assets/ui/home.png',
  './assets/ui/squad.png',
  './assets/ui/bag.png',
  './assets/ui/controll.png',
  './assets/ui/auto.png',
  './assets/ui/user.png',
  './assets/ui/trophy.png',
  './assets/ui/mission.png',
  './assets/sounds/2ways.mp3',
  './assets/sounds/narutobattle.mp3',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSET_MANIFEST)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => {});
        return response;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
