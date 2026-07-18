// ============================================================
// Gmail処理
// ============================================================

/**
 * 件名に含まれる除外文字列を返す。
 *
 * @param {string} subject
 * @return {string|null}
 */
function findExcludedSubjectKeyword(subject) {
  const normalizedSubject = subject.toLocaleLowerCase();

  return CONFIG.EXCLUDED_SUBJECT_KEYWORDS.find(keyword =>
    normalizedSubject.includes(String(keyword).toLocaleLowerCase()),
  ) || null;
}

/**
 * GmailMessageをGeminiへ渡せる形式に変換する。
 *
 * @param {GoogleAppsScript.Gmail.GmailMessage} message
 * @return {{
 *   messageId: string,
 *   subject: string,
 *   from: string,
 *   to: string,
 *   date: string,
 *   body: string
 * }}
 */
function createEmailData(message) {
  const body = normalizeEmailBody(message.getPlainBody());

  return {
    messageId: message.getId(),
    subject: message.getSubject() || '(件名なし)',
    from: message.getFrom() || '',
    to: message.getTo() || '',
    date: message.getDate().toISOString(),
    body: body.slice(0, CONFIG.MAX_BODY_LENGTH),
    permalink: message.getThread().getPermalink(),
  };
}

/**
 * メール本文の余分な空白を整理する。
 *
 * @param {string} body
 * @return {string}
 */
function normalizeEmailBody(body) {
  return String(body || '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

