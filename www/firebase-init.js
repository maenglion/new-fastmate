// /firebase-init.js — v8.6 (FCM 푸시 알림 추가)

// panic refresh: https://fastmate.kr/fastmate.html?nocache=1 로 들어오면 캐시/서비스워커 제거
(function panicRefresh(){
  try {
    const u = new URL(location.href);
    if (u.searchParams.get('nocache') === '1') {
      (async () => {
        try {
          if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map(k => caches.delete(k)));
          }
        } catch {}
        try {
          if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map(r => r.unregister()));
          }
        } catch {}
        try { localStorage.clear(); sessionStorage.clear(); } catch {}
        u.searchParams.delete('nocache');
        location.replace(u.toString());
      })();
    }
  } catch {}
})();



(() => {
  'use strict';

  // 중복 로드 방지 + 전역 버전 표기
  if (window.__AUTH_BOOT__) return;
  window.__AUTH_BOOT__ = true;
  window.__APP_VERSION__ = '2026.04.11-v10';  // ✅ FCM 추가 버전
  console.log('[fastmate] version', window.__APP_VERSION__);

  // ✅ VAPID 키 (웹 푸시 인증서 공개 키)
  const VAPID_KEY = 'BFDJ6NMNYmgz9UuD0Lqm58btDn9zL5e0vaGPYaf2V6I_GkWYqQT4GUF9p_zxUhU0C9L76C_ccYprRgVMyO6LjjI';

  // 스플래시 가드(다른 스크립트보다 먼저 안전하게 호출 가능)
  if (!window.showApp) {
    window.showApp = function () {
      const s = document.getElementById('splash-screen');
      if (s) { s.classList.add('fade-out'); setTimeout(() => (s.style.display = 'none'), 400); }
      document.body?.classList?.add?.('loaded');
    };
  }

  // ---------- Firebase 초기화(v8) ----------
  const firebaseConfig = {
    apiKey: "AIzaSyCpLWcArbLdVDG6Qd6QoCgMefrXNa2pUs8",
    authDomain: "auth.fastmate.kr",
    projectId: "fasting-b4ccb",
    storageBucket: "fasting-b4ccb.firebasestorage.app",
    messagingSenderId: "879518503068",
    appId: "1:879518503068:web:295b1d4e21a40f9cc29d59",
    measurementId: "G-EX5HR2CB35"
  };
  if (!firebase?.apps?.length) {
    firebase.initializeApp(firebaseConfig);
  }

  // 3) 전역 참조 (window에 1회만 바인딩)
  if (!window.auth) window.auth = firebase.auth();
  if (!window.db) window.db = firebase.firestore();

  // 4) 로그인 상태 유지 (로컬)
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(console.error);

  // =========================================================
  // ✅ FCM 푸시 알림 기능 (새로 추가)
  // =========================================================

  /**
   * VAPID 키 변환 유틸리티
   */
  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  /**
   * 푸시 알림 권한 요청 및 구독
   * @returns {Promise<PushSubscription|null>}
   */
  window.requestPushPermission = async () => {
    try {
      // 1. 브라우저 지원 확인
      if (!('Notification' in window)) {
        console.warn('[FCM] 이 브라우저는 알림을 지원하지 않습니다.');
        return null;
      }
      if (!('serviceWorker' in navigator)) {
        console.warn('[FCM] Service Worker를 지원하지 않습니다.');
        return null;
      }

      // 2. 알림 권한 요청
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.log('[FCM] 알림 권한이 거부되었습니다.');
        return null;
      }

      // 3. Service Worker 등록 확인
      const registration = await navigator.serviceWorker.ready;
      console.log('[FCM] Service Worker ready');

      // 4. 푸시 구독 생성
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_KEY)
      });
      console.log('[FCM] Push subscription created');

      // 5. 구독 정보를 Firestore에 저장
      const user = auth.currentUser;
      if (user && subscription) {
        const subscriptionData = subscription.toJSON();
        await db.collection('users').doc(user.uid).set({
          pushSubscription: subscriptionData,
          pushEnabled: true,
          pushUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        console.log('[FCM] 푸시 구독 정보 저장 완료');
      }

      return subscription;

    } catch (error) {
      console.error('[FCM] 푸시 권한 요청 실패:', error);
      return null;
    }
  };

  /**
   * 푸시 알림 비활성화
   */
  window.disablePushNotifications = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
        console.log('[FCM] 푸시 구독 해제됨');
      }

      const user = auth.currentUser;
      if (user) {
        await db.collection('users').doc(user.uid).set({
          pushEnabled: false,
          pushSubscription: null,
          pushUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }
      return true;
    } catch (error) {
      console.error('[FCM] 푸시 비활성화 실패:', error);
      return false;
    }
  };

  /**
   * 현재 푸시 알림 상태 확인
   */
  window.getPushStatus = async () => {
    try {
      if (!('Notification' in window)) {
        return { supported: false, permission: 'unsupported', subscribed: false };
      }
      const permission = Notification.permission;
      let subscribed = false;

      if (permission === 'granted' && 'serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        subscribed = !!subscription;
      }
      return { supported: true, permission, subscribed };
    } catch (error) {
      console.error('[FCM] 상태 확인 실패:', error);
      return { supported: false, permission: 'error', subscribed: false };
    }
  };

  // =========================================================
  // 5) 헬퍼: 구글 로그인 (팝업 우선, 실패 시 리다이렉트 폴백)
  // =========================================================
  window.__authPopupInFlight = null; // 전역 가드

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
        throw e; // 호출자에서 처리하도록
      } finally {
        // 팝업 플로우가 끝났으면 가드 해제
        window.__authPopupInFlight = null;
      }
    })();

    return window.__authPopupInFlight;
  };

  // =========================================================
  // 6) 헬퍼: 로그아웃
  // =========================================================
  window.appSignOut = async () => {
    try {
      // 세션 스토리지 정리
      sessionStorage.removeItem('onboardingLock');
      sessionStorage.removeItem('postAuth');
      
      await auth.signOut();
      // 로그아웃 후 로그인 페이지로 이동
      window.location.href = './login.html';
    } catch (e) {
      console.error(e);
      alert(e.message);
    }
  };

  // =========================================================
  // 7) 헬퍼: 인증 가드 (미로그인 시 리다이렉트)
  //    - 페이지 진입 시 호출: requireAuth('./login.html')
  // =========================================================
  window.requireAuth = (redirectTo = './login.html') => {
    auth.onAuthStateChanged((user) => {
      if (!user) {
        window.location.replace(redirectTo);
      }
    });
  };

  // =========================================================
  // 8) 헬퍼: 로그인 상태에서만 실행
  //    - 예: runWithUser(async (user)=> { ... })
  // =========================================================
  window.runWithUser = (fn) => {
    const unsub = auth.onAuthStateChanged((user) => {
      if (user) fn(user);
      unsub();
    });
  };

  // =========================================================
  // 9) 유틸: 현재 사용자 문서 참조/가져오기
  // =========================================================
  window.userDocRef = () => {
    const u = auth.currentUser;
    if (!u) return null;
    return db.collection('users').doc(u.uid);
  };

  window.getUserDoc = async (uid = null) => {
    const targetUid = uid || auth.currentUser?.uid;
    if (!targetUid) return null;
    const ref = db.collection('users').doc(targetUid);
    const snap = await ref.get();
    return snap.exists ? snap.data() : null;
  };

  // =========================================================
  // 10) 최초 가입 시 기본 프로필 생성(옵션)
  //     - 회원가입 직후 호출 가능
  // =========================================================
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

  // =========================================================
  // 11) [추가] 온보딩 완료 여부 확인 헬퍼
  // =========================================================
  window.checkOnboardingComplete = async () => {
    try {
      const prof = await getUserDoc();
      if (!prof) return false;
      
      const completed = !!prof?.onboarding?.completed;
      const hasNickname = !!prof?.nickname;
      const hasGoals = Array.isArray(prof?.onboarding?.reasons) && prof.onboarding.reasons.length > 0;
      
      return completed && hasNickname && hasGoals;
    } catch (e) {
      console.error('[checkOnboardingComplete]', e);
      return false;
    }
  };

  window.fastmateApp = {
    auth: window.auth,
    db: window.db,
    getUserDoc: window.getUserDoc,
    signOutUser: window.appSignOut
  };

  console.log('[firebase-init] ready (with FCM)');
})();