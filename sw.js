const CACHE_NAME = 'salahtracker-cache-v1';
const FILES_TO_CACHE = [
  '/',
  '/index.html',
  '/data-manager.html',
  '/style.css',
  '/app.js',
  '/charts.js',
  '/manifest.json'
  // add icons (icons/icon-192.png, icons/icon-512.png) if present
];

self.addEventListener('install', (evt) => {
  evt.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', (evt) => {
  evt.waitUntil(clients.claim());
});

self.addEventListener('fetch', (evt) => {
  evt.respondWith(
    caches.match(evt.request).then(resp => resp || fetch(evt.request).catch(()=> caches.match('/index.html')))
  );
});
