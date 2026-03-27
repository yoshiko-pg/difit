---
name: difit-review
description: 特定の diff をレビューし、その指摘事項を difit（diff viewer）上のコメントとして表示する skill。ブランチ差分、コミット差分、GitHub PR をレビューして、見つけた問題点やコードの解説を `--comment` で difit に事前投入してユーザー向けに起動する。
---

# Difit Review

## 概要

指定された git diff を人間向けに見やすいviewerで起動できる。その際、 --comment optionでエージェントから任意のコメントを付与できる。
このコメント機能はコードレビューの指摘やコードの解説に適している。

## 手順

最終的なコマンド例は以下となる。

```bash
difit <target> [compare-with] \
  --comment '{"type":"thread","filePath":"src/foobar.ts","position":{"side":"old","line":102},"body":"1行目\n2行目"}' \
  --comment '{"type":"thread","filePath":"src/example.ts","position":{"side":"new","line":{"start":36,"end":39}},"body":"L36-L39 への範囲コメント"}'
```

以下に詳細な手順を示す。

1. 対象diffを特定し、内容を確認する。

- ユーザーから指示を受けたdiffを確認する。localのgit revision、GitHub URL、patchファイルなどが考えられる。
- 通常通りdiffの内容を把握し、必要であれば周辺コードも確認して、レビューや解説などの指示に対する回答を思考する。
- PR レビューの場合、PR をローカルで確認し、レビュー結果はdifitへの出力にとどめる。リモートのGitHub へコメント投稿はしない。

2. 用意した回答を付与してdifitを起動する。

- **difit自体の起動オプション**
  - `difit <target> [compare-with]` で対象diffを指定する。
  - Uncommitted Changeは `difit .`、workingは `difit working`、stagingは `difit staging` を指定する。
  - PRの場合は `difit --pr <URL>`、stdinの場合は `diff -u file1.txt file2.txt | difit` のように指定できる。
- **コメント引数**
  - 各コメントごとに `type: "thread"` を使う。
  - diff の target 側に存在する行には `position.side: "new"` を使う。
  - 削除された側にしか存在しない行には `position.side: "old"` を使う。
  - 複数行にまたがる問題は範囲コメントにする。
- **git追加されていないファイルの追加引数**
  - Uncommitted Changeの場合、gitにまだ追加されていないファイルもdiffに表示すべきと判断した場合は `--include-untracked` を付与する。

5. difitの起動URLを案内し、コメントが無く付けなかった場合はその旨を併記して回答を終了する。
   - 起動したdifitページの動作確認は不要。
