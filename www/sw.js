// sw.js 파일 전체를 이 코드로 교체해주세요.

const APP_VERSION = '2025.09.06-1';
const CACHE_PREFIX = 'fastmate-cache-';
const CACHE_NAME = `${CACHE_PREFIX}${APP_VERSION}`;

const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/fastmate.html',
  '/login.html',
  '/signup.html',
  '/mypage.html',
  '/privacy.html',
  '/welcome.html'
  // 여기에 캐시할 이미지나 폰트 파일 경로를 추가할 수 있습니다.
];

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(console.error);
  });
}

// 1. 서비스 워커 설치 및 기본 파일 캐싱
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache and caching basic files');
        return cache.addAll(urlsToCache);
      })
  );
});

// 2. [핵심 수정] 요청(fetch) 가로채기
self.addEventListener('fetch', event => {
  // Firebase와의 통신이나 POST 방식의 요청은 캐시하지 않고,
  // 즉시 네트워크로 보내서 서비스 워커가 무시하도록 합니다.
  if (event.request.method !== 'GET' || event.request.url.includes('firebase') || event.request.url.includes('googleapis')) {
    return; 
  }
  if (event.request.url.includes('/.well-known/')) return; // 그냥 네트워크로


  // 그 외의 요청(HTML, CSS 등)은 캐시 우선 전략을 사용합니다.
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // 캐시에 있으면 바로 반환하고, 없으면 네트워크에서 가져옵니다.
        return response || fetch(event.request);
      })
  );
});



// 3. 이전 버전의 캐시 정리
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});