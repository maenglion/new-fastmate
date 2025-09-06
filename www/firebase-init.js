// /firebase-init.js  — v8 전용 (모든 페이지 공용)
'use strict';

const APP_VERSION = '2025.09.06-v8.2';
window.__APP_VERSION__ = APP_VERSION;
console.log('[fastmate] version', APP_VERSION);

// ---- Firebase init (v8) ----
var cfg = {
  apiKey: "AIzaSyCpLWcArbLdVDG6Qd6QoCgMefrXNa2pUs8",
  authDomain: "auth.fastmate.kr",
  projectId: "fasting-b4ccb",
  storageBucket: "fasting-b4ccb.firebasestorage.app",
  messagingSenderId: "879518503068",
  appId: "1:879518503068:web:295b1d4e21a40f9cc29d59",
  measurementId: "G-EX5HR2CB35"
};
Object.freeze(cfg);

if (!firebase.apps.length) firebase.initializeApp(cfg);

var auth = firebase.auth();
var db   = firebase.firestore();

// v8: 네트워크 이슈 회피 (단 1회만!)
try { db.settings({ experimentalForceLongPolling: true }); } catch (e) {}
try { auth.useDeviceLanguage(); } catch (e) {}

// ---- helpers ----
function path(){ return (location.pathname || '/').toLowerCase(); }
function isIndex(){ return path() === '/' || path().endsWith('/index.html'); }
function isLogin(){ return path().endsWith('/login.html'); }
function isSignup(){ return path().endsWith('/signup.html'); }
function isFastmate(){ return path().endsWith('/fastmate.html'); }
function isProtected(){ return isFastmate(); } // 필요시 보호 페이지 추가

function toUrl(p){ 
  var u = new URL(p, location.origin);
  u.searchParams.set('authcb', Date.now().toString());
  return u.toString();
}
function go(to){ if (!window.__AUTH_NAV__) { window.__AUTH_NAV__ = true; location.replace(to); } }

// 스플래시 해제(있으면)
try {
  if (sessionStorage.getItem('oauthBusy') === '1') {
    document.body.classList.remove('oauth-busy');
    sessionStorage.removeItem('oauthBusy');
  }
} catch {}

// ---- Google 로그인/로그아웃 ----
window.signInWithGoogle = function () {
  var ua = navigator.userAgent || '';
  var isIOS = /iPad|iPhone|iPod/.test(ua);
  var isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  var inApp = /; wv\)/i.test(ua) || /FBAN|FBAV|FB_IAB|Instagram|KAKAOTALK|NAVER|DaumApps/i.test(ua);
  if (inApp) return alert('인앱 브라우저에서는 Google 로그인이 제한됩니다. 기본 브라우저로 열어주세요.');

  var provider = new firebase.auth.GoogleAuthProvider();
  var preferRedirect = isIOS || isSafari || inApp;

  sessionStorage.setItem('oauthBusy','1');
  document.body.classList.add('oauth-busy');

  var done = () => { sessionStorage.removeItem('oauthBusy'); document.body.classList.remove('oauth-busy'); };

  if (preferRedirect) {
    auth.signInWithRedirect(provider).catch(e => { done(); alert('로그인 오류: '+(e.message||e.code)); });
  } else {
    auth.signInWithPopup(provider)
      .then(r => r && r.user ? upsertUserDoc(r.user) : null)
      .catch(e => {
        if (String(e && e.code || '').includes('popup')) return auth.signInWithRedirect(provider);
        alert('로그인 실패: '+(e.message||e.code));
      })
      .finally(done);
  }
};

window.signOutFastmate = function(){ return auth.signOut().then(() => location.replace('/login.html')); };

// ---- redirect result 선회수 ----
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
  .catch(() => auth.setPersistence(firebase.auth.Auth.Persistence.SESSION));

auth.getRedirectResult().then(async (res) => {
  if (res && res.user) await afterAuth(res.user, res.additionalUserInfo);
}).catch(e => console.warn('[redirectResult]', e.code, e.message));

// ---- 상태 구독 ----
auth.onAuthStateChanged(async (user) => {
  console.log('[auth] state=', !!user, 'path=', path());

  if (!user) {
    if (isProtected()) return go('/login.html');
    return; // 로그인/인덱스/사인업에선 그대로
  }

  // 로그인됨
  try { await upsertUserDoc(user); } catch(e) { console.warn('[upsert fail]', e); }

  // 온보딩/프로필 판단
  var prof = await getUserDoc();
  var done = isProfileDone(prof);

  if (!done && !isSignup()) return go(toUrl('/signup.html'));
  if (done && (isIndex() || isLogin() || isSignup())) return go(toUrl('/fastmate.html'));

  // fastmate 화면 수화
  if (isFastmate()) {
    try {
      var userChip = document.getElementById('userChip');
      var nameEl   = document.getElementById('userChipName');
      var nick = prof && (prof.nickname || prof.displayName) || user.displayName || '사용자';
      if (userChip && nameEl) { nameEl.textContent = nick; userChip.style.display = 'flex'; }
      var saved = prof && prof.currentFasting;
      if (saved && window.hydrateFastingTimer) window.hydrateFastingTimer(saved);
      else if (window.initializeTime) window.initializeTime();
      window.updateUIState && window.updateUIState();
      if (!window.__WIRED__) { window.__WIRED__ = true; window.wireEventsOnce && window.wireEventsOnce(); }
    } catch (e) { console.warn('[fastmate hydrate]', e); }
  }
});

// ---- 데이터 유틸 ----
function hasValue(x){ return Array.isArray(x) ? x.length>0 : (x!=null && String(x).trim()!==''); }
function isProfileDone(u){
  var nick = u && u.nickname;
  var goals = (u && (u.goals || u.purpose || u.joinPurpose || (u.onboarding && u.onboarding.reasons)));
  var completed = u && u.onboarding && u.onboarding.completed === true;
  return hasValue(nick) && (hasValue(goals) || completed);
}

async function getUserDoc(uid){
  var id = uid || (auth.currentUser && auth.currentUser.uid);
  if (!id) return null;
  try {
    var s = await db.collection('users').doc(id).get();
    return s.exists ? Object.assign({id:s.id}, s.data()) : null;
  } catch (e) { console.error('[getUserDoc]', e); return null; }
}

async function upsertUserDoc(user){
  var ref = db.collection('users').doc(user.uid);
  return ref.set({
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || '',
    photoURL: user.photoURL || '',
    provider: (user.providerData && user.providerData[0] && user.providerData[0].providerId) || 'unknown',
    lastLoginAt: firebase.firestore.FieldValue.serverTimestamp(),
    createdAt : firebase.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
}

window.getUserDoc = getUserDoc;
window.ensureUserProfile = async function(data){
  var uid = auth.currentUser && auth.currentUser.uid;
  if (!uid) throw new Error('not-authenticated');
  return db.collection('users').doc(uid).set(data, { merge:true });
};
window.upsertUserDoc = upsertUserDoc;

// ---- 버튼 바인딩 ----
document.addEventListener('DOMContentLoaded', () => {
  ['google-login-btn','googleSignupBtn'].forEach(id => {
    var btn = document.getElementById(id);
    if (btn && !btn.__BOUND__) { btn.__BOUND__ = true; btn.addEventListener('click', (e) => { e.preventDefault(); window.signInWithGoogle(); }); }
  });
  var resetBtn = document.getElementById('send-reset-email-btn');
  if (resetBtn && !resetBtn.__BOUND__) {
    resetBtn.__BOUND__ = true;
    resetBtn.addEventListener('click', () => {
      var email = (document.getElementById('reset-email') || {}).value;
      if (!email) return alert('비밀번호를 찾을 이메일을 입력해주세요.');
      auth.sendPasswordResetEmail(String(email).trim())
        .then(() => alert(`'${email}'로 재설정 메일을 보냈습니다.`))
        .catch(e => alert(`오류: ${e.code}`));
    });
  }
});

// ---- 최후 안전장치 (렌더 막힘 안내) ----
setTimeout(() => {
  try {
    var container = document.getElementById('app') || document.querySelector('#root,#app-root,main');
    if (!container) return;
    if (container.childElementCount > 0 || document.querySelector('[data-fastmate-ready]')) return;
    var p = path();
    if (/\/(fastmate|signup|login)(?:\.html)?$/.test(p)) return;
    container.innerHTML = '<div style="padding:16px;font-family:sans-serif">로그인은 되었지만 다음 화면으로 이동하지 못했습니다. 새로고침을 눌러주세요.</div>';
  } catch {}
}, 4000);
