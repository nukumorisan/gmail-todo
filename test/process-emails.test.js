const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const processEmailsSource = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'process-emails.js'),
  'utf8',
);
const geminiSource = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'gemini.js'),
  'utf8',
);

function createMessages(count) {
  return Array.from({ length: count }, (_, index) => ({
    getId: () => String(index + 1),
    getSubject: () => `メール${index + 1}`,
  }));
}

function runProcessEmails({
  messages,
  processedMessages,
  judgeEmailWithGemini,
}) {
  const summaries = [];
  let geminiRequestCount = 0;

  const context = {
    LockService: {
      getScriptLock: () => ({
        tryLock: () => true,
        releaseLock() {},
      }),
    },
    CONFIG: {
      GMAIL_SEARCH_QUERY: 'test',
      MAX_THREADS_PER_RUN: 30,
      MAX_GEMINI_REQUESTS_PER_RUN: 15,
    },
    GmailApp: {
      search: (_query, start, max) =>
        messages.slice(start, start + max).map(message => ({
          getMessages: () => [message],
        })),
    },
    validateConfiguration() {},
    loadProcessedMessages: () => processedMessages,
    getTargetTaskListId: () => 'task-list',
    findExcludedSubjectKeyword: () => null,
    createEmailData: message => ({
      subject: message.getSubject(),
    }),
    judgeEmailWithGemini(email) {
      geminiRequestCount++;
      return judgeEmailWithGemini(email);
    },
    createGoogleTask() {},
    createExcludedEmailLog: message => ({
      messageId: message.getId(),
    }),
    markAsProcessed: (state, messageId) => {
      state[messageId] = Date.now();
    },
    pruneProcessedMessages() {},
    appendExcludedEmailLogs() {},
    saveProcessedMessages() {},
    console: {
      log: value => summaries.push(value),
      error() {},
    },
  };

  vm.createContext(context);
  vm.runInContext(processEmailsSource, context);
  context.processEmails();

  return {
    geminiRequestCount,
    summary: summaries.at(-1),
  };
}

test('Gemini呼び出しを15回で止め、次回に残りから再開する', () => {
  const messages = createMessages(31);
  const processedMessages = {};
  const judge = () => ({
    shouldCreateTask: false,
    reason: 'テスト',
  });

  const firstRun = runProcessEmails({
    messages,
    processedMessages,
    judgeEmailWithGemini: judge,
  });

  assert.equal(firstRun.geminiRequestCount, 15);
  assert.equal(Object.keys(processedMessages).length, 15);
  assert.equal(firstRun.summary.geminiRequestLimitReached, true);
  assert.equal(firstRun.summary.errorCount, 0);

  const secondRun = runProcessEmails({
    messages,
    processedMessages,
    judgeEmailWithGemini: judge,
  });

  assert.equal(secondRun.geminiRequestCount, 15);
  assert.equal(Object.keys(processedMessages).length, 30);
  assert.equal(secondRun.summary.geminiRequestLimitReached, true);

  const thirdRun = runProcessEmails({
    messages,
    processedMessages,
    judgeEmailWithGemini: judge,
  });

  assert.equal(thirdRun.geminiRequestCount, 1);
  assert.equal(Object.keys(processedMessages).length, 31);
  assert.equal(thirdRun.summary.geminiRequestLimitReached, false);
});

test('Geminiの429を1件のエラーとして数え、その実行のAPI呼び出しを止める', () => {
  const processedMessages = {};
  const rateLimitError = new Error('Gemini API error (429): quota');
  rateLimitError.geminiStatusCode = 429;

  const result = runProcessEmails({
    messages: createMessages(3),
    processedMessages,
    judgeEmailWithGemini: () => {
      throw rateLimitError;
    },
  });

  assert.equal(result.geminiRequestCount, 1);
  assert.equal(result.summary.errorCount, 1);
  assert.equal(result.summary.geminiRateLimitReached, true);
  assert.deepEqual(processedMessages, {});
});

test('Gemini APIのHTTPステータスをエラーへ保持する', () => {
  const context = {
    CONFIG: {
      GEMINI_MODEL: 'test-model',
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: () => 'test-api-key',
      }),
    },
    UrlFetchApp: {
      fetch: () => ({
        getResponseCode: () => 429,
        getContentText: () => '{"error":"quota"}',
      }),
    },
  };

  vm.createContext(context);
  vm.runInContext(geminiSource, context);

  assert.throws(
    () => context.judgeEmailWithGemini({
      from: 'from@example.com',
      to: 'to@example.com',
      subject: 'テスト',
      date: '2026-07-18',
      body: '本文',
    }),
    error => error.geminiStatusCode === 429,
  );
});
