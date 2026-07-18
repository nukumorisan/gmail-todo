// ============================================================
// 初期設定
// ============================================================

/**
 * 最初に一度だけ手動実行する。
 *
 * ・必要な設定を確認
 * ・Google Tasksリストを確認
 * ・除外メールログ用スプレッドシートを作成または検証
 * ・旧除外メールログを移行
 * ・既存トリガーを削除
 * ・5分おきのトリガーを作成
 */
function setup() {
  validateConfiguration();
  getTargetTaskListId();
  const spreadsheet = ensureExcludedEmailSpreadsheet();
  const sheet = spreadsheet.getSheetByName(
    CONFIG.EXCLUDED_EMAIL_LOG_SHEET_NAME,
  );

  migrateExcludedEmailLogsFromScriptProperties(sheet);
  recreateTrigger();

  console.log(
    `除外メールログ: ${spreadsheet.getUrl()}`,
  );
  console.log('セットアップが完了しました。');
  console.log(
    `${CONFIG.TRIGGER_INTERVAL_MINUTES}分おきに processEmails() を実行します。`,
  );
}

/**
 * Gemini APIキーが設定されているか確認する。
 */
function validateConfiguration() {
  const apiKey = PropertiesService
    .getScriptProperties()
    .getProperty('GEMINI_API_KEY');

  if (!apiKey) {
    throw new Error(
      [
        'GEMINI_API_KEYが設定されていません。',
        '',
        'GASエディタで以下を設定してください。',
        'プロジェクトの設定 → スクリプト プロパティ',
        '',
        'プロパティ: GEMINI_API_KEY',
        '値: Google AI Studioで発行したAPIキー',
      ].join('\n'),
    );
  }
}

/**
 * processEmails用のトリガーを作り直す。
 *
 * setup()を複数回実行しても、
 * 同じトリガーが重複しないようにしている。
 */
function recreateTrigger() {
  const handlerFunction = 'processEmails';

  ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.getHandlerFunction() === handlerFunction)
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger(handlerFunction)
    .timeBased()
    .everyMinutes(CONFIG.TRIGGER_INTERVAL_MINUTES)
    .create();
}

/**
 * 自動実行を停止したい場合に手動実行する。
 */
function deleteTrigger() {
  const handlerFunction = 'processEmails';

  const triggers = ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.getHandlerFunction() === handlerFunction);

  triggers.forEach(trigger => ScriptApp.deleteTrigger(trigger));

  console.log(`${triggers.length}件のトリガーを削除しました。`);
}
