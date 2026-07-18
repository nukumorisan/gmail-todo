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
 * ・設定された間隔のトリガーを作成
 */
function setup() {
  addDefaultConfigProperties();
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

  // すべての利用者向け設定を読み込み、型と値を検証する。
  CONFIG.EXCLUDED_SUBJECT_KEYWORDS;
  CONFIG.GMAIL_SEARCH_QUERY;
  CONFIG.GEMINI_MODEL;
  CONFIG.TASK_LIST_TITLE;
  CONFIG.TASK_TITLE_PREFIX;
  CONFIG.INCLUDE_BODY_IN_TASK_NOTES;
  CONFIG.TRIGGER_INTERVAL_MINUTES;
}

/**
 * 存在しない利用者向け設定だけを初期値で追加する。
 * 旧形式の空文字は、同じ意味の null へ移行する。
 *
 * @return {number} 追加したプロパティ数
 */
function addDefaultConfigProperties() {
  const scriptProperties = PropertiesService.getScriptProperties();
  const existingProperties = scriptProperties.getProperties();
  const propertiesToAdd = {};
  const propertiesToMigrate = {};

  Object.keys(CONFIG_PROPERTY_DEFAULTS).forEach(name => {
    if (!Object.prototype.hasOwnProperty.call(existingProperties, name)) {
      propertiesToAdd[name] = CONFIG_PROPERTY_DEFAULTS[name];
    }
  });

  const addedPropertyNames = Object.keys(propertiesToAdd);
  ['TASK_LIST_TITLE', 'TASK_TITLE_PREFIX'].forEach(name => {
    if (existingProperties[name] === '') {
      propertiesToMigrate[name] = CONFIG_PROPERTY_DEFAULTS[name];
    }
  });
  const migratedPropertyNames = Object.keys(propertiesToMigrate);

  if (addedPropertyNames.length > 0 || migratedPropertyNames.length > 0) {
    scriptProperties.setProperties({
      ...propertiesToAdd,
      ...propertiesToMigrate,
    });
  }

  if (addedPropertyNames.length > 0) {
    console.log(
      `初期設定を${addedPropertyNames.length}件追加しました。`,
    );
  }

  if (migratedPropertyNames.length > 0) {
    console.log(
      `空の設定値を${migratedPropertyNames.length}件移行しました。`,
    );
  }

  return addedPropertyNames.length;
}

/**
 * 利用者向け設定をすべて初期値へ戻す。
 * APIキーと内部管理用プロパティは変更しない。
 */
function resetConfigProperties() {
  PropertiesService
    .getScriptProperties()
    .setProperties(CONFIG_PROPERTY_DEFAULTS);

  console.log('設定を初期値へ戻しました。');
  console.log('トリガーに反映するにはsetup()を実行してください。');
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
