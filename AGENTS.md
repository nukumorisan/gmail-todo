# AGENTS.md

## プロジェクト概要

このリポジトリは、Gmailを定期検索し、Geminiで要対応メールを判定してGoogle Tasksへ登録するGoogle Apps Script（GAS）です。

利用者は `dist/gas.js` を自分の独立したGASプロジェクトへコピーし、自分のGoogleアカウントとAPIキーで利用します。

## ファイル構成

- `src/`: 編集対象となるソースコード
- `src/config.js`: 利用者向け設定
- `src/setup.js`: 初期設定とトリガー管理
- `src/process-emails.js`: メイン処理
- `src/test-helpers.js`: GAS上で手動実行する確認用関数
- `combine.js`: `src/` を依存順に結合するスクリプト
- `dist/gas.js`: 配布用の生成ファイル

## 実装ルール

- `src/` を正とし、`dist/gas.js` は直接編集しない。
- ソース変更後は必ず `node combine.js` で `dist/gas.js` を再生成する。
- Apps ScriptのV8ランタイムを前提とし、`require`、ES Modules、Node.js専用APIを `src/` へ持ち込まない。
- GASではファイル間の関数や定数がグローバルに共有されるため、既存の命名と依存順を維持する。
- Gmail検索、Gemini判定、Google Tasks作成の既存フローは、依頼に関係しない限り変更しない。
- 一時的な外部APIエラーが発生したメールは処理済みにせず、次回実行で再試行できる状態を保つ。
- 外部入力をスプレッドシートへ保存するときは、数式として評価されないよう安全性を確認する。
- APIキー、メール本文、個人情報などの秘密情報をコード、ログ、テストデータへ追加しない。
- コメント、ログ、エラーメッセージは既存コードに合わせて日本語で簡潔に書く。
- 依頼に直接必要な範囲だけを変更し、無関係な整理や抽象化を行わない。

## 確認手順

変更後は最低限、次を実行する。

```sh
for file in src/*.js; do node --check "$file" || exit 1; done
node combine.js
node --check dist/gas.js
```

Gmail、Google Tasks、Spreadsheet、Properties Serviceなどの実サービスを使う動作はローカルでは完結しないため、必要に応じて `src/test-helpers.js` の関数または対象関数をGAS上で手動実行して確認する。

## Git

- コミットはユーザーから明示的に依頼された場合のみ行う。
- 生成物を含め、今回の依頼に関係するファイルだけをステージする。
- `.DS_Store`、APIキー、ローカル専用ファイルをコミットしない。
