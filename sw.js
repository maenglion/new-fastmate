// sw.js (교체본)
const CACHE_NAME = 'fastmate-v3'; // ← 버전 올림
const STATIC_ASSETS = [
  // HTML은 넣지 않음! 정적 파일만 넣음
  '/styles.css',
  // 필요 시 정적 아이콘/폰트 등 추가
];

// 설치: 정적 자산만 프리캐시 + 즉시 대기 해제
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// 활성화: 구 캐시 정리 + 즉시 클라이언트 장악
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)))
    )
  );
  self.clients.claim();
});

// 요청 가로채기
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // ① 문서 탐색은 Network-First → 최신 배포 보장
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req)
        .then((res) => res)                  // 온라인 성공 시 그대로 최신 응답
        .catch(() => caches.match(req))      // 오프라인 시에만 캐시Fallback
    );
    return;
  }

  // ② 그 외 정적 리소스는 Cache-First(+런타임 캐시)
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        return res;
      });
    })
  );
});
