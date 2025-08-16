// signup.js

function checkSignupStep1() {
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (!email || !password || !confirmPassword) {
        alert('모든 정보를 입력해 주세요.');
        return;
    }

    if (password !== confirmPassword) {
        alert('비밀번호가 일치하지 않습니다.');
        return;
    }

    // 이메일과 비밀번호 유효성 검사 (간단한 예시)
    if (password.length < 6) {
        alert('비밀번호는 6자리 이상이어야 합니다.');
        return;
    }

    // 다음 페이지로 이동
    window.location.href = './signup2.html';
}

function checkSignupStep2() {
    const nickname = document.getElementById('nickname').value;

    if (!nickname) {
        alert('닉네임을 입력해 주세요.');
        return;
    }

    // 다음 페이지로 이동
    window.location.href = './signup3.html';
}

function finishSignup() {
    const reasons = document.querySelectorAll('input[name="reason"]:checked');
    if (reasons.length === 0) {
        alert('단식을 하려는 이유를 한 가지 이상 선택해 주세요.');
        return;
    }

    // 회원가입 완료 로직을 구현합니다.
    // 여기서 이메일, 비밀번호, 닉네임, 이유를 모두 서버로 전송합니다.
    alert('회원가입이 완료되었습니다!');
    // 회원가입 완료 후 메인 앱 페이지로 이동
    window.location.href = './fastmate.html';
}
