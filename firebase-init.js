/* =========================================================
 * firebase-init.js
 * - 모든 페이지 공통 초기화 스크립트
 * - compat SDK 전제:
 * <script src="https://www.gstatic.com/firebasejs/10.12.4/firebase-app-compat.js"></script>
 * <script src="https://www.gstatic.com/firebasejs/10.12.4/firebase-auth-compat.js"></script>
 * <script src="https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore-compat.js"></script>
 * - 본 파일은 위 3개 다음에 로드함
 * ========================================================= */

(() => {
  // 1) 프로젝트 설정값 (필수: 본인 값으로 교체)
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
  window.__authPopupInFlight = null;  // 전역 가드

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

    // 이미 진행 중인 팝업 요청이 있으면 그걸 그대로 기다림(중복 방지)
    if (window.__authPopupInFlight) return window.__authPopupInFlight;

    const provider = new firebase.auth.GoogleAuthProvider();

    // 하나의 팝업 요청만 떠 있도록 가드 설정
    window.__authPopupInFlight = (async () => {
      try {
        const cred = await auth.signInWithPopup(provider);
        return cred.user;
      } catch (e) {
        // 사용자가 팝업을 닫았거나 충돌 난 경우는 조용히 종료
        if (e?.code === 'auth/popup-closed-by-user' ||
            e?.code === 'auth/cancelled-popup-request') {
          return null;
        }

        // 쿠키/팝업 정책 등으로 막힌 경우 → 리다이렉트 폴백
        const fallbackCodes = [
          'auth/popup-blocked',
          'auth/cookie-policy-restricted',
          'auth/internal-error'
        ];
        if (fallbackCodes.includes(e?.code)) {
          // 가드 해제 후 리다이렉트로 넘김
          window.__authPopupInFlight = null;
          await auth.signInWithRedirect(provider);
          return null; // 여기서 페이지 떠남
        }

        console.error(e);
        alert(e.message || 'Google 로그인 실패');
        return null;
      } finally {
        // 팝업 플로우가 끝났으면 가드 해제
        window.__authPopupInFlight = null;
      }
    })();

    return window.__authPopupInFlight;
  };

  /*
   * ===================================================================
   * [수정] 아래의 전역 리디렉션 로직을 모두 삭제했습니다.
   * 각 페이지(signup.html, fastmate.html)가 자신의 상황에 맞게
   * 화면 전환을 처리하는 것이 훨씬 안정적이기 때문입니다.
   * ===================================================================
   */
  // document.addEventListener('DOMContentLoaded', () => { ... }); <- 기존 블록 삭제

  
  // 6) 헬퍼: 로그아웃
  window.appSignOut = async () => {
    try {
      await auth.signOut();
      // 로그아웃 후 로그인 페이지로 이동
      window.location.href = './login.html';
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