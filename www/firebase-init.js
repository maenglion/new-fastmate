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
    
    if (!emailInput) {
      return; 
    }

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

  
  // 3) 라우팅 가드(필요한 최소만)
  const path = () => location.pathname;
  const isAuthPage = () => /\/(login|signup)\.html$/i.test(path());
  const isProtected = () => /\/(fastmate|signup-step2)\.html$/i.test(path());
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

      auth.onAuthStateChanged(async (user) => {
        console.log('[auth] state=', !!user, 'path=', path());

        if (user && isAuthPage()) {
          return goOnce('/fastmate.html');
        }
        if (!user && isProtected()) {
          return goOnce('/login.html');
        }

        showApp();

        if (user) {
            if (/\/fastmate\.html$/i.test(path())) {
              try {
                const userChip = document.getElementById('userChip');
                const userChipName = document.getElementById('userChipName');
                if (userChip && userChipName) {
                  userChipName.textContent = user.displayName || '사용자';
                  userChip.style.display = 'flex';
                }
                const profile = await window.fastmateApp.getUserDoc(user.uid);
                const savedFasting = profile?.currentFasting;
                if (savedFasting && window.hydrateFastingTimer) {
                  window.hydrateFastingTimer(savedFasting);
                } else {
                  if(window.initializeTime) window.initializeTime();
                }
              } catch (e) { console.warn('[fastmate hook]', e); }
              
              if(window.updateUIState) window.updateUIState();
              if (!window.__WIRED__) { window.__WIRED__ = true; if (window.wireEventsOnce) try { window.wireEventsOnce(); } catch(e){} }
            }
          }
        });

    } catch (e) {
      console.error('[auth init]', e);
      alert(`인증 초기화 오류: ${e.message}`);
      showApp(); 
    }
  })();
}
