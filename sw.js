// sw.js
const CACHE_NAME = 'fastmate-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/fastmate.html',
  '/login.html',
  '/signup.html',
  '/mypage.html'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});