/* =========================================================
 * firebase-init.js
 * - 모든 페이지 공통 초기화 스크립트
 * ========================================================= */

(() => {
  // 1) 프로젝트 설정값
  const firebaseConfig = {
    apiKey: "AIzaSyCpLWcArbLdVDG6Qd6QoCgMefrXNa2pUs8",
    authDomain: "fasting-b4ccb.firebaseapp.com",
    projectId: "fasting-b4ccb",
    storageBucket: "fasting-b4ccb.firebasestorage.app",
    messagingSenderId: "879518503068",
    appId: "1:879518503068:web:295b1d4e21a40f9cc29d59",
    measurementId: "G-EX5HR2CB35"
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
    // 이미 로그인 상태면 바로 리턴
    if (auth.currentUser) return auth.currentUser;

    // 리다이렉트 복귀 결과 1회 회수
    try {
      const redirectRes = await auth.getRedirectResult();
      if (redirectRes && redirectRes.user) return redirectRes.user;
    } catch (e) {
      console.warn('[getRedirectResult]', e?.code || e?.message || e);
    }

    const provider = new firebase.auth.GoogleAuthProvider();

    // 모바일 기기에서는 리디렉션 방식을 우선 사용
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
        await auth.signInWithRedirect(provider);
        return null; // 페이지가 이동하므로 여기서 끝
    }

    // 데스크톱에서는 팝업 방식 사용
    try {
        const cred = await auth.signInWithPopup(provider);
        return cred.user;
    } catch (e) {
        console.error(e);
        alert(e.message || 'Google 로그인 실패');
        return null;
    }
  };

  /*
   * ===================================================================
   * [수정] 아래의 전역 리디렉션 로직을 모두 삭제했습니다.
   * 각 페이지(signup.html, fastmate.html)가 자신의 상황에 맞게
   * 화면 전환을 처리하는 것이 훨씬 안정적이기 때문입니다.
   * ===================================================================
   */
  
  // 6) 헬퍼: 로그아웃
  window.appSignOut = async () => {
    try {
      await auth.signOut();
      window.location.href = './index.html'; // 로그아웃 후 첫 화면으로
    } catch (e) {
      console.error(e);
      alert(e.message);
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

  // 10) 최초 가입 시 기본 프로필 생성(옵션)
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