// ============================================================
// テスト用
// ============================================================

/**
 * トリガーを待たず、手動でメール監視をテストする。
 */
function testProcessEmails() {
  processEmails();
}

/**
 * Gemini APIだけをテストする。
 */
function testGemini() {
  const result = judgeEmailWithGemini({
    messageId: 'test-message',
    subject: '見積書の確認をお願いします',
    from: '山田太郎 <yamada@example.com>',
    to: '自分 <me@example.com>',
    date: new Date().toISOString(),
    body:
      '添付した見積書をご確認いただき、明日までに返信をお願いします。',
  });

  console.log(result);
}

/**
 * Google Tasksへの追加だけをテストする。
 */
function testCreateTask() {
  const taskListId = getTargetTaskListId();

  createGoogleTask(
    taskListId,
    {
      subject: 'テストメール',
      from: 'test@example.com',
      date: new Date().toISOString(),
      body: 'これはGoogle Tasks登録のテストです。',
    },
    {
      shouldCreateTask: true,
      taskTitle: 'GASの自動TODO登録を確認する',
      reason: '動作確認用のテスト',
    },
  );
}

/**
 * 除外メールログの追記と重複防止をテストする。
 */
function testAppendExcludedEmailLogs() {
  const messageId = `test-${Date.now()}`;
  const testLog = {
    messageId,
    subject: '=除外ログの数式対策テスト',
    permalink: 'https://mail.google.com/',
    reason: '+手動テスト',
    receivedAt: new Date(),
  };

  const firstResult = appendExcludedEmailLogs([testLog]);
  const duplicateResult = appendExcludedEmailLogs([testLog]);

  console.log({
    firstResult,
    duplicateResult,
  });
}
