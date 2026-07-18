/**
 * Gmail → Gemini判定 → Google Tasks登録
 *
 * 初期設定:
 * 1. スクリプトプロパティに GEMINI_API_KEY を登録
 * 2. GASエディタの「サービス」から Google Tasks API を追加
 * 3. setup() を手動実行
 *    除外メールログ用スプレッドシートと定期実行トリガーが作成される
 */

// ============================================================
// 設定
// ============================================================

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
  EXCLUDED_SUBJECT_KEYWORDS: [
    '広告',
    'キャンペーン',
    'ニュースレター',
    'メルマガ',
    '自動返信',
    'Auto Reply',
    'Out of Office',
  ],

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
  GMAIL_SEARCH_QUERY: 'in:inbox newer_than:2d',

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
  GEMINI_MODEL: 'gemini-3.1-flash-lite',

  /**
   * Google Tasksの追加先リスト名。
   *
   * null:
   *   最初に見つかったタスクリストを使用
   *
   * 例:
   *   '仕事'
   */
  TASK_LIST_TITLE: null,

  /**
   * TODOタイトルの先頭に付ける文字列。
   * 不要なら空文字にする。
   */
  TASK_TITLE_PREFIX: '',

  /**
   * TODOにメール本文の抜粋を含めるか。
   */
  INCLUDE_BODY_IN_TASK_NOTES: true,

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
   * 5分間隔。
   * Apps Scriptでは1、5、10、15、30分を指定可能。
   */
  TRIGGER_INTERVAL_MINUTES: 5,
};
