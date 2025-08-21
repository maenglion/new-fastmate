// firebase-init.js (수정된 최종 버전)

// 1. Firebase 앱 초기화 (fastmate 프로젝트의 올바른 설정값)
const firebaseConfig = {
  apiKey: "AIzaSyCpLWcArbLdVDG6Qd6QoCgMefrXNa2pUs8",
  authDomain: "auth.fastmate.kr",
  projectId: "fastmate-c1c1",
  storageBucket: "fastmate-c1c1.appspot.com",
  messagingSenderId: "879518503068",
  appId: "1:879518503068:web:a140d3a505e61d9a265691"
};

// 2. 초기화 중복 실행 방지 및 공용 공간 생성
// ===== 0) SDK/앱 전역 노출 방지 및 중복 초기화 가드 =====
if (!window.__AUTH_BOOT__) {
  window.__AUTH_BOOT__ = true;

  // ===== 1) Firebase 앱 초기화 (너가 쓰는 프로젝트 설정 유지) =====
  const firebaseConfig = {
    apiKey: "AIzaSyCpLWcArbLdVDG6Qd6QoCgMefrXNa2pUs8",
    authDomain: "auth.fastmate.kr",
    projectId: "fasting-b4ccb",
    storageBucket: "fasting-b4ccb.firebasestorage.app",
    messagingSenderId: "879518503068",
    appId: "1:879518503068:web:295b1d4e21a40f9cc29d59",
    measurementId: "G-EX5HR2CB35"
  };

  // SDK v10 compat 전제 (firebase-*-compat.js)
  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db   = firebase.firestore();

  // 다른 스크립트에서 쓸 수 있게 안전하게 노출
  window.firebaseApp = firebase.app();
  window.auth = auth;
  window.db   = db;

  // ===== 2) 유틸 =====
  const isAuthPage = () => /\/(login|signup)\.html$/i.test(location.pathname);
  const isProtectedPage = () => /\/(fastmate|app|signup-step2)\.html$/i.test(location.pathname);

  function safeGo(to) {
    if (window.__AUTH_NAVIGATED__) return;
    window.__AUTH_NAVIGATED__ = true;
    location.replace(to);
  }

  async function getUserDoc(uid) {
    if (!uid) return null;
    try {
      const snap = await db.collection('users').doc(uid).get();
      return snap.exists ? { id: snap.id, ...snap.data() } : null;
    } catch (e) {
      console.error('[getUserDoc] fail:', e);
      return null;
    }
  }
  window.getUserDoc = getUserDoc; // fastmate.html에서 호출 가능하게 노출

  async function afterAuth(user, additionalUserInfo) {
    if (!user) return;
    try {
      await db.collection('users').doc(user.uid).set({
        uid: user.uid,
        email: user.email || null,
        displayName: user.displayName || null,
        photoURL: user.photoURL || null,
        lastLogin: new Date()
      }, { merge: true });
    } catch (e) {
      console.error("Firestore user update failed:", e);
    }
    // 신규/기존 분기
    additionalUserInfo?.isNewUser ? safeGo('/signup-step2.html') : safeGo('/fastmate.html');
  }

  // ===== 3) 로그인 함수(버튼 바인딩 전용) =====
  window.signInWithGoogle = function () {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithRedirect(provider).catch(e => {
      console.error('[signInWithRedirect] error:', e);
      alert('로그인 시작 중 오류가 발생함');
    });
  };

  // 버튼 자동 바인딩 (id="google-login-btn")
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('google-login-btn');
    if (btn && !btn.__BOUND__) {
      btn.__BOUND__ = true;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        window.signInWithGoogle();
      });
    }
  });

  // ===== 4) 초기 인증 플로우 =====
  (async function initAuthFlow() {
    try {
      await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

      // 리디렉션 결과 우선 처리
      const result = await auth.getRedirectResult();
      if (result?.user) {
        console.log('[auth] redirect OK:', result.user.uid);
        await afterAuth(result.user, result.additionalUserInfo);
        return;
      }

      // 상태 리스너
      auth.onAuthStateChanged((user) => {
        console.log('[auth] state:', !!user, 'path=', location.pathname);
        if (user) {
          // 로그인 상태
          if (isAuthPage()) safeGo('/fastmate.html');
        } else {
          // 비로그인 상태
          if (isProtectedPage()) safeGo('/login.html');
        }
      });

    } catch (e) {
      console.error('[auth init] error:', e);
      alert(`인증 초기화 오류: ${e.message}`);
    }
  })();
}

