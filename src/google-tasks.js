// ============================================================
// Google Tasks処理
// ============================================================

/**
 * Google Tasksへタスクを追加する。
 *
 * @param {string} taskListId
 * @param {Object} email
 * @param {Object} judgment
 */
function createGoogleTask(taskListId, email, judgment) {
  const generatedTitle =
    judgment.taskTitle ||
    `${email.subject}に対応する`;

  const title =
    `${CONFIG.TASK_TITLE_PREFIX}${generatedTitle}`.slice(0, 1024);

  const notesParts = [
    `元メール件名: ${email.subject}`,
    `メール: ${email.permalink}`,
    `送信者: ${email.from}`,
    `受信日時: ${formatDateForDisplay(new Date(email.date))}`,
    `Geminiの判定理由: ${judgment.reason}`,
  ];
  if (CONFIG.INCLUDE_BODY_IN_TASK_NOTES && email.body) {
    notesParts.push(
      '',
      'メール本文抜粋:',
      email.body.slice(0, CONFIG.TASK_NOTES_BODY_LENGTH),
    );
  }

  const task = {
    title,
    notes: notesParts.join('\n'),

    /*
     * Google Tasks APIのdueはRFC 3339形式。
     * 時刻部分は期限判定には使用されず、日付として扱われる。
     */
    due: getTodayDueDate(),
  };

  const createdTask = Tasks.Tasks.insert(task, taskListId);

  console.log(
    `TODOを作成しました: ${createdTask.title}`,
  );
}

/**
 * 使用するGoogle TasksのタスクリストIDを取得する。
 *
 * @return {string}
 */
function getTargetTaskListId() {
  let pageToken = null;
  const allTaskLists = [];

  do {
    const options = {
      maxResults: 100,
    };

    if (pageToken) {
      options.pageToken = pageToken;
    }

    const response = Tasks.Tasklists.list(options);

    if (response.items) {
      allTaskLists.push(...response.items);
    }

    pageToken = response.nextPageToken || null;
  } while (pageToken);

  if (allTaskLists.length === 0) {
    throw new Error(
      'Google Tasksのタスクリストが見つかりませんでした。',
    );
  }

  if (!CONFIG.TASK_LIST_TITLE) {
    return allTaskLists[0].id;
  }

  const targetList = allTaskLists.find(
    taskList => taskList.title === CONFIG.TASK_LIST_TITLE,
  );

  if (!targetList) {
    const existingNames = allTaskLists
      .map(taskList => taskList.title)
      .join(', ');

    throw new Error(
      [
        `指定されたタスクリストが見つかりません: ${CONFIG.TASK_LIST_TITLE}`,
        `存在するタスクリスト: ${existingNames}`,
      ].join('\n'),
    );
  }

  return targetList.id;
}

/**
 * 今日をGoogle Tasksの期限形式で返す。
 *
 * Google Tasksの期限は実質的に日付のみなので、
 * スクリプトのタイムゾーンにおける今日の日付をUTCの0時として渡す。
 *
 * @return {string}
 */
function getTodayDueDate() {
  const timezone = Session.getScriptTimeZone();
  const today = Utilities.formatDate(
    new Date(),
    timezone,
    'yyyy-MM-dd',
  );

  return `${today}T00:00:00.000Z`;
}

/**
 * 日時をスクリプトのタイムゾーンで表示する。
 *
 * @param {Date} date
 * @return {string}
 */
function formatDateForDisplay(date) {
  return Utilities.formatDate(
    date,
    Session.getScriptTimeZone(),
    'yyyy/MM/dd HH:mm:ss',
  );
}

