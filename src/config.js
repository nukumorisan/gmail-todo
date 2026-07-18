/**
 * Gmail → Gemini判定 → Google Tasks登録
 *
 * 初期設定:
 * 1. スクリプトプロパティに GEMINI_API_KEY を登録
 * 2. GASエディタの「サービス」から Google Tasks API を追加
 * 3. setup() を手動実行
 *    初期設定値、除外メールログ用スプレッドシート、
 *    定期実行トリガーが作成される
 */

// ============================================================
// 設定
// ============================================================

/**
 * setup()でスクリプトプロパティへ追加する初期値。
 * Properties Serviceは値を文字列として保存する。
 */
const CONFIG_PROPERTY_DEFAULTS = Object.freeze({
  EXCLUDED_SUBJECT_KEYWORDS: JSON.stringify([
    '広告',
    'キャンペーン',
    'ニュースレター',
    'メルマガ',
    '自動返信',
    'Auto Reply',
    'Out of Office',
  ]),
  GMAIL_SEARCH_QUERY: 'in:inbox newer_than:2d',
  GEMINI_MODEL: 'gemini-3.1-flash-lite',
  TASK_LIST_TITLE: 'null',
  TASK_TITLE_PREFIX: 'null',
  INCLUDE_BODY_IN_TASK_NOTES: 'true',
  TRIGGER_INTERVAL_MINUTES: '5',
});

const CONFIG_PROPERTY_CACHE = {};

const CONFIG = {
  /**
   * 除外メールログの保存先。
   */
  EXCLUDED_EMAIL_SPREADSHEET_NAME:
    'Gmail TODO - 除外メールログ',

  /**
   * 除外メールログを保存するシート名。
   */
  EXCLUDED_EMAIL_LOG_SHEET_NAME: '除外メールログ',

  /**
   * 件名に以下の文字列が1つでも含まれるメールは除外する。
   * 大文字・小文字は区別しない。
   */
  get EXCLUDED_SUBJECT_KEYWORDS() {
    return getStringArrayConfigProperty('EXCLUDED_SUBJECT_KEYWORDS');
  },

  /**
   * Gmail検索条件。
   *
   * in:inbox:
   *   受信トレイ内のみ
   *
   * newer_than:2d:
   *   直近2日分を取得
   *
   * 処理済みIDを別途管理するので、
   * 毎回同じ検索結果が含まれてもTODOは重複作成されない。
   */
  get GMAIL_SEARCH_QUERY() {
    return getRequiredStringConfigProperty('GMAIL_SEARCH_QUERY');
  },

  /**
   * 1回のGmail検索で取得する最大スレッド数。
   * 検索結果が多い場合は、この件数ずつ続きへ進む。
   */
  MAX_THREADS_PER_RUN: 30,

  /**
   * 1回の実行でGemini APIを呼び出す最大回数。
   * 無料枠の15 RPMを超えないようにする。
   */
  MAX_GEMINI_REQUESTS_PER_RUN: 15,

  /**
   * Geminiへ渡すメール本文の最大文字数。
   * 長すぎるメールによるAPI使用量増加を防ぐ。
   */
  MAX_BODY_LENGTH: 8000,

  /**
   * 使用するGeminiモデル。
   * 軽量な分類用途なのでFlash-Liteを使用。
   */
  get GEMINI_MODEL() {
    return getRequiredStringConfigProperty('GEMINI_MODEL');
  },

  /**
   * Google Tasksの追加先リスト名。
   *
   * スクリプトプロパティの null:
   *   最初に見つかったタスクリストを使用
   */
  get TASK_LIST_TITLE() {
    return getNullableStringConfigProperty('TASK_LIST_TITLE');
  },

  /**
   * TODOタイトルの先頭に付ける文字列。
   * 不要ならスクリプトプロパティに null を指定する。
   */
  get TASK_TITLE_PREFIX() {
    return getNullableStringConfigProperty('TASK_TITLE_PREFIX') ?? '';
  },

  /**
   * TODOにメール本文の抜粋を含めるか。
   */
  get INCLUDE_BODY_IN_TASK_NOTES() {
    return getBooleanConfigProperty('INCLUDE_BODY_IN_TASK_NOTES');
  },

  /**
   * TODOのメモに含める本文の最大文字数。
   */
  TASK_NOTES_BODY_LENGTH: 1500,

  /**
   * 処理済みメールIDを保持する日数。
   *
   * Gmail検索対象が2日なら7日程度で十分。
   */
  PROCESSED_ID_RETENTION_DAYS: 7,

  /**
   * Apps Scriptでは1、5、10、15、30分を指定可能。
   */
  get TRIGGER_INTERVAL_MINUTES() {
    return getTriggerIntervalConfigProperty();
  },
};

function getConfigProperty(name) {
  if (Object.prototype.hasOwnProperty.call(CONFIG_PROPERTY_CACHE, name)) {
    return CONFIG_PROPERTY_CACHE[name];
  }

  const value = PropertiesService
    .getScriptProperties()
    .getProperty(name);

  const resolvedValue = value === null
    ? CONFIG_PROPERTY_DEFAULTS[name]
    : value;

  CONFIG_PROPERTY_CACHE[name] = resolvedValue;
  return resolvedValue;
}

function getRequiredStringConfigProperty(name) {
  const value = getConfigProperty(name);

  if (!value.trim()) {
    throw new Error(`${name}に空文字は指定できません。`);
  }

  return value;
}

function getNullableStringConfigProperty(name) {
  const value = getConfigProperty(name);
  return value === '' || value === 'null' ? null : value;
}

function getStringArrayConfigProperty(name) {
  const value = getConfigProperty(name);
  let parsedValue;

  try {
    parsedValue = JSON.parse(value);
  } catch (_error) {
    throw new Error(`${name}にはJSON配列を指定してください。`);
  }

  if (
    !Array.isArray(parsedValue) ||
    parsedValue.some(item => typeof item !== 'string' || !item)
  ) {
    throw new Error(`${name}には文字列のJSON配列を指定してください。`);
  }

  return parsedValue;
}

function getBooleanConfigProperty(name) {
  const value = getConfigProperty(name).trim().toLowerCase();

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  throw new Error(`${name}にはtrueまたはfalseを指定してください。`);
}

function getTriggerIntervalConfigProperty() {
  const name = 'TRIGGER_INTERVAL_MINUTES';
  const value = Number(getConfigProperty(name));
  const supportedIntervals = [1, 5, 10, 15, 30];

  if (!supportedIntervals.includes(value)) {
    throw new Error(`${name}には1、5、10、15、30のいずれかを指定してください。`);
  }

  return value;
}
