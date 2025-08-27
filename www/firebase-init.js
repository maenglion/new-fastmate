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
    sendPasswordReset: function() {
      const emailInput = document.getElementById('reset-email'); 
      if (!emailInput) return; 

      const email = emailInput.value;
      if (!email) {
        alert('비밀번호를 찾으려는 이메일 주소를 입력해주세요.');
        return;
      }

      auth.sendPasswordResetEmail(email)
        .then(() => {
          alert(`'${email}' 주소로 비밀번호 재설정 이메일을 보냈습니다. 받은편지함을 확인해주세요.`);
        })
        .catch((error) => {
          console.error("Password reset error:", error);
          alert(`오류가 발생했습니다. 이메일 주소를 확인해주세요. (${error.code})`);
        });
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
    // --- 앱(안드로이드/iOS)을 위한 네이티브 로그인 코드 ---
    try {
      console.log('FirebaseAuthentication 플러그인 객체:', window.FirebaseAuthentication);
      const result = await window.FirebaseAuthentication.signInWithGoogle();
      await auth.signInWithCustomToken(result.token);
      console.log("네이티브 로그인 성공!", result.user);
    } catch (error) {
      if (error.message !== 'canceled') {
        console.error("네이티브 로그인 오류", error);
        alert('네이티브 로그인에 실패했습니다.');
      }
    }
  } else {
    // --- 일반 웹사이트를 위한 팝업 로그인 코드 ---
    try {
      const result = await auth.signInWithPopup(provider);
      console.log("웹 로그인 성공!", result.user);
    } catch (error) {
      console.error("웹 로그인 오류", error);
      alert('로그인에 실패했습니다: ' + error.message);
    }
  }
};

  // 5) 로그인 버튼 자동 바인딩(있으면만)
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('google-login-btn') || document.querySelector('[data-role="google-login"]');
    if (btn && !btn.__BOUND__) { btn.__BOUND__ = true; btn.addEventListener('click', e => { e.preventDefault(); window.signInWithGoogle(); }); }
  });

// 로그인/비밀번호찾기 버튼 자동 바인딩
document.addEventListener('DOMContentLoaded', () => {
    // 구글 로그인 버튼 자동 연결
    const googleBtn = document.getElementById('google-login-btn');
    if (googleBtn) {
        googleBtn.addEventListener('click', window.signInWithGoogle);
    }

    // 비밀번호 재설정 버튼 자동 연결
    const resetBtn = document.getElementById('send-reset-email-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            const emailInput = document.getElementById('reset-email');
            const email = emailInput ? emailInput.value : null;

            if (!email) {
                alert('이메일 주소를 입력해주세요.');
                return;
            }

            auth.sendPasswordResetEmail(email)
                .then(() => {
                    alert(`'${email}' 주소로 비밀번호 재설정 이메일을 보냈습니다. 받은편지함을 확인해주세요.`);
                })
                .catch((error) => {
                    console.error("Password reset error:", error);
                    alert(`오류가 발생했습니다: ${error.message}`);
                });
        });
    }
});

  // 6) 인증 플로우
(async function initAuth() {
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
        
        // 리디렉션 후에는 Promise를 즉시 resolve하고 페이지 이동
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

        // ▼▼▼ [핵심 수정] 페이지 이동(리디렉션) 로직 제거 ▼▼▼
        // 페이지 이동은 각 페이지가 authReady를 기다린 후 직접 처리합니다.
        
        // 스플래시 스크린은 여기서 숨겨줍니다.
        showApp();
        
        // 첫 인증 상태가 확정되면 authReady Promise를 resolve합니다.
        if (!resolved) {
          resolved = true;
          authReadyResolver(user);
        }
      });

    } catch (e) {
      console.error('[auth init]', e);
      alert(`인증 초기화 오류: ${e.message}`);
      showApp(); 
      authReadyResolver(null); // 오류 발생 시에도 Promise를 풀어주어 무한 대기 방지
    }
  })();
}
