---
name: difit-review
description: 特定の diff をレビューし、その指摘事項を difit（diff viewer）上のコメントとして表示する skill。ブランチ差分、コミット差分、GitHub PR をレビューして、見つけた問題点を `--comment` で difit に事前投入したいときに使う。
---

# Difit Review

## 概要

指定された diff をコードレビュー観点で確認し、指摘事項を difit の起動時コメントに変換してから difit を起動する。ユーザーが difit 上で文脈つきに指摘を確認できる状態まで持っていく。

通常のアシスタント応答は、まず指摘事項を先に並べる。difit のコメントには、具体的なバグ、リグレッション、危険な前提、テスト不足など、diff 上の位置にひも付ける価値がある内容だけを入れる。

## レビュー手順

1. レビュー対象を特定する。
   - ブランチ差分やコミット差分なら、依頼された範囲をレビューし、`<target> [compare-with]` で difit を起動する。
   - PR レビューなら、PR をローカルで確認し、レビュー結果はローカル出力にとどめる。GitHub へコメント投稿はしない。
2. 変更ファイルを読み、ユーザーの指示どおりにレビューして、difit 上で指摘すべき事項を洗い出す。
3. 各指摘事項を 1 つの起動時コメントに変換する。
   - 基本は各指摘ごとに `type: "thread"` を使う。
   - diff の target 側に存在する行には `position.side: "new"` を使う。
   - 削除された側にしか存在しない行には `position.side: "old"` を使う。
   - 複数行にまたがる問題だけを範囲コメントにする。
   - `body` は、その指摘単体で意味が通るように、何が危険か・なぜ問題かを書く。
4. ユーザーが UI 上で確認できるように difit を起動する。
5. 指摘が無い場合はその旨を明示しつつ、ユーザーが difit 表示を求めているなら difit は起動する。

## コマンド方針

- 配布用の例では、インストール済みの `difit` コマンドを使う。
- 指摘ごとに `--comment '<json>'` を 1 つ付ける。
- シェルの quoting が壊れにくいように、各 JSON は 1 行のコンパクトな形に保つ。

## コマンド例

ブランチ差分やコミット差分をレビューする:

```bash
difit <target> [compare-with] --comment '{"type":"thread","filePath":"src/example.ts","position":{"side":"new","line":42},"body":"この実装は ... の場合に壊れます"}'
```

PR をレビューする:

```bash
difit --pr <url> --comment '{"type":"thread","filePath":"src/example.ts","position":{"side":"new","line":42},"body":"この実装は ... の場合に壊れます"}'
```

## コメント形式

多くの指摘は次の形式で十分:

```json
{
  "type": "thread",
  "filePath": "src/example.ts",
  "position": { "side": "new", "line": 42 },
  "body": "同じ diff 位置に未解決 thread が複数ある PR では、reply の紐付けが thread identity ではなく最新位置基準になっているため、会話が別 thread に混ざります。"
}
```

`reply` は、同じ位置にある既存 thread に意図的に追記したいときだけ使う。
