// =============== firebase-init.js (Fastmate, v8 전용 공용) ===============
'use strict';

const APP_VERSION = '2025.09.06-v8.1';
window.__APP_VERSION__ = APP_VERSION;
console.log('[fastmate] version', APP_VERSION);

// (1) Firebase 초기화 (v8 전용)
const cfg = {
  apiKey: "AIzaSyCpLWcArbLdVDG6Qd6QoCgMefrXNa2pUs8",
  authDomain: "auth.fastmate.kr",                     // 커스텀 auth 도메인
  projectId: "fasting-b4ccb",
  storageBucket: "fasting-b4ccb.firebasestorage.app", // (미사용 시 무시됨)
  messagingSenderId: "879518503068",
  appId: "1:879518503068:web:295b1d4e21a40f9cc29d59",
  measurementId: "G-EX5HR2CB35"
};
Object.freeze(cfg);

const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(cfg);
window.firebaseApp = app;

const auth = firebase.auth();
const db   = firebase.firestore();
if (auth.useDeviceLanguage) auth.useDeviceLanguage();

// ✅ v8 Firestore 네트워크 안정화: 초기화 직후 "단 1회"
try {
  db.settings({ experimentalForceLongPolling: true });
} catch (e) {
  // v8에서 settings 중복호출 방지
  console.warn('[firestore settings]', e?.message || e);
}

// (2) 리디렉션 복귀 시 스플래시 락 해제(있으면)
try {
  if (sessionStorage.getItem('oauthBusy') === '1') {
    document.body.classList.remove('oauth-busy');
    sessionStorage.removeItem('oauthBusy');
  }
} catch {}

// (3) 공용 유틸/UI 헬퍼
if (!window.showApp) {
  window.showApp = function () {
    const s = document.getElementById('splash-screen');
    if (s) { s.classList.add('fade-out'); setTimeout(() => (s.style.display = 'none'), 400); }
    document.body?.classList?.add?.('loaded');
  };
}

// (4) 라우팅 헬퍼
const ROUTES = {
  index   : '/index.html',
  login   : '/login.html',
  signup  : '/signup.html',
  fastmate: '/fastmate.html'
};
const path = () => location.pathname || '/';
const isIndex    = () => path() === '/' || /\/index\.html$/i.test(path());
const isLogin    = () => /\/login(?:\.html)?$/i.test(path());
const isSignup   = () => /\/signup(?:\.html)?$/i.test(path());
const isFastmate = () => /\/fastmate(?:\.html)?$/i.test(path());
const isProtected= () => isFastmate(); // fastmate만 보호
const toUrl = (key) => {
  const base = ROUTES[key] || '/';
  const useHtmlStyle = /\.html$/i.test(location.pathname);
  const final = useHtmlStyle ? base : base.replace(/\/index\.html$/i, '/');
  const u = new URL(final, location.origin);
  u.searchParams.set('authcb', Date.now().toString()); // SW/캐시 회피
  return u.toString();
};
const goOnce = (to) => { if (!window.__AUTH_NAV__) { window.__AUTH_NAV__ = true; location.replace(to); } };

// (5) 환경 감지
function isStandalonePWA(){
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}
function isInApp(){
  const ua = navigator.userAgent || '';
  return /; wv\)/i.test(ua) || /FBAN|FBAV|FB_IAB|Instagram|KAKAOTALK|NAVER|DaumApps/i.test(ua);
}
function isAndroidChromeTab(){
  const ua = navigator.userAgent || '';
  return /Android/.test(ua) && /Chrome/.test(ua) && !isStandalonePWA() && !isInApp();
}

// (6) 전역 함수: 구글 로그인/로그아웃
window.signInWithGoogle = function () {
  if (isInApp()) {
    alert('인앱 브라우저에서는 Google 로그인이 제한됩니다. 메뉴에서 “기본 브라우저로 열기(Chrome/Safari)”를 선택해주세요.');
    return;
  }
  const provider = new firebase.auth.GoogleAuthProvider();

  // iOS/인앱/PWA = redirect, 안드 크롬 탭 = popup 우선
  const ua  = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  const preferRedirect = (isIOS && !isStandalonePWA()) || isSafari || isInApp();

  sessionStorage.setItem('oauthBusy', '1');
  document.body.classList.add('oauth-busy');

  if (preferRedirect) {
    auth.signInWithRedirect(provider).catch(err => {
      console.error('[redirect start err]', err);
      sessionStorage.removeItem('oauthBusy'); document.body.classList.remove('oauth-busy');
      alert('로그인 시작 오류: ' + (err.message || err.code));
    });
  } else {
    auth.signInWithPopup(provider)
      .then(async (r) => { if (r?.user) await upsertUserDoc(r.user); })
      .catch(async (err) => {
        console.warn('[popup err]', err?.code, err?.message);
        if (String(err?.code || '').includes('popup')) return auth.signInWithRedirect(provider);
        alert('로그인 실패: ' + (err.message || err.code));
      })
      .finally(() => {
        sessionStorage.removeItem('oauthBusy');
        document.body.classList.remove('oauth-busy');
      });
  }
};
window.signOutFastmate = function(){
  return auth.signOut().then(() => location.replace(toUrl('login')));
};

// (7) 영속성 + 리디렉션 결과 먼저 회수 → onAuthStateChanged
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
  .catch(() => auth.setPersistence(firebase.auth.Auth.Persistence.SESSION));

auth.getRedirectResult()
  .then(async (res) => {
    if (res?.user) await afterAuth(res.user, res.additionalUserInfo);
  })
  .catch((e) => console.warn('[redirectResult]', e.code, e.message));

// (8) 인증 상태 반응 (v8 스타일)
firebase.auth().onAuthStateChanged(async (user) => {
  const p = location.pathname.toLowerCase();
  const isEntry =
    p === '/' || p.endsWith('/index.html') ||
    p.endsWith('/login.html') || p.endsWith('/signup.html');

  console.log('[auth] state=', !!user, 'path=', p);

  if (!user) {
    if (!p.endsWith('/login.html') && !p.endsWith('/signup.html')) {
      location.replace('/login.html');
    }
    return;
  }

  // 업서트는 실패해도 흐름은 진행
  try {
    await db.collection('users').doc(user.uid).set({
      uid: user.uid,
      email: user.email || null,
      displayName: user.displayName || null,
      photoURL: user.photoURL || null,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  } catch (e) {
    console.warn('[auth] upsert user failed (non-blocking):', e);
  }

  const NEXT = '/fastmate.html';
  if (isEntry && !p.endsWith(NEXT)) location.replace(NEXT);
});

// (9) 공통 후처리: users 업서트 + 온보딩/라우팅
async function afterAuth(user, info){
  try { await upsertUserDoc(user); } catch(e){ console.error('[upsert fail]', e); }

  const isNew = info?.isNewUser === true;
  const currentPath = path();

  // signup.html에서는 로그인된 사용자에게 step=1을 절대 노출하지 않음
  if (currentPath === '/signup.html'){
    const url = new URL(location.href);
    url.searchParams.set('step', isNew ? '2' : 'final');
    history.replaceState(null, '', url.toString());
  }

  // 프로필 완료 여부 판단
  const prof = await getUserDoc();
  const done = isProfileDone(prof);

  if (!done && !isSignup()) return goOnce(toUrl('signup'));               // 가입 미완성 → signup
  if (done && (isIndex() || isLogin() || isSignup())) return goOnce(toUrl('fastmate')); // 완료 → fastmate

  // fastmate.html 진입 시 UI 수화
  if (isFastmate()) {
    try {
      const userChip     = document.getElementById('userChip');
      const userChipName = document.getElementById('userChipName');
      const nickname = prof?.nickname || prof?.displayName || user.displayName || '사용자';
      if (userChip && userChipName) { userChipName.textContent = nickname; userChip.style.display = 'flex'; }
      const saved = prof?.currentFasting;
      if (saved && window.hydrateFastingTimer) window.hydrateFastingTimer(saved);
      else if (window.initializeTime) window.initializeTime();
      window.updateUIState?.();
      if (!window.__WIRED__) { window.__WIRED__ = true; try { window.wireEventsOnce?.(); } catch {} }
    } catch (e) { console.warn('[fastmate hydrate]', e); }
  }
}

// (10) 전역 데이터 유틸
function hasValue(x){ return Array.isArray(x) ? x.length>0 : (x!=null && String(x).trim()!==''); }
function isProfileDone(u){
  const nick = u?.nickname;
  const goals = u?.goals ?? u?.purpose ?? u?.joinPurpose ?? u?.onboarding?.reasons;
  const completed = u?.onboarding?.completed === true;
  return hasValue(nick) && (hasValue(goals) || completed);
}
async function getUserDoc(uid){
  const id = uid || auth.currentUser?.uid;
  if (!id) return null;
  try {
    const s = await db.collection('users').doc(id).get();
    return s.exists ? { id: s.id, ...s.data() } : null;
  } catch (e) {
    console.error('[getUserDoc]', e);
    return null;
  }
}
async function upsertUserDoc(user){
  const ref = db.collection('users').doc(user.uid);
  await ref.set({
    uid: user.uid,
    email: user.email ?? '',
    displayName: user.displayName ?? '',
    photoURL: user.photoURL ?? '',
    provider: user.providerData?.[0]?.providerId ?? 'unknown',
    lastLoginAt: firebase.firestore.FieldValue.serverTimestamp(),
    createdAt : firebase.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
}

// 전역 노출(기존 코드 호환)
window.getUserDoc = getUserDoc;
window.ensureUserProfile = async function(data){
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('not-authenticated');
  await db.collection('users').doc(uid).set(data, { merge:true });
};
window.upsertUserDoc = upsertUserDoc;

// (11) 버튼 바인딩 (login.html / signup.html 공용)
document.addEventListener('DOMContentLoaded', () => {
  const g1 = document.getElementById('google-login-btn'); // login.html
  const g2 = document.getElementById('googleSignupBtn');  // signup.html
  [g1, g2].forEach(btn => {
    if (btn && !btn.__BOUND__) {
      btn.__BOUND__ = true;
      btn.addEventListener('click', (e) => { e.preventDefault(); window.signInWithGoogle(); });
    }
  });

  const resetBtn = document.getElementById('send-reset-email-btn'); // 있으면 작동
  if (resetBtn && !resetBtn.__BOUND__) {
    resetBtn.__BOUND__ = true;
    resetBtn.addEventListener('click', () => {
      const email = document.getElementById('reset-email')?.value?.trim();
      if (!email) return alert('비밀번호를 찾을 이메일을 입력해주세요.');
      auth.sendPasswordResetEmail(email)
        .then(() => alert(`'${email}'로 재설정 메일을 보냈습니다.`))
        .catch(e => alert(`오류: ${e.code}`));
    });
  }
});

// (12) 최후 안전장치(렌더 막힘 방지)
setTimeout(() => {
  try {
    const container = document.getElementById('app') || document.querySelector('#root,#app-root,main');
    if (!container) return;
    if (container.childElementCount > 0 || document.querySelector('[data-fastmate-ready]')) return;

    const p = location.pathname || '/';
    const isFastmate = /\/fastmate(?:\.html)?$/i.test(p);
    const isSignup   = /\/signup(?:\.html)?$/i.test(p);
    const isLogin    = /\/login(?:\.html)?$/i.test(p);
    if (isFastmate || isSignup || isLogin) return;

    container.innerHTML =
      '<div style="padding:16px;font-family:sans-serif">로그인은 되었지만 다음 화면으로 이동하지 못했습니다. 새로고침을 눌러주세요.</div>';
  } catch {}
}, 4000);
