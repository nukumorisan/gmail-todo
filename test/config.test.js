const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const configSource = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'config.js'),
  'utf8',
);
const setupSource = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'setup.js'),
  'utf8',
);

function createContext(initialProperties) {
  const properties = { ...initialProperties };
  const logs = [];
  const scriptProperties = {
    getProperty: name =>
      Object.prototype.hasOwnProperty.call(properties, name)
        ? properties[name]
        : null,
    getProperties: () => ({ ...properties }),
    setProperties: values => Object.assign(properties, values),
  };
  const context = {
    PropertiesService: {
      getScriptProperties: () => scriptProperties,
    },
    ScriptApp: {
      getProjectTriggers: () => [],
      deleteTrigger() {},
      newTrigger: () => ({
        timeBased: () => ({
          everyMinutes: () => ({
            create() {},
          }),
        }),
      }),
    },
    getTargetTaskListId() {},
    ensureExcludedEmailSpreadsheet: () => ({
      getSheetByName: () => ({}),
      getUrl: () => 'https://example.com/spreadsheet',
    }),
    migrateExcludedEmailLogsFromScriptProperties() {},
    console: {
      log: value => logs.push(value),
    },
  };

  vm.createContext(context);
  vm.runInContext(configSource, context);
  vm.runInContext(setupSource, context);

  return { context, logs, properties };
}

function getDefaultProperties(context) {
  return JSON.parse(
    vm.runInContext(
      'JSON.stringify(CONFIG_PROPERTY_DEFAULTS)',
      context,
    ),
  );
}

test('画面から保存できる未指定値を使う', () => {
  const { context } = createContext({});
  const defaults = getDefaultProperties(context);

  assert.equal(defaults.TASK_LIST_TITLE, 'null');
  assert.equal(defaults.TASK_TITLE_PREFIX, 'null');
});

test('setupは不足している設定だけを初期値で追加する', () => {
  const { context, properties } = createContext({
    GEMINI_API_KEY: 'test-api-key',
    GMAIL_SEARCH_QUERY: 'label:todo',
    TASK_TITLE_PREFIX: '[仕事] ',
  });
  const defaults = getDefaultProperties(context);

  context.setup();

  assert.equal(properties.GMAIL_SEARCH_QUERY, 'label:todo');
  assert.equal(properties.TASK_TITLE_PREFIX, '[仕事] ');
  assert.equal(properties.GEMINI_API_KEY, 'test-api-key');
  Object.keys(defaults).forEach(name => {
    assert.ok(Object.prototype.hasOwnProperty.call(properties, name));
  });
});

test('setupは旧形式の空文字だけをnullへ移行する', () => {
  const { context, properties } = createContext({
    GEMINI_API_KEY: 'test-api-key',
    TASK_LIST_TITLE: '',
    TASK_TITLE_PREFIX: '',
  });

  context.setup();

  assert.equal(properties.TASK_LIST_TITLE, 'null');
  assert.equal(properties.TASK_TITLE_PREFIX, 'null');
});

test('resetConfigPropertiesは利用者向け設定だけを初期値へ戻す', () => {
  const { context, properties } = createContext({
    GEMINI_API_KEY: 'test-api-key',
    EXCLUDED_EMAIL_SPREADSHEET_ID: 'spreadsheet-id',
    GMAIL_SEARCH_QUERY: 'label:todo',
    INCLUDE_BODY_IN_TASK_NOTES: 'false',
  });
  const defaults = getDefaultProperties(context);

  context.resetConfigProperties();

  Object.entries(defaults).forEach(([name, value]) => {
    assert.equal(properties[name], value);
  });
  assert.equal(properties.GEMINI_API_KEY, 'test-api-key');
  assert.equal(
    properties.EXCLUDED_EMAIL_SPREADSHEET_ID,
    'spreadsheet-id',
  );
});

test('設定値を用途に応じた型へ変換する', () => {
  const { context } = createContext({
    EXCLUDED_SUBJECT_KEYWORDS: '["請求書","要返信"]',
    INCLUDE_BODY_IN_TASK_NOTES: 'false',
    TASK_LIST_TITLE: 'null',
    TASK_TITLE_PREFIX: 'null',
    TRIGGER_INTERVAL_MINUTES: '10',
  });
  const config = JSON.parse(
    vm.runInContext(
      `JSON.stringify({
        keywords: CONFIG.EXCLUDED_SUBJECT_KEYWORDS,
        includeBody: CONFIG.INCLUDE_BODY_IN_TASK_NOTES,
        taskListTitle: CONFIG.TASK_LIST_TITLE,
        taskTitlePrefix: CONFIG.TASK_TITLE_PREFIX,
        triggerInterval: CONFIG.TRIGGER_INTERVAL_MINUTES,
      })`,
      context,
    ),
  );

  assert.deepEqual(config, {
    keywords: ['請求書', '要返信'],
    includeBody: false,
    taskListTitle: null,
    taskTitlePrefix: '',
    triggerInterval: 10,
  });
});

test('未対応のトリガー間隔を拒否する', () => {
  const { context } = createContext({
    GEMINI_API_KEY: 'test-api-key',
    TRIGGER_INTERVAL_MINUTES: '2',
  });

  assert.throws(
    () => context.setup(),
    /TRIGGER_INTERVAL_MINUTESには1、5、10、15、30/,
  );
});
