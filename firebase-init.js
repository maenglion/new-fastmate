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


// 2. 로그인 후 공통으로 처리할 함수
async function afterAuth(user, additionalUserInfo) {
  if (!user) return;

  // Firestore에 사용자 정보 저장 (없으면 생성, 있으면 업데이트)
  const userRef = db.collection('users').doc(user.uid);
  await userRef.set({
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    lastLogin: new Date()
  }, { merge: true });

  // isNewUser는 리디렉션 직후에만 확인 가능
  const isNew = additionalUserInfo?.isNewUser === true;

  if (isNew) {
    // 신규 회원이면 회원가입 2단계 페이지로 이동
    window.location.replace('/signup-step2.html'); 
  } else {
    // 기존 회원이면 메인 앱 페이지로 이동
    window.location.replace('/app.html');
  }
}


// 3. 구글 로그인 실행 함수 (이 함수를 로그인 버튼에 연결)
function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  
  // 사용자 에이전트를 확인하여 모바일 기기인지 판별
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  if (isMobile) {
    // 모바일 환경에서는 무조건 리디렉션 사용
    auth.signInWithRedirect(provider);
  } else {
    // PC (데스크톱) 환경에서는 팝업 사용
    auth.signInWithPopup(provider)
      .then(result => afterAuth(result.user, result.additionalUserInfo))
      .catch(error => {
        console.error("Popup Sign-in Error", error);
        // PC에서도 팝업이 막히면 리디렉션으로 시도
        if (error.code === 'auth/popup-blocked' || error.code === 'auth/cancelled-popup-request') {
          auth.signInWithRedirect(provider);
        }
      });
  }
}
  if (isAndroidChromeTab) {
    // 안드로이드 크롬에서는 팝업이 더 안정적
    auth.signInWithPopup(provider)
      .then(result => afterAuth(result.user, result.additionalUserInfo))
      .catch(error => {
        // 팝업이 차단되면 리디렉션으로 재시도
        if (error.code === 'auth/popup-blocked' || error.code === 'auth/cancelled-popup-request') {
          auth.signInWithRedirect(provider);
        } else {
          console.error("Popup Sign-in Error", error);
        }
      });
  } else {
    // 그 외 환경(iOS, PWA, 인앱 브라우저 등)에서는 리디렉션 사용
    auth.signInWithRedirect(provider);
  }


// 4. 앱 로드 시 항상 실행되는 인증 상태 감지 로직
function initializeAuth() {
  // 리디렉션에서 돌아왔는지 먼저 확인
  auth.getRedirectResult()
    .then(result => {
      if (result && result.user) {
        // 리디렉션 결과가 있으면 afterAuth 처리
        afterAuth(result.user, result.additionalUserInfo);
      }
    })
    .catch(error => {
      console.error("Redirect Result Error", error);
    });

  // 현재 로그인 상태 확인
  auth.onAuthStateChanged(user => {
    if (user) {
      // 사용자가 로그인 되어 있다면 UI 업데이트 등 필요한 작업 수행
      console.log("User is signed in:", user.displayName);
      // 예: document.getElementById('userChip').style.display = 'flex';
    } else {
      // 로그아웃 상태
      console.log("User is signed out.");
    }
  });
}

// 앱 시작!
initializeAuth();
