// /firebase-init.js — 단일 파일, v8 전용, 원 구조 유지
'use strict';

// (0) showApp 전역 하드가드
if (!window.showApp) {
  window.showApp = function () {
    const s = document.getElementById('splash-screen');
    if (s) { s.classList.add('fade-out'); setTimeout(() => (s.style.display = 'none'), 500); }
    document.body?.classList?.add?.('loaded');
  };
}

if (!window.__AUTH_BOOT__) {
  window.__AUTH_BOOT__ = true;

  const APP_VERSION = '2025.09.06-v8.4';
  console.log('[fastmate] version', APP_VERSION);

  // 1) Firebase 초기화
  const firebaseConfig = {
    apiKey: "AIzaSyCpLWcArbLdVDG6Qd6QoCgMefrXNa2pUs8",
    authDomain: "auth.fastmate.kr",
    projectId: "fasting-b4ccb",
    storageBucket: "fasting-b4ccb.firebasestorage.app",
    messagingSenderId: "879518503068",
    appId: "1:879518503068:web:295b1d4e21a40f9cc29d59",
    measurementId: "G-EX5HR2CB35"
  };
  if (!firebase.apps || firebase.apps.length === 0) {
    firebase.initializeApp(firebaseConfig);
  }
  const auth = firebase.auth();
  const db   = firebase.firestore();
  try { auth.useDeviceLanguage && auth.useDeviceLanguage(); } catch {}
  // 네트워크 환경 대응(롱폴링) — 한 번만
  try { db.settings({ experimentalForceLongPolling: true }); } catch {}

  // 2) 라우팅 유틸 (원 스타일 유지)
  const path = () => (location.pathname || '/');
  const isAuthPage  = () => /\/(login|signup)(?:\.html)?$/i.test(path());
  const isSignup    = () => /\/signup(?:\.html)?$/i.test(path());
  const isFastmate  = () => /\/fastmate(?:\.html)?$/i.test(path());
  const isIndex     = () => path() === '/' || /\/index\.html$/i.test(path());
  const isProtected = () => isFastmate();
  const toUrl = (base) => {
    const useHtml = /\.html$/i.test(path());
    const final = `/${base}${useHtml ? '.html' : ''}`;
    const u = new URL(final, location.origin);
    u.searchParams.set('authcb', Date.now().toString()); // SW 캐시 회피
    return u.toString();
  };
  const goOnce = (to) => { if (!window.__AUTH_NAV__) { window.__AUTH_NAV__ = true; location.replace(to); } };

  // 2-1) 인앱/UA 감지 + 예쁜 배너
  function isInApp() {
    const ua = navigator.userAgent || '';
    return /; wv\)/i.test(ua) || /FBAN|FBAV|FB_IAB|Instagram|KAKAOTALK|NAVER|DaumApps/i.test(ua);
  }
  function showInAppBanner(msg) {
    if (document.getElementById('inapp-banner')) return;
    const el = document.createElement('div');
    el.id = 'inapp-banner';
    el.style.cssText = 'position:fixed;inset:auto 12px 12px 12px;z-index:9999;background:#111;color:#fff;border-radius:12px;padding:14px 16px;box-shadow:0 8px 24px rgba(0,0,0,.3);font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Apple SD Gothic Neo,Malgun Gothic,sans-serif;font-size:14px;line-height:1.5';
    el.innerHTML = `
      <div style="font-weight:700;margin-bottom:6px">브라우저에서 열어 로그인해주세요</div>
      <div>${msg}</div>
      <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
        <button id="inapp-copy" style="flex:1;min-width:120px;border:0;border-radius:10px;padding:10px 12px;background:#fff;color:#111;font-weight:600;cursor:pointer">주소 복사</button>
        <button id="inapp-close" style="border:0;border-radius:10px;padding:10px 12px;background:#2b2b2b;color:#fff;cursor:pointer">닫기</button>
      </div>`;
    document.body.appendChild(el);
    document.getElementById('inapp-copy')?.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(location.href); el.querySelector('#inapp-copy').textContent = '복사됨'; } catch {}
    });
    document.getElementById('inapp-close')?.addEventListener('click', () => el.remove());
  }

  // 3) 전역(원 구조 유지)
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
    sendPasswordReset: function () {
      const emailInput = document.getElementById('reset-email');
      if (!emailInput) return;
      const email = emailInput.value?.trim();
      if (!email) return alert('비밀번호를 찾으려는 이메일 주소를 입력해주세요.');
      auth.sendPasswordResetEmail(email)
        .then(() => alert(`'${email}' 주소로 재설정 메일을 보냈습니다.`))
        .catch((error) => {
          console.error('Password reset error:', error);
          alert(`오류가 발생했습니다. 이메일 주소를 확인해주세요. (${error.code})`);
        });
    },
    signOutUser: function () {
      auth.signOut()
        .then(() => {
          const useHtml = /\.html$/i.test(location.pathname);
          location.href = `/login${useHtml ? '.html' : ''}`;
        })
        .catch((error) => {
          console.error('Sign out error:', error);
          alert('로그아웃 중 오류가 발생했습니다.');
        });
    }
  };

  // 3-1) 프로필 완료 판정(닉네임 + 목표 or completed 플래그)
  function hasValue(x){ return Array.isArray(x) ? x.length>0 : (x!=null && String(x).trim()!==''); }
  function isProfileDone(u){
    const nick = u?.nickname;
    const goals = u?.goals ?? u?.purpose ?? u?.joinPurpose ?? u?.onboarding?.reasons;
    const completed = u?.onboarding?.completed === true;
    return hasValue(nick) && (hasValue(goals) || completed);
  }

  // 3-2) 로그인 후 라우팅 공통 로직(팝업/리디렉션/상태변경 모두 사용)
  async function routeAfterLogin(user, extraInfo) {
    // 1) upsert (실패해도 진행)
    try {
      await db.collection('users').doc(user.uid).set({
        uid: user.uid,
        email: user.email || null,
        displayName: user.displayName || null,
        photoURL: user.photoURL || null,
        provider: user.providerData?.[0]?.providerId || 'unknown',
        lastLogin: new Date()
      }, { merge: true });
    } catch (e) { console.warn('user upsert fail (non-blocking)', e); }

    // 2) 프로필 확인
    let profile = null, done = false;
    try { profile = await window.fastmateApp.getUserDoc(user.uid); done = isProfileDone(profile); } catch {}

    // 3) 신규 또는 미완료 → 온보딩
    if (extraInfo?.isNewUser || !done) {
      // fastmate 화면에서 온보딩 모달이 있으면 모달 우선
      if (typeof window.openOnboardingModal === 'function' && isFastmate()) {
        try { window.openOnboardingModal(profile || {}); } catch {}
        return;
      }
      // 없으면 signup 페이지로
      const u = new URL(toUrl('signup'));
      if (extraInfo?.isNewUser) u.searchParams.set('step', '2'); // 신규: 2단계부터
      else u.searchParams.set('step', 'final');                  // 기존 미완료: 바로 최종 입력
      return goOnce(u.toString());
    }

    // 4) 완료 유저 → fastmate로
    if (isIndex() || isAuthPage()) return goOnce(toUrl('fastmate'));
  }

  // 4) 로그인 시작(버튼 클릭용) — 원 구조 유지 + 인앱 배너/신규 라우팅 보강
  window.signInWithGoogle = function () {
    const provider = new firebase.auth.GoogleAuthProvider();

    // 인앱/웹뷰 안내 (예쁘게)
    if (isInApp()) {
      showInAppBanner('인앱 브라우저에서는 Google 로그인이 제한됩니다. 우상단 ••• 또는 ☰ 메뉴에서 “기본 브라우저로 열기(Chrome/Safari)”를 선택한 뒤 다시 시도해주세요.');
      return;
    }

    // OAuth 진행 중 표시
    sessionStorage.setItem('oauthBusy', '1');
    document.body.classList.add('oauth-busy');

    const ua = navigator.userAgent || '';
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
    const preferRedirect = (isIOS && !standalone) || isSafari;

    if (preferRedirect) {
      auth.signInWithRedirect(provider).catch(err => {
        sessionStorage.removeItem('oauthBusy');
        document.body.classList.remove('oauth-busy');
        console.error('[redirect start err]', err);
        alert('로그인 시작 오류: ' + (err.message || err.code));
      });
    } else {
      auth.signInWithPopup(provider)
        .then(async (r) => {
          if (r?.user) await routeAfterLogin(r.user, r.additionalUserInfo);
          // popup 흐름에서는 강제 이동하지 않음 → routeAfterLogin이 결정
        })
        .catch(err => {
          console.error('[popup err]', err);
          alert('로그인 실패: ' + (err.message || err.code));
        })
        .finally(() => {
          sessionStorage.removeItem('oauthBusy');
          document.body.classList.remove('oauth-busy');
        });
    }
  };

  // 5) 버튼 자동 바인딩
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

  // 6) 인증 플로우 (원 구조 유지, 라우팅만 공통 함수로 정리)
  (async function initAuth() {
    try {
      await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

      // (A) 리디렉션 결과 우선 처리
      const r = await auth.getRedirectResult();
      if (r?.user) {
        await routeAfterLogin(r.user, r.additionalUserInfo);
        return;
      }

      // (B) 상태 변화
      auth.onAuthStateChanged(async (user) => {
        console.log('[auth] state=', !!user, 'path=', path());
        // 리디렉션/팝업이 아닌 순수 진입 경로에서만 동작
        if (!user) {
          if (isProtected()) return goOnce(toUrl('login'));
          window.showApp?.(); // 비보호 페이지는 그냥 렌더
          return;
        }

        // 로그인됨
        await routeAfterLogin(user); // profile 상태에 따라 모달/페이지로 분기
        window.showApp?.();

        // fastmate 진입 시 초기 UI 수화(원 코드 유지)
        if (isFastmate()) {
          try {
            const profile = await window.fastmateApp.getUserDoc(user.uid);
            const userChip = document.getElementById('userChip');
            const userChipName = document.getElementById('userChipName');
            if (userChip && userChipName) {
              const nickname = profile?.nickname || profile?.displayName || user.displayName || '사용자';
              userChipName.textContent = nickname;
              userChip.style.display = 'flex';
            }
            const savedFasting = profile?.currentFasting;
            if (savedFasting && window.hydrateFastingTimer) window.hydrateFastingTimer(savedFasting);
            else if (window.initializeTime) window.initializeTime();
            window.updateUIState?.();
            if (!window.__WIRED__) { window.__WIRED__ = true; try { window.wireEventsOnce?.(); } catch {} }
          } catch (e) { console.warn('[fastmate hook]', e); }
        }
      });

    } catch (e) {
      console.error('[auth init]', e);
      alert(`인증 초기화 오류: ${e.message}`);
      window.showApp?.();
    }
  })();
}
