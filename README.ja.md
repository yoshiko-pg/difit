<h1 align="center">
  <img src="public/logo.png" alt="difit" width="260">
</h1>

<p align="center">
  <a href="./README.md">English</a> | 日本語 | <a href="./README.zh.md">简体中文</a> | <a href="./README.ko.md">한국어</a>
</p>

![difit screenshot](docs/images/screenshot.png)

**difit**は、ローカルのgit上にある差分をGitHub風のビューアで閲覧・レビューできるCLIツールです。見やすい表示に加え、コメントはAIへのプロンプトとしてコピーできます。AI時代のローカルコードレビューツール！

## ⚡ クイックスタート

まず試す

```bash
npx difit  # 最新コミットのdiffをWebUIで表示
```

インストールして使う

```bash
npm install -g difit
difit  # 最新コミットのdiffをWebUIで表示
```

## 🚀 使い方

### 基本的な使い方

```bash
difit <target>                    # 単一コミットのdiffを表示
difit <target> [compare-with]     # 2つのコミット/ブランチを比較
```

### 単一コミットのレビュー

```bash
difit          # HEAD（最新）のコミット
difit 6f4a9b7  # 特定のコミット
difit feature  # featureブランチの最新コミット
```

### 2つのコミットを比較

```bash
difit @ main         # mainブランチと比較（@はHEADのエイリアス）
difit feature main   # ブランチ間を比較
difit . origin/main  # 作業ディレクトリとリモートmainを比較
```

### 特別な引数

difitは一般的なdiffシナリオ用の特別なキーワードをサポートしています：

```bash
difit .        # すべての未コミット差分（ステージングエリア + 未ステージ）
difit staged   # ステージングエリアの差分
difit working  # 未ステージ差分のみ
```

### GitHub PR

```bash
difit --pr https://github.com/owner/repo/pull/123
```

difitは以下の方法でGitHub認証を自動的に処理します：

1. **GitHub CLI**（推奨）：`gh auth login`でログイン済みの場合、既存の認証情報を使用
2. **環境変数**：`GITHUB_TOKEN`環境変数を設定
3. **認証なし**：パブリックリポジトリは認証なしで動作（レート制限あり）

#### GitHub Enterprise Server

Enterprise ServerのPRを表示する場合、あなたのEnterprise Serverインスタンスで生成されたトークンを設定する必要があります：

1. `https://YOUR-ENTERPRISE-SERVER/settings/tokens`にアクセス
2. 適切なスコープでパーソナルアクセストークンを生成
3. `GITHUB_TOKEN`環境変数として設定

### 標準入力

パイプを使用して標準入力経由で統一diff形式を渡すことで、任意のツールからのdiffをdifitで表示できます。

```bash
# 他のツールからのdiffを表示
diff -u file1.txt file2.txt | difit

# 保存されたパッチをレビュー
cat changes.patch | difit

# マージベースとの比較
git diff --merge-base main feature | difit

# 既存ファイル全体を新規追加として確認
git diff -- /dev/null path/to/file | difit

# 明示的に標準入力モードを使う
git diff --cached | difit -
```

標準入力モードは、意図を優先して次のルールで選択されます。

- `-` を指定した場合は常に標準入力モード
- positional 引数（`<target>` / `[compare-with]`）、`--pr`、`--tui` のいずれかがある場合は Git/PR/TUI モードとして扱い、標準入力を自動読み取りしない
- 明示モード指定がない場合のみ、stdin が pipe/file/socket のときに自動で標準入力モードになる

## ⚙️ CLIオプション

| フラグ                | デフォルト | 説明                                                                              |
| --------------------- | ---------- | --------------------------------------------------------------------------------- |
| `<target>`            | HEAD       | コミットハッシュ、タグ、HEAD~n、ブランチ、または特別な引数                        |
| `[compare-with]`      | -          | 比較対象の2番目のコミット（2つの間のdiffを表示）                                  |
| `--pr <url>`          | -          | レビューするGitHub PRのURL（例：https://github.com/owner/repo/pull/123）          |
| `--port`              | 4966       | 優先ポート。使用中の場合は+1にフォールバック                                      |
| `--host`              | 127.0.0.1  | サーバーをバインドするホストアドレス（外部からアクセスしたい場合は0.0.0.0を指定） |
| `--no-open`           | false      | ブラウザを自動的に開かない                                                        |
| `--mode`              | split      | 表示モード。`unified`または`split`                                                |
| `--tui`               | false      | WebUIの代わりにターミナルUIを使用                                                 |
| `--clean`             | false      | 起動時に既存コメントと閲覧済みファイルをすべてクリア                              |
| `--include-untracked` | false      | diffにuntrackedファイルを自動的に含める（`.`または`working`のみ有効）             |
| `--keep-alive`        | false      | ブラウザ切断後もサーバーを終了せず起動したままにする（Ctrl+Cで手動停止）           |

## 💬 コメントシステム

difitにはAIコーディングエージェントへフィードバックしやすいレビューコメントシステムが含まれています：

1. **コメント追加**：diffの任意の行のコメントボタンをクリック or 範囲ドラッグしてコメントを追加
2. **コメント編集**：編集ボタンで既存のコメントを編集
3. **プロンプト生成**：コメントには、AIコーディングエージェント用にコンテキストをフォーマットする「Copy Prompt」ボタンが含まれます
4. **すべてコピー**：「Copy All Prompt」を使用して、すべてのコメントを構造化された形式でコピー
5. **永続的な保存**：コメントはコミットごとにブラウザのlocalStorageに保存されます

### コメントプロンプトフォーマット

```sh
src/components/Button.tsx:L42   # この行が自動的に追加されます
ここの変数名をもっとわかりやすくして
```

範囲指定した場合

```sh
src/components/Button.tsx:L42-L48   # この行が自動的に追加されます
この部分は不要です
```

## 🤖 エージェントからの呼び出し

difitを利用してユーザーにレビューを依頼するSkillを以下でインストールできます

```sh
npx skills add yoshiko-pg/difit
```

## 🎨 シンタックスハイライト対応言語

- **JavaScript/TypeScript**：`.js`, `.jsx`, `.ts`, `.tsx`
- **Web技術**：HTML, CSS, JSON, XML, Markdown
- **シェルスクリプト**：`.sh`, `.bash`, `.zsh`, `.fish`
- **バックエンド言語**：PHP, SQL, Ruby, Java, Scala, Perl
- **システム言語**：C, C++, C#, Rust, Go
- **モバイル言語**：Swift, Kotlin, Dart
- **IaC**：Terraform (HCL)
- **その他**：Python, Protobuf, YAML, Solidity, Vim Script

## 🔍 自動折りたたみファイル

difitは特定のファイルを自動的に識別し、ビューをすっきりさせるために折りたたみます：

- **削除されたファイル**: 削除されたファイルは詳細なレビューが不要なため、自動的に折りたたまれます
- **自動生成ファイル**: 自動生成されたコードはデフォルトで折りたたまれます。これには以下が含まれます：
  - ロックファイル (`package-lock.json`, `go.mod`, `Cargo.lock`, `Gemfile.lock` など)
  - 圧縮されたファイル (`*.min.js`, `*.min.css`)
  - ソースマップ (`*.map`)
  - 生成されたコード:
    - Orval (`*.msw.ts`, `*.zod.ts`, `*.api.ts`)
    - Dart (`*.g.dart`, `*.freezed.dart`)
    - C# (`*.g.cs`, `*.designer.cs`)
    - Protobuf (`*.pb.go`, `*.pb.cc`, `*.pb.h`)
  - フレームワーク:
    - Ruby on Rails (`db/schema.rb`)
    - Laravel (`_ide_helper.php`)
    - Gradle (`gradle.lockfile`)
    - Python (`uv.lock`, `pdm.lock`)
  - 一般的な生成ファイル (`*.generated.cs`, `*.generated.ts`, `*.generated.js`)
  - コンテンツベースの検出:
    - `@generated` マーカーを含むファイル
    - `DO NOT EDIT` ヘッダーを含むファイル
    - 言語固有の自動生成ヘッダー (Go, Pythonなど)

## 🛠️ 開発

```bash
# 依存関係のインストール
pnpm install

# 開発サーバーの起動（ホットリロード付き）
# これはViteの開発サーバーとCLIの両方をNODE_ENV=developmentで実行します
pnpm run dev

# プロダクションビルドとサーバーの起動
pnpm run start <target>

# プロダクション用ビルド
pnpm run build

# テストの実行
pnpm test

# リントとフォーマット
pnpm run lint
pnpm run format
pnpm run typecheck
```

### 開発ワークフロー

- **`pnpm run dev`**：Vite開発サーバー（ホットリロード付き）とCLIサーバーを同時に起動
- **`pnpm run start <target>`**：すべてをビルドしてプロダクションサーバーを起動（最終ビルドのテスト用）
- **開発モード**：ホットリロードと高速開発のためにViteの開発サーバーを使用
- **プロダクションモード**：ビルド済みの静的ファイルを提供（npxとプロダクションビルドで使用）

## 🏗️ アーキテクチャ

- **CLI**：包括的なバリデーションを備えたCommander.jsでの引数解析
- **バックエンド**：diff処理用のsimple-gitを備えたExpressサーバー
- **GitHub統合**：自動認証（GitHub CLI + 環境変数）を備えたOctokitでのGitHub API
- **フロントエンド**：React 18 + TypeScript + Vite
- **スタイリング**：GitHubライクなダークテーマを備えたTailwind CSS v4
- **シンタックスハイライト**：動的言語ロードを備えたPrism.js
- **テスト**：同じ場所に配置されたテストファイルを使用したVitestユニットテスト
- **品質**：Oxlint、Biome、lefthookプリコミットフック

## 📋 要件

- Node.js ≥ 21.0.0
- レビューするコミットを含むGitリポジトリ

## 📄 ライセンス

MIT
