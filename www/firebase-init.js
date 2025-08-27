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
    // 참고: sendPasswordReset 함수는 login.html 페이지에서만 필요하므로 여기서는 제외해도 됩니다.
  };

  // =================================================================
  // ▼▼▼ 인증 준비 완료를 알려주는 Promise 생성 (핵심 로직) ▼▼▼
  // =================================================================
  let authReadyResolver;
  window.fastmateApp.authReady = new Promise((resolve) => {
    authReadyResolver = resolve; // resolve 함수를 외부에서 호출할 수 있도록 저장
  });

  
  // 3) 라우팅 가드(필요한 최소만)
  const path = () => location.pathname;
  const isAuthPage = () => /\/(login|signup)\.html$/i.test(path());
  const isProtected = () => /\/(fastmate|signup-step2)\.html$/i.test(path()); // app.html 안 씀
  const goOnce = (to) => { if (!window.__AUTH_NAV__) { window.__AUTH_NAV__ = true; location.replace(to); } };

  // 4) 로그인 시작(버튼 클릭용)
// Firebase JS SDK에서 가져오는 것이 아니라, Capacitor 플러그인을 직접 사용합니다.

window.signInWithGoogle = async function () {
  const provider = new firebase.auth.GoogleAuthProvider();

  // Capacitor 앱 환경인지 확인
  if (window.Capacitor?.isNativePlatform()) {
       try {
      // ⬇️ 여기 3줄이 핵심
      const { credential } = await window.FirebaseAuthentication.signInWithGoogle();
      const googleCred = firebase.auth.GoogleAuthProvider.credential(credential?.idToken);
      await firebase.auth().signInWithCredential(googleCred);
      console.log("웹 로그인 성공!");
    } catch (error) {
      if (error.message !== 'canceled') {
        console.error("웹 로그인 오류", error);
        alert('웹 로그인에 실패했습니다.');
      }
    }
  } else {
    try {
      await auth.signInWithPopup(provider);
    } catch (error) {
      // 팝업 차단 시엔 자동으로 리다이렉트로 폴백
      if (error.code === 'auth/popup-blocked') {
        await auth.signInWithRedirect(provider);
      } else {
        console.error("웹 로그인 오류", error);
        alert('로그인에 실패했습니다: ' + error.message);
      }
    }
  }
};;

  // 5) 로그인 버튼 자동 바인딩(있으면만)
document.addEventListener('DOMContentLoaded', () => {
  // 구글 로그인 버튼 자동 연결
  const googleBtn = document.getElementById('google-login-btn') 
                 || document.querySelector('[data-role="google-login"]');
  if (googleBtn && !googleBtn.__BOUND__) {            // ⬅️ 가드 추가
    googleBtn.__BOUND__ = true;                       // ⬅️ 가드 추가
    googleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.signInWithGoogle();
    });
  }

  // 비밀번호 재설정 버튼 자동 연결 (기존 그대로)
  const resetBtn = document.getElementById('send-reset-email-btn');
  if (resetBtn && !resetBtn.__BOUND__) {              // ⬅️(선택) 중복 방지
    resetBtn.__BOUND__ = true;
    resetBtn.addEventListener('click', () => {
      const emailInput = document.getElementById('reset-email');
      const email = emailInput ? emailInput.value : null;
      if (!email) return alert('이메일 주소를 입력해주세요.');
      auth.sendPasswordResetEmail(email)
          .then(() => alert(`'${email}' 로 재설정 메일을 보냈습니다.`))
          .catch((error) => {
            console.error("Password reset error:", error);
            alert(`오류가 발생했습니다: ${error.message}`);
          });
    });
  }
});

  // 6) 인증 플로우
// 4) 인증 플로우 실행
  (async function initAuth() {
    
    // =================================================================
    // ▼▼▼ [버그 수정] showApp 함수를 initAuth 내부로 이동 ▼▼▼
    // =================================================================
    function showApp() {
      const splash = document.getElementById('splash-screen');
      if (splash) {
        splash.classList.add('fade-out');
        setTimeout(() => { 
          splash.style.display = 'none'; 
        }, 500);
      }
      document.body.classList.add('loaded');
    }

    try {
      await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

      // (A) 리디렉션 결과 우선 처리 (Google 로그인 등)
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
        
        authReadyResolver(r.user);
        const destination = r.additionalUserInfo?.isNewUser ? '/signup-step2.html' : '/fastmate.html';
        if (location.pathname !== destination) {
            location.replace(destination);
        }
        return;
      }

      // (B) 일반 상태 감지 리스너
      let resolved = false;
       auth.onAuthStateChanged(async (user) => {
    console.log('[auth] state=', !!user, 'path=', location.pathname);
    showApp();

    const p = location.pathname;
    if (!user && /\/(fastmate|signup-step2)\.html$/i.test(p)) { 
      location.replace('/login.html'); 
      return;                     // ← 선택: 리다이렉트 후 추가 실행 방지
    }
    if ( user && /\/(login|signup)\.html$/i.test(p)) { 
      location.replace('/fastmate.html'); 
      return;                     // ← 선택
    }

    if (!resolved) { resolved = true; authReadyResolver(user); }
  });

} catch (e) {
  console.error('[auth init]', e);
  alert(`인증 초기화 오류: ${e.message}`);
  showApp();
  authReadyResolver(null);
}
})();   // ← IIFE 닫기
}