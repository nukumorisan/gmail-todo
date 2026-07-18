#!/usr/bin/env node

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = __dirname;
const SOURCE_DIR = path.join(ROOT_DIR, 'src');
const OUTPUT_FILE = path.join(ROOT_DIR, 'dist', 'gas.js');

/*
 * Apps Scriptではファイルをまたいだ依存関係が暗黙的になるため、
 * 読みやすい依存順をここで明示する。
 */
const SOURCE_FILES = [
  'config.js',
  'setup.js',
  'process-emails.js',
  'gmail.js',
  'gemini.js',
  'google-tasks.js',
  'excluded-email-logs.js',
  'processed-messages.js',
  'test-helpers.js',
];

function combine() {
  const output = SOURCE_FILES
    .map(filename => {
      const sourcePath = path.join(SOURCE_DIR, filename);

      if (!fs.existsSync(sourcePath)) {
        throw new Error(`ソースファイルが見つかりません: ${sourcePath}`);
      }

      return fs.readFileSync(sourcePath, 'utf8').trimEnd();
    })
    .join('\n\n') + '\n';

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, output, 'utf8');

  console.log(`結合ファイルを出力しました: ${OUTPUT_FILE}`);
}

combine();
