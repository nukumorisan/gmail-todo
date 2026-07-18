// ============================================================
// 除外メール管理
// ============================================================

const EXCLUDED_EMAIL_LOGS_PROPERTY_KEY =
  'EXCLUDED_EMAIL_LOGS';

const EXCLUDED_EMAIL_SPREADSHEET_ID_PROPERTY_KEY =
  'EXCLUDED_EMAIL_SPREADSHEET_ID';

const EXCLUDED_EMAIL_LOG_HEADERS = [
  '受信日時',
  '元メール件名',
  'メール',
  '除外理由',
  'GmailメッセージID',
];

const EXCLUDED_EMAIL_RECEIVED_AT_NUMBER_FORMAT =
  'yyyy/MM/dd HH:mm:ss';

/**
 * ログ用スプレッドシートを作成または検証する。
 *
 * @return {GoogleAppsScript.Spreadsheet.Spreadsheet}
 */
function ensureExcludedEmailSpreadsheet() {
  const scriptProperties = PropertiesService.getScriptProperties();
  const spreadsheetId = scriptProperties.getProperty(
    EXCLUDED_EMAIL_SPREADSHEET_ID_PROPERTY_KEY,
  );

  if (spreadsheetId && spreadsheetId.trim()) {
    const spreadsheet = openExcludedEmailSpreadsheetById(
      spreadsheetId.trim(),
    );

    spreadsheet.setSpreadsheetTimeZone(
      Session.getScriptTimeZone(),
    );
    ensureExcludedEmailLogSheet(spreadsheet);

    return spreadsheet;
  }

  const spreadsheet = SpreadsheetApp.create(
    CONFIG.EXCLUDED_EMAIL_SPREADSHEET_NAME,
  );
  const firstSheet = spreadsheet.getSheets()[0];

  spreadsheet.setSpreadsheetTimeZone(
    Session.getScriptTimeZone(),
  );
  firstSheet.setName(CONFIG.EXCLUDED_EMAIL_LOG_SHEET_NAME);
  ensureExcludedEmailLogSheet(spreadsheet);

  scriptProperties.setProperty(
    EXCLUDED_EMAIL_SPREADSHEET_ID_PROPERTY_KEY,
    spreadsheet.getId(),
  );

  return spreadsheet;
}

/**
 * 対象シートを作成または検証する。
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} spreadsheet
 * @return {GoogleAppsScript.Spreadsheet.Sheet}
 */
function ensureExcludedEmailLogSheet(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(
    CONFIG.EXCLUDED_EMAIL_LOG_SHEET_NAME,
  );

  if (!sheet) {
    sheet = spreadsheet.insertSheet(
      CONFIG.EXCLUDED_EMAIL_LOG_SHEET_NAME,
    );
  }

  ensureExcludedEmailLogSheetColumnCapacity(sheet);

  const headerValues = sheet
    .getRange(1, 1, 1, EXCLUDED_EMAIL_LOG_HEADERS.length)
    .getDisplayValues()[0];
  const isHeaderEmpty = headerValues.every(value => value === '');
  const isHeaderValid = EXCLUDED_EMAIL_LOG_HEADERS.every(
    (header, index) => headerValues[index] === header,
  );

  if (!isHeaderEmpty && !isHeaderValid && sheet.getLastRow() > 1) {
    throw new Error(
      [
        `シート「${CONFIG.EXCLUDED_EMAIL_LOG_SHEET_NAME}」のヘッダーが想定と異なります。`,
        '既存データを保護するため、ヘッダーは上書きしませんでした。',
        `想定ヘッダー: ${EXCLUDED_EMAIL_LOG_HEADERS.join(', ')}`,
      ].join('\n'),
    );
  }

  if (!isHeaderValid) {
    sheet
      .getRange(1, 1, 1, EXCLUDED_EMAIL_LOG_HEADERS.length)
      .setValues([EXCLUDED_EMAIL_LOG_HEADERS]);
  }

  applyExcludedEmailLogSheetSettings(sheet);

  return sheet;
}

/**
 * GmailMessageから保存用の内部オブジェクトを作る。
 *
 * @param {GoogleAppsScript.Gmail.GmailMessage} message
 * @param {string} reason
 * @return {{
 *   messageId: string,
 *   subject: string,
 *   permalink: string,
 *   reason: string,
 *   receivedAt: Date
 * }}
 */
function createExcludedEmailLog(message, reason) {
  return {
    messageId: message.getId(),
    subject: message.getSubject() || '(件名なし)',
    permalink: message.getThread().getPermalink(),
    reason,
    receivedAt: message.getDate(),
  };
}

/**
 * 新規除外ログを重複排除して一括追記する。
 *
 * @param {Array<Object>} logs
 * @return {{writtenCount: number, duplicateCount: number}}
 */
function appendExcludedEmailLogs(logs) {
  if (logs.length === 0) {
    return {
      writtenCount: 0,
      duplicateCount: 0,
    };
  }

  const sheet = getExcludedEmailLogSheetForWriting();
  const lastRow = sheet.getLastRow();
  const existingMessageIds = new Set();

  if (lastRow > 1) {
    sheet
      .getRange(2, 5, lastRow - 1, 1)
      .getDisplayValues()
      .forEach(([messageId]) => {
        if (messageId) {
          existingMessageIds.add(messageId);
        }
      });
  }

  const rows = [];
  let duplicateCount = 0;

  logs.forEach(log => {
    const messageId = String(log.messageId || '');

    if (!messageId) {
      throw new Error(
        '除外メールログにGmailメッセージIDがありません。',
      );
    }

    if (existingMessageIds.has(messageId)) {
      duplicateCount++;
      return;
    }

    existingMessageIds.add(messageId);
    rows.push([
      log.receivedAt,
      escapeSpreadsheetText(log.subject),
      String(log.permalink || ''),
      escapeSpreadsheetText(log.reason),
      messageId,
    ]);
  });

  rows.sort((left, right) => left[0] - right[0]);
  appendExcludedEmailLogRows(sheet, rows);

  console.log(
    `除外メールログを${rows.length}件追記し、重複${duplicateCount}件をスキップしました。`,
  );

  return {
    writtenCount: rows.length,
    duplicateCount,
  };
}

/**
 * 旧Script Propertiesログを一度だけ移行する。
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @return {number} 移行件数
 */
function migrateExcludedEmailLogsFromScriptProperties(sheet) {
  const scriptProperties = PropertiesService.getScriptProperties();
  const value = scriptProperties.getProperty(
    EXCLUDED_EMAIL_LOGS_PROPERTY_KEY,
  );

  if (!value) {
    return 0;
  }

  let oldLogs;

  try {
    oldLogs = JSON.parse(value);
  } catch (error) {
    throw new Error(
      `旧除外メールログをJSONとして解析できませんでした: ${error.message}`,
    );
  }

  if (!Array.isArray(oldLogs)) {
    throw new Error(
      '旧除外メールログの形式が配列ではありません。',
    );
  }

  const timezone = Session.getScriptTimeZone();
  const rows = oldLogs.map(log => [
    parseMigratedExcludedEmailReceivedAt(
      log['受信日時'],
      timezone,
    ),
    escapeSpreadsheetText(log['元メール件名']),
    String(log['メール'] || ''),
    escapeSpreadsheetText(log['除外理由']),
    '',
  ]);

  appendExcludedEmailLogRows(sheet, rows);
  scriptProperties.deleteProperty(EXCLUDED_EMAIL_LOGS_PROPERTY_KEY);

  console.log(
    `旧Script Propertiesから除外メールログを${rows.length}件移行しました。`,
  );

  return rows.length;
}

/**
 * 外部入力が数式として評価されない文字列へ変換する。
 *
 * @param {*} value
 * @return {string}
 */
function escapeSpreadsheetText(value) {
  const text = String(value || '');

  if (/^[=+\-@]/.test(text)) {
    return `'${text}`;
  }

  return text;
}

/**
 * 保存済みIDからスプレッドシートを開く。
 *
 * @param {string} spreadsheetId
 * @return {GoogleAppsScript.Spreadsheet.Spreadsheet}
 */
function openExcludedEmailSpreadsheetById(spreadsheetId) {
  try {
    return SpreadsheetApp.openById(spreadsheetId);
  } catch (error) {
    throw new Error(
      [
        `${EXCLUDED_EMAIL_SPREADSHEET_ID_PROPERTY_KEY}に設定されたスプレッドシートを開けませんでした。`,
        `設定されているID: ${spreadsheetId}`,
        'ファイルが存在し、実行者にアクセス権限があることを確認してください。',
        `新規作成する場合は${EXCLUDED_EMAIL_SPREADSHEET_ID_PROPERTY_KEY}を削除してsetup()を再実行してください。`,
        `詳細: ${error.message}`,
      ].join('\n'),
    );
  }
}

/**
 * 定期実行時に、修復せずログシートを取得する。
 *
 * @return {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getExcludedEmailLogSheetForWriting() {
  const spreadsheetId = PropertiesService
    .getScriptProperties()
    .getProperty(EXCLUDED_EMAIL_SPREADSHEET_ID_PROPERTY_KEY);

  if (!spreadsheetId || !spreadsheetId.trim()) {
    throw new Error(
      `${EXCLUDED_EMAIL_SPREADSHEET_ID_PROPERTY_KEY}が設定されていません。setup()を実行してください。`,
    );
  }

  const spreadsheet = openExcludedEmailSpreadsheetById(
    spreadsheetId.trim(),
  );
  const sheet = spreadsheet.getSheetByName(
    CONFIG.EXCLUDED_EMAIL_LOG_SHEET_NAME,
  );

  if (!sheet) {
    throw new Error(
      `シート「${CONFIG.EXCLUDED_EMAIL_LOG_SHEET_NAME}」がありません。setup()を再実行してください。`,
    );
  }

  if (sheet.getMaxColumns() < EXCLUDED_EMAIL_LOG_HEADERS.length) {
    throw new Error(
      `シート「${CONFIG.EXCLUDED_EMAIL_LOG_SHEET_NAME}」の列数が不足しています。setup()を再実行してください。`,
    );
  }

  const headerValues = sheet
    .getRange(1, 1, 1, EXCLUDED_EMAIL_LOG_HEADERS.length)
    .getDisplayValues()[0];
  const isHeaderValid = EXCLUDED_EMAIL_LOG_HEADERS.every(
    (header, index) => headerValues[index] === header,
  );

  if (!isHeaderValid) {
    throw new Error(
      `シート「${CONFIG.EXCLUDED_EMAIL_LOG_SHEET_NAME}」のヘッダーが想定と異なります。setup()を再実行してください。`,
    );
  }

  return sheet;
}

/**
 * ログ行をシート末尾へ一括追記する。
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {Array<Array<*>>} rows
 */
function appendExcludedEmailLogRows(sheet, rows) {
  if (rows.length === 0) {
    return;
  }

  const startRow = sheet.getLastRow() + 1;
  const requiredLastRow = startRow + rows.length - 1;

  if (requiredLastRow > sheet.getMaxRows()) {
    sheet.insertRowsAfter(
      sheet.getMaxRows(),
      requiredLastRow - sheet.getMaxRows(),
    );
  }

  sheet
    .getRange(
      startRow,
      1,
      rows.length,
      EXCLUDED_EMAIL_LOG_HEADERS.length,
    )
    .setValues(rows);
}

/**
 * シートの列数を保存形式に合わせる。
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 */
function ensureExcludedEmailLogSheetColumnCapacity(sheet) {
  const missingColumnCount =
    EXCLUDED_EMAIL_LOG_HEADERS.length - sheet.getMaxColumns();

  if (missingColumnCount > 0) {
    sheet.insertColumnsAfter(
      sheet.getMaxColumns(),
      missingColumnCount,
    );
  }
}

/**
 * ログシートの表示設定を適用する。
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 */
function applyExcludedEmailLogSheetSettings(sheet) {
  if (sheet.getMaxRows() < 2) {
    sheet.insertRowsAfter(1, 1);
  }

  sheet.setFrozenRows(1);
  sheet
    .getRange(2, 1, sheet.getMaxRows() - 1, 1)
    .setNumberFormat(EXCLUDED_EMAIL_RECEIVED_AT_NUMBER_FORMAT);

  sheet.setColumnWidth(1, 150);
  sheet.setColumnWidth(2, 300);
  sheet.setColumnWidth(3, 280);
  sheet.setColumnWidth(4, 320);
  sheet.setColumnWidth(5, 180);
  sheet.hideColumns(5);

  if (!sheet.getFilter()) {
    sheet
      .getRange(
        1,
        1,
        sheet.getMaxRows(),
        EXCLUDED_EMAIL_LOG_HEADERS.length,
      )
      .createFilter();
  }
}

/**
 * 旧ログの受信日時をDateへ変換する。
 *
 * @param {*} value
 * @param {string} timezone
 * @return {Date|string}
 */
function parseMigratedExcludedEmailReceivedAt(value, timezone) {
  const text = String(value || '');

  try {
    return Utilities.parseDate(
      text,
      timezone,
      EXCLUDED_EMAIL_RECEIVED_AT_NUMBER_FORMAT,
    );
  } catch (error) {
    return text;
  }
}
