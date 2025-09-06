// /firebase-init.js  — 단일 파일, 최소 로직

// 리디렉션 후 복귀했는데 바디가 'oauth-busy'로 남아있을 수 있으니 즉시 해제 시도
try {
  if (sessionStorage.getItem('oauthBusy') === '1') {
    document.body.classList.remove('oauth-busy');
    // 해제는 일단 하고, 실제 로그인 시 다시 붙음
    sessionStorage.removeItem('oauthBusy');
  }
} catch {}

// (0) showApp 전역 하드가드: 어떤 스크립트가 먼저 호출해도 안전
if (!window.showApp) {
  window.showApp = function () {
    const s = document.getElementById('splash-screen');
    if (s) { s.classList.add('fade-out'); setTimeout(() => (s.style.display = 'none'), 500); }
    document.body?.classList?.add?.('loaded');
  };
}

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
      if (!emailInput) return; // forgot-password.html에서만 존재
      const email = emailInput.value;
      if (!email) return alert('비밀번호를 찾으려는 이메일 주소를 입력해주세요.');
      auth.sendPasswordResetEmail(email)
        .then(() => alert(`'${email}' 주소로 비밀번호 재설정 이메일을 보냈습니다. 받은편지함을 확인해주세요.`))
        .catch((error) => {
          console.error("Password reset error:", error);
          alert(`오류가 발생했습니다. 이메일 주소를 확인해주세요. (${error.code})`);
        });
    },
    signOutUser: function () {
      auth.signOut()
        .then(() => {
          console.log('User signed out successfully');
          // 현재 페이지의 스타일(.html 유무)에 맞춰 이동
          const useHtml = /\.html$/i.test(location.pathname);
          location.href = `/login${useHtml ? '.html' : ''}`;
        })
        .catch((error) => {
          console.error('Sign out error:', error);
          alert('로그아웃 중 오류가 발생했습니다.');
        });
    }
  };

  // 3) 라우팅 가드(필요한 최소만)
  const path = () => location.pathname;
  const isAuthPage   = () => /\/(login|signup)(?:\.html)?$/i.test(path());
  const isProtected  = () => /\/(fastmate|signup-step2)(?:\.html)?$/i.test(path());
  const goOnce = (to) => { if (!window.__AUTH_NAV__) { window.__AUTH_NAV__ = true; location.replace(to); } };
  const toUrl = (base) => `/${base}${/\.html$/i.test(path()) ? '.html' : ''}`; // 현재 URL 스타일 따라감

  // 4) 로그인 시작(버튼 클릭용)

window.signInWithGoogle = function () {
  const provider = new firebase.auth.GoogleAuthProvider();

  // 플래그: OAuth 중엔 스플래시만 보이게
  sessionStorage.setItem('oauthBusy', '1');
  document.body.classList.add('oauth-busy');

  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  const preferRedirect = (isIOS && !standalone) || isSafari; // iOS 웹뷰/Safari는 redirect가 안전

  if (preferRedirect) {
    firebase.auth().signInWithRedirect(provider).catch(err => {
      sessionStorage.removeItem('oauthBusy');
      document.body.classList.remove('oauth-busy');
      console.error(err); alert('로그인 시작 오류');
    });
  } else {
    firebase.auth().signInWithPopup(provider).then(async (r) => {
      // 사용자 upsert
      const u = r.user;
      try {
        await firebase.firestore().collection('users').doc(u.uid).set({
          uid: u.uid, email: u.email || null,
          displayName: u.displayName || null, photoURL: u.photoURL || null,
          lastLogin: new Date()
        }, { merge: true });
      } catch(e){ console.warn('upsert fail', e); }

      // 바로 진입
      location.replace('/fastmate.html');
    }).catch(err => {
      console.error(err); alert('로그인 실패');
    }).finally(() => {
      sessionStorage.removeItem('oauthBusy');
      document.body.classList.remove('oauth-busy');
    });
  }
};



  // 5) 로그인/비밀번호찾기 버튼 자동 바인딩(있으면만)
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('google-login-btn') || document.querySelector('[data-role="google-login"]');
    if (btn && !btn.__BOUND__) {
      btn.__BOUND__ = true;
      btn.addEventListener('click', e => { e.preventDefault(); window.signInWithGoogle(); });
    }

    const resetBtn = document.getElementById('send-reset-email-btn');
    if (resetBtn && !resetBtn.__BOUND__) {
      resetBtn.__BOUND__ = true;
      resetBtn.addEventListener('click', () => window.fastmateApp.sendPasswordReset());
    }
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

        return r.additionalUserInfo?.isNewUser
          ? goOnce(toUrl('signup-step2'))
          : goOnce(toUrl('fastmate'));
      }

      // redirect 결과가 없으면 바디 막힘 방지
document.body.classList.remove('oauth-busy');
sessionStorage.removeItem('oauthBusy');


      // (B) 일반 상태 감지
      auth.onAuthStateChanged(async (user) => {
        console.log('[auth] state=', !!user, 'path=', path());

        // 1) 먼저 리디렉션 여부 결론
        if (user && isAuthPage())  return goOnce(toUrl('fastmate'));
        if (!user && isProtected()) return goOnce(toUrl('login'));

        // 2) 페이지에 머무는 게 확정 → 스플래시 먼저 치움(전역 가드 사용)
        window.showApp?.();

        // 3) 로그인 상태에서만 fastmate 초기 UI 수화
        if (user && /\/fastmate(?:\.html)?$/i.test(path())) {
 try {
            const userChip = document.getElementById('userChip');
            const userChipName = document.getElementById('userChipName');            
            const profile = await window.fastmateApp.getUserDoc(user.uid);

if (userChip && userChipName) {
  const nickname = profile?.nickname || profile?.displayName || user.displayName || '사용자';
  userChipName.textContent = nickname;
  userChip.style.display = 'flex';
}

const savedFasting = profile?.currentFasting;
            if (savedFasting && window.hydrateFastingTimer) {
              window.hydrateFastingTimer(savedFasting);
            } else {
              if (window.initializeTime) window.initializeTime();
            }
          } catch (e) { console.warn('[fastmate hook]', e); }

          if (window.updateUIState) window.updateUIState();
          if (!window.__WIRED__) {
            window.__WIRED__ = true;
            if (window.wireEventsOnce) { try { window.wireEventsOnce(); } catch (e) {} }
          }
        }
      });

    } catch (e) {
      console.error('[auth init]', e);
      alert(`인증 초기화 오류: ${e.message}`);
      window.showApp?.(); // 안전하게 스플래시 제거
    }
  })();
}
