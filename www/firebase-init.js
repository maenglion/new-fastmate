// /firebase-init.js — v8.5 (공통)

// panic refresh: https://fastmate.kr/fastmate.html?nocache=1 로 들어오면 캐시/서비스워커 제거
(function panicRefresh(){
  try {
    const u = new URL(location.href);
    if (u.searchParams.get('nocache') === '1') {
      (async () => {
        try {
          if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map(k => caches.delete(k)));
          }
        } catch {}
        try {
          if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map(r => r.unregister()));
          }
        } catch {}
        try { localStorage.clear(); sessionStorage.clear(); } catch {}
        u.searchParams.delete('nocache');
        location.replace(u.toString());
      })();
    }
  } catch {}
})();



(() => {
  'use strict';

  // 중복 로드 방지 + 전역 버전 표기
  if (window.__AUTH_BOOT__) return;
  window.__AUTH_BOOT__ = true;
  window.__APP_VERSION__ = '2025.09.06-v8.5';
  console.log('[fastmate] version', window.__APP_VERSION__);

  // 스플래시 가드(다른 스크립트보다 먼저 안전하게 호출 가능)
  if (!window.showApp) {
    window.showApp = function () {
      const s = document.getElementById('splash-screen');
      if (s) { s.classList.add('fade-out'); setTimeout(() => (s.style.display = 'none'), 400); }
      document.body?.classList?.add?.('loaded');
    };
  }

  // ---------- Firebase 초기화(v8) ----------
  const cfg = {
    apiKey: "AIzaSyCpLWcArbLdVDG6Qd6QoCgMefrXNa2pUs8",
    authDomain: "auth.fastmate.kr",
    projectId: "fasting-b4ccb",
    storageBucket: "fasting-b4ccb.firebasestorage.app",
    messagingSenderId: "879518503068",
    appId: "1:879518503068:web:295b1d4e21a40f9cc29d59",
    measurementId: "G-EX5HR2CB35"
  };
  if (!firebase.apps.length) firebase.initializeApp(cfg);
  const auth = firebase.auth();
  const db   = firebase.firestore();

  // Firestore settings — 한 번만
  if (!db.__SETTINGS_APPLIED__) {
    try { db.settings({ experimentalForceLongPolling: true }); }
    catch(_) {}
    db.__SETTINGS_APPLIED__ = true;
  }

  // 디바이스 언어
  try { auth.useDeviceLanguage && auth.useDeviceLanguage(); } catch {}

  // 전역 유틸(기존 코드 호환용 이름까지 모두 export)
  async function getUserDoc(uid) {
    const id = uid || auth.currentUser?.uid;
    if (!id) return null;
    try {
      const s = await db.collection('users').doc(id).get();
      return s.exists ? { id: s.id, ...s.data() } : null;
    } catch (e) { console.error('[getUserDoc]', e); return null; }
  }
  async function upsertUserDoc(user) {
    const ref = db.collection('users').doc(user.uid);
    await ref.set({
      uid: user.uid,
      email: user.email ?? '',
      displayName: user.displayName ?? '',
      photoURL: user.photoURL ?? '',
      provider: user.providerData?.[0]?.providerId ?? 'unknown',
      lastLoginAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdAt  : firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }
  async function ensureUserProfile(data){
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('not-authenticated');
    await db.collection('users').doc(uid).set(data, { merge:true });
  }
  function hasValue(x){ return Array.isArray(x) ? x.length>0 : (x!=null && String(x).trim()!==''); }
  function isProfileDone(u){
    const nick = u?.nickname;
    const goals = u?.goals ?? u?.purpose ?? u?.joinPurpose ?? u?.onboarding?.reasons;
    const completed = u?.onboarding?.completed === true;
    return hasValue(nick) && (hasValue(goals) || completed);
  }

  // 전역 export (예전 코드에서 전역 함수로 직접 호출하므로 그대로 노출)
  window.fastmateApp = { auth, db, getUserDoc, ensureUserProfile, upsertUserDoc };
  window.getUserDoc = getUserDoc;
  window.ensureUserProfile = ensureUserProfile;
  window.upsertUserDoc = upsertUserDoc;
  // ✅ 원래 쓰던 onAuthStateChanged 로직 유지 (리다이렉트/하이드레이션/마지막에 window.showApp())

// ⛑ 세이프가드: DOM 붙자마자/로드 직후 한 번씩 showApp 시도(중복 호출 안전)
document.addEventListener('DOMContentLoaded', () => { setTimeout(() => window.showApp?.(), 0); });
window.addEventListener('load', () => { setTimeout(() => window.showApp?.(), 200); });


  // ---------- 라우팅 헬퍼 ----------
  const ROUTES = {
    index:   '/index.html',
    login:   '/login.html',
    signup:  '/signup.html',
    fastmate:'/fastmate.html'
  };
  const path = () => (location.pathname || '/').toLowerCase();
  const isIndex    = () => path() === '/' || /\/index\.html$/.test(path());
  const isLogin    = () => /\/login(\.html)?$/.test(path());
  const isSignup   = () => /\/signup(\.html)?$/.test(path());
  const isFastmate = () => /\/fastmate(\.html)?$/.test(path());
  const isProtected= () => isFastmate(); // 보호 페이지 지정
  const useHtmlStyle = () => /\.html$/i.test(location.pathname);
  const toUrl = (key) => {
    const base = ROUTES[key] || '/';
    const final = useHtmlStyle() ? base : base.replace(/\/index\.html$/i, '/');
    const u = new URL(final, location.origin);
    u.searchParams.set('authcb', Date.now().toString()); // SW 캐시 회피
    return u.toString();
  };
  const goOnce = (to) => { if (!window.__AUTH_NAV__) { window.__AUTH_NAV__ = true; location.replace(to); } };

  // 인앱/웹뷰 감지 + 예쁜 경고
  function isInApp(){
    const ua = navigator.userAgent || '';
    return /; wv\)/i.test(ua) || /FBAN|FBAV|FB_IAB|Instagram|KAKAOTALK|NAVER|DaumApps/i.test(ua);
  }
  function showInAppWarning(){
    if (document.getElementById('inapp-overlay')) return;
    const el = document.createElement('div');
    el.id = 'inapp-overlay';
    el.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:99999;
      font-family:system-ui,-apple-system,Segoe UI,Roboto,Apple SD Gothic Neo,'Noto Sans KR',sans-serif;
    `;
    el.innerHTML = `
      <div style="background:#fff;border-radius:16px;max-width:440px;width:88%;padding:22px;box-shadow:0 10px 30px rgba(0,0,0,.2)">
        <div style="font-size:18px;font-weight:700;margin-bottom:10px">인앱 브라우저에서는 로그인할 수 없어요</div>
        <div style="font-size:14px;line-height:1.5;color:#444">
          우상단 메뉴에서 <b>“기본 브라우저로 열기(Chrome/Safari)”</b>를 선택해 로그인해주세요.
        </div>
        <div style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end">
          <button id="inapp-ok" style="padding:10px 14px;border-radius:10px;border:0;background:#111;color:#fff;cursor:pointer">확인</button>
        </div>
      </div>`;
    document.body.appendChild(el);
    el.querySelector('#inapp-ok')?.addEventListener('click', () => el.remove());
  }

  // ---------- 로그인 시작(버튼에서 호출) ----------
  window.signInWithGoogle = function () {
    if (isInApp()) { showInAppWarning(); return; }

    const provider = new firebase.auth.GoogleAuthProvider();

    // iOS/Safari/웹뷰는 redirect가 안전
    const ua = navigator.userAgent || '';
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
    const preferRedirect = (isIOS && !standalone) || isSafari;

    sessionStorage.setItem('oauthBusy', '1');
    document.body.classList.add('oauth-busy');

    const done = () => { sessionStorage.removeItem('oauthBusy'); document.body.classList.remove('oauth-busy'); };

    if (preferRedirect) {
      auth.signInWithRedirect(provider).catch(err => { console.error(err); done(); alert('로그인 시작 오류'); });
    } else {
      auth.signInWithPopup(provider)
        .then(async r => { if (r?.user) await upsertUserDoc(r.user); })
        .catch(async (err) => {
          console.warn('[popup err]', err?.code, err?.message);
          if (String(err?.code||'').includes('popup')) return auth.signInWithRedirect(provider);
          alert('로그인 실패');
        })
        .finally(done);
    }
  };

  // 비밀번호 재설정(있을 때만)
  document.addEventListener('DOMContentLoaded', () => {
    const btns = [
      document.getElementById('google-login-btn'),
      document.getElementById('googleSignupBtn'),
      document.querySelector('[data-role="google-login"]')
    ].filter(Boolean);
    btns.forEach(btn => {
      if (!btn.__BOUND__) {
        btn.__BOUND__ = true;
        btn.addEventListener('click', e => { e.preventDefault(); window.signInWithGoogle(); });
      }
    });

    const resetBtn = document.getElementById('send-reset-email-btn');
    if (resetBtn && !resetBtn.__BOUND__) {
      resetBtn.__BOUND__ = true;
      resetBtn.addEventListener('click', async () => {
        const email = document.getElementById('reset-email')?.value?.trim();
        if (!email) return alert('비밀번호를 찾을 이메일을 입력해주세요.');
        try { await auth.sendPasswordResetEmail(email); alert(`'${email}'로 재설정 메일을 보냈습니다.`); }
        catch(e){ alert(`오류: ${e.code}`); }
      });
    }
  });

  // ---------- OAuth 리디렉션 결과 → 온보딩/메인 분기 ----------
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
      .catch(() => auth.setPersistence(firebase.auth.Auth.Persistence.SESSION))
      .then(() => auth.getRedirectResult())
      .then(async (result) => {
          if (result.user) {
              // 로그인/회원가입 성공 후 리디렉션된 경우
              sessionStorage.removeItem('oauthBusy');
              const user = result.user;

              // [핵심] DB에 사용자 정보가 없으면 생성/업데이트
              await upsertUserDoc(user); 

              // [핵심] 이 사용자가 온보딩(프로필 작성)을 마쳤는지 확인
              const profile = await getUserDoc(user.uid);
              const isReady = isProfileDone(profile);

              if (isReady) {
                  // 이미 온보딩을 마친 기존 사용자 -> 바로 메인 앱 페이지로 이동
                  goOnce(toUrl('fastmate'));
              } else {
                  // 새로운 사용자 -> 온보딩을 위해 signup.html 페이지로 이동 (또는 머무름)
                  if (!isSignup()) {
                      goOnce(toUrl('signup'));
                  } else {
                      // 이미 signup 페이지에 있다면 step=2로 상태만 변경
                      const url = new URL(location.href);
                      url.searchParams.set('step', '2');
                      history.replaceState(null, '', url.toString());
                      window.showApp?.(); // 스플래시 스크린 숨기기
                  }
              }
          }
      })
      .catch((error) => {
          sessionStorage.removeItem('oauthBusy');
          console.error('[redirect err]', error);
          // 사용자가 팝업을 닫는 등 일반적인 오류는 무시
          if (error.code !== 'auth/cancelled-popup-request' && error.code !== 'auth/popup-closed-by-user') {
               alert(`로그인 중 오류가 발생했습니다: ${error.message}`);
          }
      });

  // ---------- 일반 상태 감지 ----------
// firebase-init.js 파일

// firebase-init.js 파일의 onAuthStateChanged 함수 전체를 이걸로 교체

auth.onAuthStateChanged(async (user) => {
    const p = path();
    console.log('[auth] state=', !!user, 'path=', p);

    if (!user) {
      if (isProtected() && !isLogin()) return goOnce(toUrl('login'));
      window.showApp?.();
      return;
    }
    
    // 초대 처리를 최우선으로 실행
    const pendingChallengeId = sessionStorage.getItem('pendingChallengeId');
    if (pendingChallengeId) {
        sessionStorage.removeItem('pendingChallengeId');
        // goOnce를 사용하여 안전하게 이동
        return goOnce(`${window.location.origin}/challenge-invite.html?id=${pendingChallengeId}`);
    }

    upsertUserDoc(user).catch(e => console.warn('[upsert]', e));

    const prof = await getUserDoc(user.uid);
    const done = isProfileDone(prof);

    if ((isIndex() || isLogin()) && !isSignup()) {
      if (!done) return goOnce(toUrl('signup'));
      return goOnce(toUrl('fastmate'));
    }

    if (isSignup()) {
      const url = new URL(location.href);
      url.searchParams.set('step', done ? 'final' : '2');
      history.replaceState(null, '', url.toString());
      window.showApp?.();
      return;
    }

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
        if (!done) openOnboardingModal();
        if (!window.__WIRED__) { window.__WIRED__ = true; try { window.wireEventsOnce?.(); } catch {} }
      } catch(e){ console.warn('[fastmate hydrate]', e); }
      window.showApp?.();
    }
});

  // 간단 온보딩 모달(닉네임/목표 입력)
  function openOnboardingModal(){
    if (document.getElementById('fm-onboard')) return;
    const wrap = document.createElement('div');
    wrap.id = 'fm-onboard';
    wrap.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45);z-index:99999';
    wrap.innerHTML = `
      <div style="background:#fff;border-radius:16px;max-width:520px;width:92%;padding:20px;box-shadow:0 10px 30px rgba(0,0,0,.2);font-family:system-ui,-apple-system,Segoe UI,Roboto,Apple SD Gothic Neo,Noto Sans KR,sans-serif">
        <div style="font-size:18px;font-weight:700;margin-bottom:8px">프로필을 마치면 더 정확해져요</div>
        <label style="display:block;font-size:13px;color:#444;margin-top:12px">닉네임</label>
        <input id="fm-nick" style="width:100%;padding:10px 12px;border-radius:10px;border:1px solid #ddd;outline:none">
        <label style="display:block;font-size:13px;color:#444;margin-top:12px">목표(한 줄)</label>
        <input id="fm-goal" style="width:100%;padding:10px 12px;border-radius:10px;border:1px solid #ddd;outline:none" placeholder="예: 16:8 간헐적 단식 꾸준히">
        <div style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end">
          <button id="fm-skip" style="padding:10px 14px;border-radius:10px;border:0;background:#eee;cursor:pointer">나중에</button>
          <button id="fm-save" style="padding:10px 14px;border-radius:10px;border:0;background:#111;color:#fff;cursor:pointer">저장</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    wrap.querySelector('#fm-skip')?.addEventListener('click', () => wrap.remove());
    wrap.querySelector('#fm-save')?.addEventListener('click', async () => {
      const nickname = document.getElementById('fm-nick').value.trim();
      const goals    = document.getElementById('fm-goal').value.trim();
      try {
        await ensureUserProfile({ nickname, goals, onboarding: { completed: true }});
        // 칩 갱신
        const chipName = document.getElementById('userChipName');
        if (chipName && nickname) chipName.textContent = nickname;
        wrap.remove();
      } catch(e){ alert('저장 오류'); }
    });
  }
  })();

  