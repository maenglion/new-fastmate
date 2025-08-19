/* =========================================================
 * firebase-init.js
 * - 모든 페이지 공통 초기화 스크립트
 * - compat SDK 전제:
 * <script src="https://www.gstatic.com/firebasejs/10.12.4/firebase-app-compat.js"></script>
 * <script src="https://www.gstatic.com/firebasejs/10.12.4/firebase-auth-compat.js"></script>
 * <script src="https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore-compat.js"></script>
 * - 본 파일은 위 3개 다음에 로드함
 * ========================================================= */

/* =========================================================
 * firebase-init.js
 * - 모든 페이지 공통 초기화 스크립트
 * ========================================================= */

/* =========================================================
 * firebase-init.js
 * - 모든 페이지 공통 초기화 스크립트
 * ========================================================= */

(() => {
  // 1) 프로젝트 설정값
  const firebaseConfig = {
    apiKey: "AIzaSyCpLWcArbLdVDG6Qd6QoCgMefrXNa2pUs8",
    authDomain: "fasting-b4ccb.firebaseapp.com",
    projectId: "fasting-b4ccb"
  };

  // 2) 중복 초기화 가드
  if (!firebase?.apps?.length) {
    firebase.initializeApp(firebaseConfig);
  }

  // 3) 전역 참조
  if (!window.auth)  window.auth  = firebase.auth();
  if (!window.db)    window.db    = firebase.firestore();

  // 4) 로그인 상태 유지 (로컬)
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(console.error);
  
  // 5) 헬퍼: 구글 로그인
  window.signInWithGoogle = async () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    // 팝업 방식으로 로그인 시도
    return auth.signInWithPopup(provider).then(cred => cred.user);
  };
  
  /*
   * [수정] 아래의 전역 리디렉션 로직을 모두 삭제했습니다.
   * 각 페이지(signup.html, fastmate.html)가 자신의 상황에 맞게
   * 화면 전환을 처리하는 것이 훨씬 안정적이기 때문입니다.
   */
  // document.addEventListener('DOMContentLoaded', () => { ... }); <- 기존 블록 삭제

  // 6) 헬퍼: 로그아웃
  window.appSignOut = async () => {
    try {
      await auth.signOut();
      window.location.href = './login.html';
    } catch (e) {
      console.error(e);
    }
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

  // 10) 최초 가입 시 기본 프로필 생성
  window.ensureUserProfile = async (extra = {}) => {
    const ref = userDocRef();
    if (!ref) return;
    await ref.set(
      {
        email: auth.currentUser?.email || null,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        ...extra,
      },
      { merge: true }
    );
  };

  console.log('[firebase-init] ready');
})();