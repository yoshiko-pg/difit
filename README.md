<h1 align="center">
  <img src="public/logo.png" alt="difit" width="260">
</h1>

<p align="center">
  English | <a href="./README.ja.md">日本語</a> | <a href="./README.zh.md">简体中文</a> | <a href="./README.ko.md">한국어</a>
</p>

![difit screenshot](docs/images/screenshot.png)

**difit** is a CLI tool that lets you view and review local git diffs with a GitHub-style viewer. In addition to clean visuals, comments can be copied as prompts for AI. The local code review tool for the AI era!

## ⚡ Quick Start

Try it first

```bash
npx difit  # View the latest commit diff in WebUI
```

Install and use

```bash
npm install -g difit
difit  # View the latest commit diff in WebUI
```

Enable use from AI agents

```bash
npx skills add DoskoiYuta/difit # Add the Skills to your agent
```

Installed skills include:

- `difit`: ask the user for a review through difit after code changes
- `difit-review`: review a specific diff or PR and launch difit with findings or explanations preloaded as comments

## 🚀 Usage

### Basic Usage

```bash
difit <target>                    # View single commit diff
difit <target> [compare-with]     # Compare two commits/branches
```

### Single commit review

```bash
difit          # HEAD (latest) commit
difit 6f4a9b7  # Specific commit
difit feature  # Latest commit on feature branch
```

### Compare two commits

```bash
difit @ main         # Compare with main branch (@ is alias for HEAD)
difit feature main   # Compare branches
difit . origin/main  # Compare working directory with remote main
```

### Special Arguments

difit supports special keywords for common diff scenarios:

```bash
difit .        # All uncommitted changes (staging area + unstaged)
difit staged   # Staging area changes
difit working  # Unstaged changes only
```

### GitHub PR

```bash
difit --pr https://github.com/owner/repo/pull/123
```

`--pr` mode fetches patches by running `gh pr diff --patch` under the hood.
It also imports unresolved inline review threads from the PR so they appear as startup comments in difit.

Authentication is handled by GitHub CLI:

1. **Login once** (recommended): `gh auth login`
2. **Token-based auth** (CI/non-interactive): set `GH_TOKEN` or `GITHUB_TOKEN`

#### GitHub Enterprise Server

For Enterprise Server PRs, authenticate GitHub CLI against your Enterprise host:

1. `gh auth login --hostname YOUR-ENTERPRISE-SERVER`
2. Or set `GH_HOST=YOUR-ENTERPRISE-SERVER` with `GH_TOKEN`/`GITHUB_TOKEN`

### Initial Comments

You can inject initial review comments when launching difit:

```bash
difit --comment '{"type":"thread","filePath":"src/example.ts","position":{"side":"new","line":10},"body":"The background for this change is..."}'
```

`--comment` is repeatable and accepts either a single JSON object or a JSON array. Supported types:

- `thread`: create a new thread at the specified diff position
- `reply`: add a reply to the latest existing thread at the same diff position

If the same comment already exists, difit skips importing it.

### Stdin

By using a pipe to pass unified diffs via stdin, you can view diffs from any tool with difit.

```bash
# View diffs from other tools
diff -u file1.txt file2.txt | difit

# Review saved patches
cat changes.patch | difit

# Compare against merge base
git diff --merge-base main feature | difit

# Review an entire existing file as newly added
git diff -- /dev/null path/to/file | difit

# Explicit stdin mode
git diff --cached | difit -
```

Stdin mode is selected with intent-first rules:

- `-` explicitly enables stdin mode
- If positional arguments (`<target>` / `[compare-with]`), `--pr`, or `--tui` are provided, difit treats the command as Git/PR/TUI mode and does not auto-read stdin
- Auto stdin detection applies only when no explicit mode is selected and stdin is a pipe/file/socket

## ⚙️ CLI Options

| Flag                  | Default         | Description                                                                                             |
| --------------------- | --------------- | ------------------------------------------------------------------------------------------------------- |
| `<target>`            | HEAD            | Commit hash, tag, HEAD~n, branch, or special arguments                                                  |
| `[compare-with]`      | -               | Optional second commit to compare with (shows diff between the two)                                     |
| `--pr <url>`          | -               | GitHub PR URL to review (e.g., https://github.com/owner/repo/pull/123)                                  |
| `--comment <json>`    | -               | Inject initial comments (repeatable; accepts a JSON object or array)                                    |
| `--port`              | 4966            | Preferred port; falls back to +1 if occupied                                                            |
| `--host`              | 127.0.0.1       | Host address to bind server to (use 0.0.0.0 for external access)                                        |
| `--no-open`           | false           | Don't automatically open browser                                                                        |
| `--mode`              | split           | Display mode: `unified` or `split`                                                                      |
| `--tui`               | false           | Use terminal UI mode instead of WebUI                                                                   |
| `--clean`             | false           | Clear all existing comments and viewed files on startup                                                 |
| `--include-untracked` | false           | Automatically include untracked files in diff (only with `.` or `working`)                              |
| `--keep-alive`        | false           | Keep server running after browser disconnects (stop manually with Ctrl+C)                               |
| `--context <lines>`   | git default (3) | Limit surrounding context lines per change (`0` shows changes only; not available with `--pr` or stdin) |

## 💬 Comment System

difit includes a review comment system that makes it easy to provide feedback to AI coding agents:

1. **Add Comments**: Click the comment button on any diff line or drag to select a range
2. **Edit Comments**: Edit existing comments with the edit button
3. **Generate Prompts**: Comments include a "Copy Prompt" button that formats the context for AI coding agents
4. **Copy All**: Use "Copy All Prompt" to copy all comments in a structured format
5. **Persistent Storage**: Comments are saved in browser localStorage per commit

### Comment Prompt Format

```sh
src/components/Button.tsx:L42   # This line is automatically added
Make this variable name more descriptive
```

For range selections:

```sh
src/components/Button.tsx:L42-L48   # This line is automatically added
This section is unnecessary
```

## 🤖 Calling from Agents

You can install the following Skills to work with difit from AI agents.

```sh
npx skills add DoskoiYuta/difit
```

Installed skills include:

- `difit`: ask the user for a review through difit after code changes
- `difit-review`: review a specific diff or PR and launch difit with findings or explanations preloaded as comments

After code edits or automated review, the agent can start the difit server with the appropriate skill.

## 🎨 Syntax Highlighting Languages

- **JavaScript/TypeScript**: `.js`, `.jsx`, `.ts`, `.tsx`
- **Web Technologies**: HTML, CSS, JSON, XML, Markdown
- **Shell Scripts**: `.sh`, `.bash`, `.zsh`, `.fish`
- **Backend Languages**: PHP, SQL, Ruby, Java, Scala, Perl, Elixir
- **Systems Languages**: C, C++, C#, Rust, Go
- **Mobile Languages**: Swift, Kotlin, Dart
- **Infrastructure as Code**: Terraform (HCL)
- **Others**: Python, Protobuf, YAML, Solidity, Vim script

## 🔍 Auto-collapsed Files

difit automatically identifies and collapses certain files to keep your view clean:

- **Deleted files**: Removed files are auto-collapsed since they don't require close review
- **Generated files**: Auto-generated code is collapsed by default. This includes:
  - Lock files (`package-lock.json`, `go.mod`, `Cargo.lock`, `Gemfile.lock`, etc.)
  - Minified files (`*.min.js`, `*.min.css`)
  - Source maps (`*.map`)
  - Generated code:
    - Orval (`*.msw.ts`, `*.zod.ts`, `*.api.ts`)
    - Dart (`*.g.dart`, `*.freezed.dart`)
    - C# (`*.g.cs`, `*.designer.cs`)
    - Protobuf (`*.pb.go`, `*.pb.cc`, `*.pb.h`)
  - Frameworks:
    - Ruby on Rails (`db/schema.rb`)
    - Laravel (`_ide_helper.php`)
    - Gradle (`gradle.lockfile`)
    - Python (`uv.lock`, `pdm.lock`)
  - Generic generated files (`*.generated.cs`, `*.generated.ts`, `*.generated.js`)
  - Content-based detection:
    - Files containing `@generated` marker
    - Files containing `DO NOT EDIT` header
    - Language-specific generated headers (Go, Python, etc.)

## 🛠️ Development

```bash
# Install dependencies
pnpm install

# Start development server (with hot reload)
# This runs both Vite dev server and CLI with NODE_ENV=development
pnpm run dev

# Build and start production server
pnpm run start <target>

# Build for production
pnpm run build

# Run tests
pnpm test

# Run typecheck, lint, and format
pnpm run check
pnpm run format
```

### Development Workflow

- **`pnpm run dev`**: Starts both Vite dev server (with hot reload) and CLI server simultaneously
- **`pnpm run start <target>`**: Builds everything and starts production server (for testing final build)
- **Development mode**: Uses Vite's dev server for hot reload and fast development
- **Production mode**: Serves built static files (used by npx and production builds)

## 🏗️ Architecture

- **CLI**: Commander.js for argument parsing with comprehensive validation
- **Backend**: Express server with simple-git for diff processing
- **GitHub Integration**: GitHub CLI (`gh pr diff --patch`) for PR patch retrieval
- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS v4 with GitHub-like dark theme
- **Syntax Highlighting**: Prism.js with dynamic language loading
- **Testing**: Vitest for unit tests with co-located test files
- **Quality**: oxlint, oxfmt, lefthook pre-commit hooks

## 📋 Requirements

- Node.js ≥ 21.0.0
- Git repository with commits to review
- GitHub CLI (`gh`) for `--pr` mode

## 📄 License

MIT
