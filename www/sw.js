const APP_VERSION = '2025.09.10-01'; 
self.addEventListener('install', e => {
  self.skipWaiting(); 
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME ? caches.delete(k) : null));
    await self.clients.claim(); // 열려있는 탭에 즉시 새 SW 적용
  })());
});

// 네비게이션(HTML)은 네트워크 우선
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Firebase/Google API는 그대로 통과(기존 로직 유지)
  if (request.method !== 'GET' || url.hostname.includes('firebase') || url.hostname.includes('googleapis') || url.pathname.includes('/.well-known/')) {
    return;
  }

  // ✨ HTML(Navigate 요청)은 네트워크 우선
  if (request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // 정적 파일은 캐시 우선(기존 로직 유지)
  event.respondWith(
    caches.match(request).then(res => res || fetch(request))
  );
});
