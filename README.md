# Gmail TODO

Gmailを定期検索し、Geminiで対応が必要なメールを判定してGoogle Tasksへ登録するGoogle Apps Scriptです。

## 利用方法

[最新のRelease](https://github.com/nukumorisan/gmail-todo/releases/latest)から次のファイルをダウンロードし、PDFの手順に従って設定してください。

- `gas.js`: GASへ貼り付けるコード
- `deployment-and-initial-setup.pdf`: デプロイ・初期実行手順

`setup()` を実行すると、利用者向け設定がスクリプトプロパティへ自動追加されます。コードを編集せずにGmailの検索条件、追加先タスクリスト、実行間隔などを変更できます。

## PDFをローカルで生成する

Node.js 20以上とpnpmが必要です。

```sh
pnpm install
pnpm docs:pdf
```

PDFは `doc/deployment-and-initial-setup.pdf` に生成されます。

## リリース

タグは `vYYYY.MM.DD.N` 形式とし、`N` はその日のリリース順を `0` から数えます。

```text
v2026.07.18.0
v2026.07.18.1
```

タグをpushするとGitHub ActionsがGASとPDFを生成・検証し、Releaseへ添付します。

```sh
git tag v2026.07.18.0
git push origin v2026.07.18.0
```
