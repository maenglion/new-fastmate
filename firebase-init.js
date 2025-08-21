// /firebase-init.js  — 단일 파일, 최소 로직

if (!window.__AUTH_BOOT__) {
  window.__AUTH_BOOT__ = true;

  // 1) Firebase 초기화 (현재 설정 유지)
  const firebaseConfig = {
    apiKey: "AIzaSyCpLWcArbLdVDG6Qd6QoCgMefrXNa2pUs8",
    authDomain: "auth.fastmate.kr",
    projectId: "fasting-b4ccb",
    storageBucket: "fasting-b4ccb.firebasestorage.app",
    messagingSenderId: "879518503068",
    appId: "1:879518503068:web:295b1d4e21a40f9cc29d59",
    measurementId: "G-EX5HR2CB35"
  };
  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db   = firebase.firestore();

  // 2) 전역(필요 시 사용할 수 있게)
  window.fastmateApp = {
    auth,
    db,
    getUserDoc: async (uid) => {
      if (!uid) return null;
      try {
        const s = await db.collection('users').doc(uid).get();
        return s.exists ? { id: s.id, ...s.data() } : null;
      } catch (e) { console.error('[getUserDoc]', e); return null; }
    }
  };

  // 3) 라우팅 가드(필요한 최소만)
  const path = () => location.pathname;
  const isAuthPage = () => /\/(login|signup)\.html$/i.test(path());
  const isProtected = () => /\/(fastmate|signup-step2)\.html$/i.test(path()); // app.html 안 씀
  const goOnce = (to) => { if (!window.__AUTH_NAV__) { window.__AUTH_NAV__ = true; location.replace(to); } };

  // 4) 로그인 시작(버튼 클릭용)
  window.signInWithGoogle = function () {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithRedirect(provider).catch(e => {
      console.error('[signInWithRedirect]', e);
      alert('로그인 시작 오류 발생함');
    });
  };

  // 5) 로그인 버튼 자동 바인딩(있으면만)
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('google-login-btn') || document.querySelector('[data-role="google-login"]');
    if (btn && !btn.__BOUND__) { btn.__BOUND__ = true; btn.addEventListener('click', e => { e.preventDefault(); window.signInWithGoogle(); }); }
  });

  // 6) 인증 플로우
  (async function initAuth() {
    try {
      await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

      // (A) 리디렉션 결과 우선
      const r = await auth.getRedirectResult();
      if (r?.user) {
        try {
          await db.collection('users').doc(r.user.uid).set({
            uid: r.user.uid,
            email: r.user.email || null,
            displayName: r.user.displayName || null,
            photoURL: r.user.photoURL || null,
            lastLogin: new Date()
          }, { merge: true });
        } catch (e) { console.error('user upsert fail', e); }
        return r.additionalUserInfo?.isNewUser ? goOnce('/signup-step2.html') : goOnce('/fastmate.html');
      }

      // (B) 일반 상태 감지
      auth.onAuthStateChanged(async (user) => {
        console.log('[auth] state=', !!user, 'path=', path());
        if (user) {
          // 로그인 상태에서 로그인/가입 페이지면 앱으로
          if (isAuthPage()) goOnce('/fastmate.html');

          // ▼ fastmate.html 훅: 페이지 안은 그대로 둔 채 기본 초기화만 보장
          if (/\/fastmate\.html$/i.test(path())) {
            try {
              // 사용자 칩(있을 때만)
              const userChip = document.getElementById('userChip');
              const userChipName = document.getElementById('userChipName');
              if (userChip && userChipName) {
                userChipName.textContent = user.displayName || '사용자';
                userChip.style.display = 'flex';
              }

              // 프로필(있으면 쓰고, 없어도 통과)
              const profile = await window.fastmateApp.getUserDoc(user.uid);
              const savedFasting = profile?.currentFasting;
              if (savedFasting && window.hydrateFastingTimer) {
                window.hydrateFastingTimer(savedFasting);
              }
            } catch (e) { console.warn('[fastmate hook]', e); }
            // 페이지가 정의해둔 초기화 함수가 있으면 호출, 없어도 통과
            try { window.initializeTime && window.initializeTime(); } catch(e){}
            try { window.updateUIState && window.updateUIState(); } catch(e){}
            // 이벤트 중복 방지 예시(선택)
            if (!window.__WIRED__) { window.__WIRED__ = true; if (window.wireEventsOnce) try { window.wireEventsOnce(); } catch(e){} }
          }
        } else {
          // 비로그인 상태에서 보호 페이지면 로그인으로
          if (isProtected()) goOnce('/login.html');
        }
      });
  
    } catch (e) {
      console.error('[auth init]', e);
      alert(`인증 초기화 오류: ${e.message}`);
    }
  })();
}
