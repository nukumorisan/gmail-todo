// ============================================================
// メイン処理
// ============================================================

/**
 * 5分おきに実行されるメイン処理。
 */
function processEmails() {
  const lock = LockService.getScriptLock();

  // 前回処理がまだ動いている場合は重複実行しない。
  if (!lock.tryLock(1000)) {
    console.log('別の処理が実行中のため、今回の実行をスキップしました。');
    return;
  }

  try {
    validateConfiguration();

    const processedMessages = loadProcessedMessages();
    const excludedEmailLogs = [];
    const taskListId = getTargetTaskListId();

    const threads = GmailApp.search(
      CONFIG.GMAIL_SEARCH_QUERY,
      0,
      CONFIG.MAX_THREADS_PER_RUN,
    );

    let checkedCount = 0;
    let excludedCount = 0;
    let taskCreatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const thread of threads) {
      const messages = thread.getMessages();

      for (const message of messages) {
        const messageId = message.getId();

        if (processedMessages[messageId]) {
          skippedCount++;
          continue;
        }

        checkedCount++;

        try {
          const subject = message.getSubject() || '(件名なし)';
          const excludedKeyword = findExcludedSubjectKeyword(subject);

          if (excludedKeyword) {
            excludedCount++;
            excludedEmailLogs.push(
              createExcludedEmailLog(
                message,
                `EXCLUDED_SUBJECT_KEYWORDSの「${excludedKeyword}」に引っかかった`,
              ),
            );
            markAsProcessed(processedMessages, messageId);
            continue;
          }

          const emailData = createEmailData(message);
          const judgment = judgeEmailWithGemini(emailData);

          if (judgment.shouldCreateTask) {
            createGoogleTask(taskListId, emailData, judgment);
            taskCreatedCount++;
          } else {
            excludedCount++;
            excludedEmailLogs.push(
              createExcludedEmailLog(
                message,
                `AIによる判定: ${judgment.reason || 'TODO作成不要と判定された'}`,
              ),
            );
          }

          /*
           * TODO対象外だった場合も処理済みにする。
           * これにより5分後に同じメールを再判定しない。
           */
          markAsProcessed(processedMessages, messageId);
        } catch (error) {
          errorCount++;

          /*
           * エラーになったメールは処理済みにしない。
           * 一時的なAPIエラーなら次回再試行される。
           */
          console.error(
            `メール処理中にエラーが発生しました。messageId=${messageId}`,
            error,
          );
        }
      }
    }

    pruneProcessedMessages(processedMessages);
    appendExcludedEmailLogs(excludedEmailLogs);
    saveProcessedMessages(processedMessages);

    console.log({
      checkedCount,
      excludedCount,
      taskCreatedCount,
      skippedCount,
      errorCount,
    });
  } finally {
    lock.releaseLock();
  }
}
