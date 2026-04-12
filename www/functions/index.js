/**
 * Fastmate Push Notification Functions
 * 
 * 기능:
 * 1. 단식 시작 30분 전 알림
 * 2. 단식 목표 달성 알림 (50%, 100%)
 * 3. 단식 종료 30분, 1시간 전 알림
 * 4. 장기 단식 마일스톤 (24h, 36h, 48h)
 * 5. 챌린지 댓글/초대 알림
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const webpush = require('web-push');

admin.initializeApp();
const db = admin.firestore();

// ============================================
// VAPID 키 설정 (Firebase Console에서 생성한 키)
// ============================================
const VAPID_PUBLIC_KEY = 'BFDJ6NMNYmgz9UuD0Lqm58btDn9zL5e0vaGPYaf2V6I_GkWYqQT4GUF9p_zxUhU0C9L76C_ccYprRgVMyO6LjjI';
// ⚠️ 비공개 키는 Firebase 환경변수로 설정해야 함
// firebase functions:config:set vapid.private_key="YOUR_PRIVATE_KEY"
const VAPID_PRIVATE_KEY = functions.config().vapid?.private_key || '';

webpush.setVapidDetails(
  'mailto:maengnanyoung@gmail.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// ============================================
// 헬퍼 함수: 푸시 알림 발송 + Firestore 저장
// ============================================
async function sendPushNotification(userId, title, body, data = {}) {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    
    // Firestore에 알림 히스토리 저장 (푸시 여부와 관계없이)
    const notificationType = data.type || 'general';
    let icon = '🔔';
    if (notificationType.includes('challenge') || notificationType.includes('comment')) {
      icon = '💬';
    } else if (notificationType.includes('milestone') || notificationType.includes('complete')) {
      icon = '🎉';
    }
    
    await db.collection('users').doc(userId).collection('notifications').add({
      type: notificationType,
      icon: icon,
      title: title,
      body: body,
      data: data,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      read: false
    });
    
    if (!userData?.pushEnabled || !userData?.pushSubscription) {
      console.log(`[Push] User ${userId} has no push subscription`);
      return false;
    }

    const subscription = userData.pushSubscription;
    
    const payload = JSON.stringify({
      title,
      body,
      icon: '/android-chrome-192x192.png',
      badge: '/favicon-32x32.png',
      tag: `fastmate-${Date.now()}`,
      data: {
        url: '/fastmate.html',
        ...data
      }
    });

    await webpush.sendNotification(subscription, payload);
    console.log(`[Push] Sent to ${userId}: ${title}`);
    return true;

  } catch (error) {
    console.error(`[Push] Failed for ${userId}:`, error);
    
    // 구독이 만료된 경우 DB에서 제거
    if (error.statusCode === 410 || error.statusCode === 404) {
      await db.collection('users').doc(userId).update({
        pushEnabled: false,
        pushSubscription: null
      });
      console.log(`[Push] Removed expired subscription for ${userId}`);
    }
    return false;
  }
}

// ============================================
// 헬퍼 함수: 사용자 알림 설정 확인
// ============================================
async function checkPushSetting(userId, settingKey) {
  const userDoc = await db.collection('users').doc(userId).get();
  const userData = userDoc.data();
  const settings = userData?.pushSettings || {};
  return settings[settingKey] !== false; // 기본값은 true
}

// ============================================
// 1. 단식 시작 알림 (Firestore 트리거)
//    - 단식이 시작되면 알림
// ============================================
exports.onFastingStart = functions.firestore
  .document('users/{userId}/fastingHistory/{fastingId}')
  .onCreate(async (snap, context) => {
    const { userId } = context.params;
    const data = snap.data();
    
    // 알림 설정 확인
    if (!await checkPushSetting(userId, 'fastingStart')) return;
    
    const targetHours = data.targetHours || 16;
    
    await sendPushNotification(
      userId,
      '🍽️ 단식이 시작되었습니다!',
      `${targetHours}시간 단식을 시작합니다. 화이팅!`,
      { type: 'fasting_start', fastingId: context.params.fastingId }
    );
  });

// ============================================
// 2. 단식 종료 & 달성 알림 (Firestore 트리거)
//    - 단식이 종료되면 달성률에 따라 알림
// ============================================
exports.onFastingEnd = functions.firestore
  .document('users/{userId}/fastingHistory/{fastingId}')
  .onUpdate(async (change, context) => {
    const { userId } = context.params;
    const before = change.before.data();
    const after = change.after.data();
    
    // endTime이 새로 설정된 경우 (단식 종료)
    if (!before.endTime && after.endTime) {
      if (!await checkPushSetting(userId, 'milestone')) return;
      
      const achievement = after.achievement || 0;
      
      let emoji, message;
      if (achievement >= 100) {
        emoji = '🎉';
        message = `${after.targetHours}시간 단식 목표 100% 달성! 대단해요!`;
      } else if (achievement >= 50) {
        emoji = '👍';
        message = `${achievement}% 달성! 잘 하고 있어요!`;
      } else {
        emoji = '💪';
        message = `${achievement}% 달성. 다음엔 더 잘할 수 있어요!`;
      }
      
      await sendPushNotification(
        userId,
        `${emoji} 단식 완료!`,
        message,
        { type: 'fasting_complete', fastingId: context.params.fastingId }
      );
    }
  });

// ============================================
// 3. 스케줄 기반 알림 (매 5분마다 실행)
//    - 단식 종료 30분/1시간 전 알림
//    - 50% 달성 알림
//    - 장기 단식 마일스톤 (24h, 36h, 48h)
// ============================================
exports.scheduledPushNotifications = functions.pubsub
  .schedule('every 5 minutes')
  .timeZone('Asia/Seoul')
  .onRun(async (context) => {
    const now = admin.firestore.Timestamp.now();
    const nowMs = now.toMillis();
    
    // 현재 진행 중인 단식 조회 (endTime이 없는 것)
    const usersSnap = await db.collection('users').get();
    
    for (const userDoc of usersSnap.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();
      
      if (!userData.pushEnabled) continue;
      
      // 진행 중인 단식 조회
      const activeFastingSnap = await db
        .collection('users')
        .doc(userId)
        .collection('fastingHistory')
        .where('endTime', '==', null)
        .limit(1)
        .get();
      
      if (activeFastingSnap.empty) continue;
      
      const fastingDoc = activeFastingSnap.docs[0];
      const fasting = fastingDoc.data();
      const startTime = fasting.startTime?.toMillis();
      const targetHours = fasting.targetHours || 16;
      const targetMs = targetHours * 60 * 60 * 1000;
      const endTargetMs = startTime + targetMs;
      
      const elapsedMs = nowMs - startTime;
      const elapsedHours = elapsedMs / (60 * 60 * 1000);
      const progress = (elapsedMs / targetMs) * 100;
      
      // 알림 기록 확인 (중복 방지)
      const notified = fasting.notified || {};
      
      // --- 단식 종료 1시간 전 알림 ---
      const oneHourBefore = endTargetMs - (60 * 60 * 1000);
      if (nowMs >= oneHourBefore && nowMs < oneHourBefore + (5 * 60 * 1000) && !notified.oneHourBefore) {
        if (await checkPushSetting(userId, 'fastingEnd')) {
          await sendPushNotification(
            userId,
            '⏰ 단식 종료 1시간 전!',
            '목표까지 1시간 남았어요. 조금만 더 힘내세요!',
            { type: 'fasting_reminder' }
          );
          await fastingDoc.ref.update({ 'notified.oneHourBefore': true });
        }
      }
      
      // --- 단식 종료 30분 전 알림 ---
      const thirtyMinBefore = endTargetMs - (30 * 60 * 1000);
      if (nowMs >= thirtyMinBefore && nowMs < thirtyMinBefore + (5 * 60 * 1000) && !notified.thirtyMinBefore) {
        if (await checkPushSetting(userId, 'fastingEnd')) {
          await sendPushNotification(
            userId,
            '⏰ 단식 종료 30분 전!',
            '거의 다 왔어요! 30분만 더!',
            { type: 'fasting_reminder' }
          );
          await fastingDoc.ref.update({ 'notified.thirtyMinBefore': true });
        }
      }
      
      // --- 50% 달성 알림 ---
      if (progress >= 50 && progress < 55 && !notified.fiftyPercent) {
        if (await checkPushSetting(userId, 'milestone')) {
          await sendPushNotification(
            userId,
            '🔥 50% 달성!',
            `${targetHours}시간 단식의 절반을 넘었어요!`,
            { type: 'milestone' }
          );
          await fastingDoc.ref.update({ 'notified.fiftyPercent': true });
        }
      }
      
      // --- 장기 단식 마일스톤 (24시간 이상) ---
      if (targetHours >= 24 && await checkPushSetting(userId, 'longFasting')) {
        // 24시간 달성
        if (elapsedHours >= 24 && elapsedHours < 24.1 && !notified.milestone24h) {
          await sendPushNotification(
            userId,
            '🏆 24시간 달성!',
            '대단해요! 24시간 고비를 넘겼습니다!',
            { type: 'milestone' }
          );
          await fastingDoc.ref.update({ 'notified.milestone24h': true });
        }
        
        // 36시간 달성
        if (elapsedHours >= 36 && elapsedHours < 36.1 && !notified.milestone36h) {
          await sendPushNotification(
            userId,
            '🏆 36시간 달성!',
            '정말 대단합니다! 36시간을 버텼어요!',
            { type: 'milestone' }
          );
          await fastingDoc.ref.update({ 'notified.milestone36h': true });
        }
        
        // 48시간 달성
        if (elapsedHours >= 48 && elapsedHours < 48.1 && !notified.milestone48h) {
          await sendPushNotification(
            userId,
            '🏆 48시간 달성!',
            '믿기 힘든 의지력! 48시간 단식 완료!',
            { type: 'milestone' }
          );
          await fastingDoc.ref.update({ 'notified.milestone48h': true });
        }
      }
    }
    
    return null;
  });

// ============================================
// 4. 챌린지 댓글 알림 (Firestore 트리거)
// ============================================
exports.onChallengeComment = functions.firestore
  .document('challenges/{challengeId}/comments/{commentId}')
  .onCreate(async (snap, context) => {
    const { challengeId } = context.params;
    const comment = snap.data();
    const commenterUid = comment.uid;
    
    // 챌린지 정보 가져오기
    const challengeDoc = await db.collection('challenges').doc(challengeId).get();
    const challenge = challengeDoc.data();
    
    if (!challenge) return;
    
    // 챌린지 참가자들에게 알림 (댓글 작성자 제외)
    const participants = challenge.participants || [];
    
    for (const participantUid of participants) {
      if (participantUid === commenterUid) continue;
      
      if (await checkPushSetting(participantUid, 'challenge')) {
        await sendPushNotification(
          participantUid,
          `💬 ${challenge.title}`,
          `${comment.nickname || '누군가'}님이 댓글을 남겼습니다.`,
          { type: 'challenge_comment', challengeId }
        );
      }
    }
  });

// ============================================
// 5. 챌린지 초대 알림 (HTTP 트리거)
// ============================================
exports.sendChallengeInvite = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', '로그인이 필요합니다.');
  }
  
  const { inviteeUid, challengeId, challengeTitle } = data;
  const inviterUid = context.auth.uid;
  
  // 초대자 정보 가져오기
  const inviterDoc = await db.collection('users').doc(inviterUid).get();
  const inviterName = inviterDoc.data()?.nickname || '누군가';
  
  if (await checkPushSetting(inviteeUid, 'challenge')) {
    await sendPushNotification(
      inviteeUid,
      '🎯 챌린지 초대!',
      `${inviterName}님이 "${challengeTitle}" 챌린지에 초대했습니다.`,
      { type: 'challenge_invite', challengeId }
    );
  }
  
  return { success: true };
});

// ============================================
// 6. 테스트용 푸시 발송 (HTTP 트리거)
// ============================================
exports.testPush = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', '로그인이 필요합니다.');
  }
  
  const userId = context.auth.uid;
  
  const result = await sendPushNotification(
    userId,
    '🔔 테스트 알림',
    '푸시 알림이 정상적으로 작동합니다!',
    { type: 'test' }
  );
  
  return { success: result };
});