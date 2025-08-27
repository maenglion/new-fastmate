// --- hard guard: must run before anything ---
// 어떤 경우에도 showApp 함수가 존재하도록 보장하는 코드
window.showApp = window.showApp || function () {
  const s = document.getElementById('splash-screen');
  if (s) { s.classList.add('fade-out'); setTimeout(() => (s.style.display = 'none'), 500); }
  document.body?.classList?.add?.('loaded');
};

// /firebase-init.js — 단일 파일, 최소 로직
if (!window.__AUTH_BOOT__) {
  window.__AUTH_BOOT__ = true;

  // 1) Firebase 초기화
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

  // 2) 전역 앱 객체
  window.fastmateApp = {
    auth,
    db,
    getUserDoc: async (uid) => {
      if (!uid) return null;
      try {
        const s = await db.collection('users').doc(uid).get();
        return s.exists ? { id: s.id, ...s.data() } : null;
      } catch (e) { console.error('[getUserDoc]', e); return null; }
    },
    signOutUser: function() {
      auth.signOut()
        .then(() => {
          console.log('User signed out successfully');
          window.location.href = '/login.html';
        })
        .catch((error) => {
          console.error('Sign out error:', error);
          alert('로그아웃 중 오류가 발생했습니다.');
        });
    }
  };

  // 3) 인증 준비 완료 Promise 생성
  let authReadyResolver;
  window.fastmateApp.authReady = new Promise((resolve) => {
    authReadyResolver = resolve;
  });

  // 4) 구글 로그인 함수
  window.signInWithGoogle = async function () {
    // ... (이전과 동일한 로그인 로직)
  };

  // 5) 로그인 버튼 자동 바인딩
  document.addEventListener('DOMContentLoaded', () => {
    const googleBtn = document.getElementById('google-login-btn');
    if (googleBtn) {
        googleBtn.addEventListener('click', window.signInWithGoogle);
    }
  });

  // 6) 인증 플로우 실행
  (async function initAuth() {
    
    const path = () => location.pathname;
    const isAuthPage  = () => /\/(login|signup)(?:\.html)?/i.test(path());
    const isProtected = () => /\/(fastmate|signup-step2)(?:\.html)?/i.test(path());

    function routeAfterAuth(user) {
      if (!user && isProtected()) {
        return location.replace('/login.html');
      }
      if (user && isAuthPage()) {
        return location.replace('/fastmate.html');
      }
    }

    try {
      await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

      const r = await auth.getRedirectResult();
      if (r?.user) {
        // ... (리디렉션 처리 로직)
        authReadyResolver(r.user);
        const destination = r.additionalUserInfo?.isNewUser ? '/signup-step2.html' : '/fastmate.html';
        if (path() !== destination) {
            location.replace(destination);
        }
        return;
      }

      let resolved = false;
      auth.onAuthStateChanged(async (user) => {
        console.log('[auth] state=', !!user, 'path=', path());
        window.showApp();
        routeAfterAuth(user);
        
        if (!resolved) {
          resolved = true;
          authReadyResolver(user);
        }
      });

    } catch (e) {
      console.error('[auth init]', e);
      alert(`인증 초기화 오류: ${e.message}`);
      window.showApp(); 
      authReadyResolver(null);
    }
  })();
}
