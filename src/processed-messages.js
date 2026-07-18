// ============================================================
// 処理済みメール管理
// ============================================================

const PROCESSED_MESSAGES_PROPERTY_KEY =
  'PROCESSED_GMAIL_MESSAGE_IDS';

/**
 * 処理済みメッセージ一覧を読み込む。
 *
 * 形式:
 * {
 *   "GmailメッセージID": 処理時刻のUnixミリ秒
 * }
 *
 * @return {Object<string, number>}
 */
function loadProcessedMessages() {
  const value = PropertiesService
    .getScriptProperties()
    .getProperty(PROCESSED_MESSAGES_PROPERTY_KEY);

  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);

    if (
      parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed)
    ) {
      return parsed;
    }
  } catch (error) {
    console.error(
      '処理済みメール情報を解析できなかったため初期化します。',
      error,
    );
  }

  return {};
}

/**
 * メッセージを処理済みにする。
 *
 * @param {Object<string, number>} processedMessages
 * @param {string} messageId
 */
function markAsProcessed(processedMessages, messageId) {
  processedMessages[messageId] = Date.now();
}

/**
 * 古い処理済みIDを削除する。
 *
 * @param {Object<string, number>} processedMessages
 */
function pruneProcessedMessages(processedMessages) {
  const retentionMilliseconds =
    CONFIG.PROCESSED_ID_RETENTION_DAYS *
    24 *
    60 *
    60 *
    1000;

  const threshold = Date.now() - retentionMilliseconds;

  Object.entries(processedMessages).forEach(
    ([messageId, processedAt]) => {
      if (
        typeof processedAt !== 'number' ||
        processedAt < threshold
      ) {
        delete processedMessages[messageId];
      }
    },
  );
}

/**
 * 処理済みメッセージ一覧を保存する。
 *
 * @param {Object<string, number>} processedMessages
 */
function saveProcessedMessages(processedMessages) {
  PropertiesService
    .getScriptProperties()
    .setProperty(
      PROCESSED_MESSAGES_PROPERTY_KEY,
      JSON.stringify(processedMessages),
    );
}

/**
 * 処理済み状態をすべてリセットする。
 *
 * 実行すると、検索範囲内のメールが次回もう一度判定される。
 * デバッグ用途。
 */
function resetProcessedMessages() {
  PropertiesService
    .getScriptProperties()
    .deleteProperty(PROCESSED_MESSAGES_PROPERTY_KEY);

  console.log('処理済みメール情報をリセットしました。');
}

