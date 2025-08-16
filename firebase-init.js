/* =========================================================
 * firebase-init.js
 * - 모든 페이지 공통 초기화 스크립트
 * - compat SDK 전제:
 *   <script src="https://www.gstatic.com/firebasejs/10.12.4/firebase-app-compat.js"></script>
 *   <script src="https://www.gstatic.com/firebasejs/10.12.4/firebase-auth-compat.js"></script>
 *   <script src="https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore-compat.js"></script>
 * - 본 파일은 위 3개 다음에 로드함
 * ========================================================= */

(() => {
  // 1) 프로젝트 설정값 (필수: 본인 값으로 교체)
  const firebaseConfig = {
    apiKey: "AIzaSyCpLWcArbLdVDG6Qd6QoCgMefrXNa2pUs8",
    authDomain: "fasting-b4ccb.firebaseapp.com",
    projectId: "fasting-b4ccb"
  };

  // 2) 중복 초기화 가드
  if (!firebase?.apps?.length) {
    firebase.initializeApp(firebaseConfig);
  }

  // 3) 전역 참조 (window에 1회만 바인딩)
  if (!window.auth)  window.auth  = firebase.auth();
  if (!window.db)    window.db    = firebase.firestore();

  // 4) 로그인 상태 유지 (로컬)
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(console.error);

  
  // 5) 헬퍼: 구글 로그인 (팝업 우선, 실패 시 리다이렉트 폴백)
window.signInWithGoogle = async () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  // 선택창 항상 띄우고 싶으면:
  provider.setCustomParameters({ prompt: 'select_account' });
  // (선택) 한국어 UI
  auth.languageCode = 'ko';

  // 리다이렉트 복귀 시 결과 먼저 확인
  try {
    const redirectRes = await auth.getRedirectResult();
    if (redirectRes && redirectRes.user) return redirectRes.user;
  } catch (e) {
    console.warn('[redirectResult]', e);
  }

  try {
    // 1) 팝업 시도
    const cred = await auth.signInWithPopup(provider);
    return cred.user;
  } catch (e) {
    // 2) 팝업이 막히면 리다이렉트로 폴백
    const fallback = [
      'auth/popup-blocked',
      'auth/popup-closed-by-user',
      'auth/cookie-policy-restricted',
      'auth/internal-error'
    ];
    if (fallback.includes(e.code)) {
      await auth.signInWithRedirect(provider);
      return; // 여기서 페이지가 이동함
    }
    console.error(e);
    alert(e.message || 'Google 로그인 실패');
    throw e;
  }
};

  
  // 6) 헬퍼: 로그아웃
  window.appSignOut = async () => {
    try {
      await auth.signOut();
    } catch (e) {
      console.error(e);
      alert(e.message);
    }
  };

  // 7) 헬퍼: 인증 가드 (미로그인 시 리다이렉트)
  //    - 페이지 진입 시 호출: requireAuth('./login.html')
  window.requireAuth = (redirectTo = './login.html') => {
    auth.onAuthStateChanged((user) => {
      if (!user) {
        window.location.replace(redirectTo);
      }
    });
  };

  // 8) 헬퍼: 로그인 상태에서만 실행
  //    - 예: runWithUser(async (user)=> { ... })
  window.runWithUser = (fn) => {
    const unsub = auth.onAuthStateChanged((user) => {
      if (user) fn(user);
      unsub();
    });
  };

  // 9) 유틸: 현재 사용자 문서 참조/가져오기
  window.userDocRef = () => {
    const u = auth.currentUser;
    if (!u) return null;
    return db.collection('users').doc(u.uid);
  };

  window.getUserDoc = async () => {
    const ref = userDocRef();
    if (!ref) return null;
    const snap = await ref.get();
    return snap.exists ? snap.data() : null;
  };

  // 10) 최초 가입 시 기본 프로필 생성(옵션)
  //     - 회원가입 직후 호출 가능
  window.ensureUserProfile = async (extra = {}) => {
    const ref = userDocRef();
    if (!ref) return;
    await ref.set(
      {
        email: auth.currentUser?.email || null,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        ...extra, // onboarding 등 추가 필드
      },
      { merge: true }
    );
  };

  console.log('[firebase-init] ready');
})();
