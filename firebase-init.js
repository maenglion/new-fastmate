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

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();


// 2. 로그인/회원가입 후 공통으로 처리할 함수
async function afterAuth(user, additionalUserInfo) {
  if (!user) return;

  // Firestore에 사용자 정보 저장 (없으면 생성, 있으면 업데이트)
  const userRef = db.collection('users').doc(user.uid);
  try {
    await userRef.set({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      lastLogin: new Date()
    }, { merge: true });
  } catch (error) {
    console.error("Firestore user update failed:", error);
  }

  // isNewUser는 리디렉션 직후에만 확인 가능합니다.
  const isNew = additionalUserInfo?.isNewUser === true;

  if (isNew) {
    // 신규 회원이면 회원가입 2단계 페이지로 이동
    // (주의: 실제 사용하는 페이지 경로로 수정하세요)
    window.location.replace('/signup-step2.html'); 
  } else {
    // 기존 회원이면 메인 앱 페이지로 이동
    // (주의: 실제 사용하는 페이지 경로로 수정하세요)
    window.location.replace('/app.html');
  }
}


// 3. 구글 로그인 실행 함수 (로그인 버튼에 이 함수를 연결하세요)
function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  // 모든 환경에서 가장 안정적인 리디렉션 방식을 사용합니다.
  auth.signInWithRedirect(provider);
}


// 4. 앱 로드 시 항상 실행되는 인증 상태 감지 로직 (수정됨)
function initializeAuth() {
  // 리디렉션 결과부터 먼저 처리합니다.
  auth.getRedirectResult()
    .then(result => {
      // 리디렉션 결과가 있으면, afterAuth가 페이지 이동을 처리하므로 여기서 끝냅니다.
      if (result && result.user) {
        return afterAuth(result.user, result.additionalUserInfo);
      }

      // 리디렉션 결과가 없는 경우(새로고침, 직접 방문 등)에만 이 리스너로 라우팅을 처리합니다.
      auth.onAuthStateChanged(user => {
        // 현재 페이지 경로를 확인합니다.
        const currentPagePath = window.location.pathname;
        const isProtectedRoute = currentPagePath.includes('/app.html') || currentPagePath.includes('/signup-step2.html');
        const isPublicAuthPage = currentPagePath.includes('/login.html') || currentPagePath.includes('/signup.html');

        if (user) {
          // 사용자가 로그인 되어 있고, 로그인/가입 페이지에 있다면 메인 앱으로 보냅니다.
          if (isPublicAuthPage) {
            window.location.replace('/app.html');
          }
          // 그 외의 경우, 로그인된 상태이므로 UI를 업데이트합니다.
          console.log("User is signed in:", user.displayName);
          // 예: document.getElementById('userChip').style.display = 'flex';
        } else {
          // 사용자가 로그아웃 되어 있고, 보호된 페이지(메인 앱 등)에 있다면 로그인 페이지로 보냅니다.
          if (isProtectedRoute) {
            window.location.replace('/login.html');
          }
        }
      });
    })
    .catch(error => {
      console.error("Firebase Auth Error:", error);
      alert(`인증 중 오류가 발생했습니다: ${error.message}`);
    });
}

// 앱 시작 시 인증 로직을 실행합니다.
initializeAuth();
