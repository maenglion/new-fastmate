// 1. Firebase 앱 초기화
// (주의: 실제 값으로 채워주세요)
const firebaseConfig = {
  apiKey: "AIzaSyCpLWcArbLdVDG6Qd6QoCgMefrXNa2pUs8",
  authDomain: "auth.fastmate.kr", // ◀◀◀ 가장 중요! 커스텀 도메인으로 변경
  projectId: "fasting-b4ccb",
  storageBucket: "fasting-b4ccb.firebasestorage.app",
  messagingSenderId: "879518503068",
  appId: "1:879518503068:web:295b1d4e21a40f9cc29d59",
  measurementId: "G-EX5HR2CB35"
};

// 2. 초기화 중복 실행 방지 장치
if (!window.__AUTH_BOOT__) {
  window.__AUTH_BOOT__ = true; // 실행되었다고 표시

  // 3. Firebase 서비스 초기화
  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();

  // 4. Firestore에서 사용자 정보 가져오는 함수
  async function getUserDoc(uid) {
    if (!uid) return null;
    const userRef = db.collection('users').doc(uid);
    const doc = await userRef.get();
    return doc.exists ? doc.data() : null;
  }

  // 5. 로그인 성공 후 실행될 공통 작업
  async function afterAuth(user, additionalUserInfo) {
    if (!user || window.__AUTH_NAVIGATED__) return;
    window.__AUTH_NAVIGATED__ = true; // 중복 이동 방지 표시

    const userRef = db.collection('users').doc(user.uid);
    await userRef.set({
      uid: user.uid,
      email: user.email || null,
      displayName: user.displayName || null,
      photoURL: user.photoURL || null,
      lastLogin: new Date()
    }, { merge: true });

    // isNewUser가 true이면 회원가입 2단계로, 아니면 메인 앱으로
    if (additionalUserInfo?.isNewUser) {
      window.location.replace('/signup-step2.html');
    } else {
      window.location.replace('/fastmate.html'); // 메인 앱 페이지 경로
    }
  }
  
  // 6. 페이지 경로에 따른 보호 규칙 정의
  const isProtectedPage = () => {
    const path = window.location.pathname;
    // 이 페이지들은 로그인이 반드시 필요함
    return /\/(app|signup-step2|fastmate)\.html$/i.test(path);
  };

  // 7. 구글 로그인 실행 함수 (HTML 버튼에서 사용)
  window.signInWithGoogle = function () {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithRedirect(provider).catch(e => console.error("Redirect Error:", e));
  };

  // 8. 앱 전체의 인증 상태를 감시하고 처리하는 메인 로직
  (async function initializeAuth() {
    try {
      // 로컬에 로그인 정보 저장 (페이지를 닫았다 열어도 로그인 유지)
      await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

      // Google 로그인 후 돌아왔는지 확인
      const result = await auth.getRedirectResult();
      if (result?.user) {
        // 돌아왔다면 afterAuth 실행하고 종료 (onAuthStateChanged와 중복 실행 방지)
        await afterAuth(result.user, result.additionalUserInfo);
        return;
      }

      // 일반적인 페이지 로드 시 인증 상태 감시
      auth.onAuthStateChanged(async (user) => {
        if (window.__AUTH_NAVIGATED__) return; // 이미 다른 곳에서 이동 처리했으면 실행 안 함

        if (user) {
          // 로그인된 상태
          const isAuthPage = /\/(login|signup)\.html$/i.test(window.location.pathname);
          if (isAuthPage) {
            // 로그인 페이지에 머물러 있다면 메인 앱으로 보냄
            window.__AUTH_NAVIGATED__ = true;
            window.location.replace('/fastmate.html');
          }
        } else {
          // 로그아웃된 상태
          if (isProtectedPage()) {
            // 보호된 페이지에 접근했다면 로그인 페이지로 튕겨냄
            window.__AUTH_NAVIGATED__ = true;
            window.location.replace('/login.html');
          }
        }
      });
    } catch (e) {
      console.error('[Auth Init Error]', e);
    }
  })();
}