<h1 align="center">
  <img src="public/logo.png" alt="difit" width="260">
</h1>

<p align="center">
  English | <a href="./README.ja.md">日本語</a> | <a href="./README.zh.md">简体中文</a> | <a href="./README.ko.md">한국어</a>
</p>

**difit** is a CLI tool that lets you view and review local git diffs with a GitHub-style viewer. In addition to clean visuals, comments can be copied as prompts for AI. The local code review tool for the AI era!

## ✨ Features

- ⚡ **Zero Config**: Just run `npx difit` and it works
- 💬 **Local Review**: Add comments to diffs and copy them with file paths and line numbers for AI
- 🖥️ **WebUI/TerminalUI**: Web UI in browser, or stay in terminal with `--tui`

## ⚡ Quick Start

```bash
npx difit    # View the latest commit diff in WebUI
```

## 🚀 Usage

### Basic Usage

```bash
npx difit <target>                    # View single commit diff
npx difit <target> [compare-with]     # Compare two commits/branches
npx difit --pr <github-pr-url>        # Review GitHub pull request
```

### Single commit review

```bash
npx difit          # HEAD (latest) commit
npx difit 6f4a9b7  # Specific commit
npx difit feature  # Latest commit on feature branch
```

### Compare two commits

```bash
npx difit HEAD main      # Compare HEAD with main branch
npx difit @ main         # Compare HEAD with main branch (@ is alias for HEAD)
npx difit @^ @~3         # Compare previous commit with 3 commits ago
npx difit feature main   # Compare branches
npx difit . origin/main  # Compare working directory with remote main
```

### Special Arguments

difit supports special keywords for common diff scenarios:

```bash
npx difit .        # All uncommitted changes (staging area + unstaged)
npx difit staged   # Staging area changes
npx difit working  # Unstaged changes only
```

### Stdin Support

difit can read unified diffs from stdin, enabling powerful pipeline workflows:

```bash
# Basic usage
git diff | npx difit

# Or explicitly with -
git diff | npx difit -

# Custom context lines
git diff -U10 | npx difit

# Compare against merge base
git diff --merge-base main feature | npx difit

# View diffs from other tools
diff -u file1.txt file2.txt | npx difit

# Review saved patches
cat changes.patch | npx difit
```

This allows you to use difit with any tool that outputs unified diff format, giving you full control over what differences to review.

### GitHub PR

```bash
npx difit --pr https://github.com/owner/repo/pull/123
```

difit automatically handles GitHub authentication using:

1. **GitHub CLI** (recommended): If you're logged in with `gh auth login`, difit uses your existing credentials
2. **Environment Variable**: Set `GITHUB_TOKEN` environment variable
3. **No Authentication**: Public repositories work without authentication (rate-limited)

#### GitHub Enterprise Server

For Enterprise Server PRs, you must set a token generated on YOUR Enterprise Server instance:

1. Go to `https://YOUR-ENTERPRISE-SERVER/settings/tokens`
2. Generate a personal access token with appropriate scopes
3. Set it as `GITHUB_TOKEN` environment variable

## ⚙️ CLI Options

| Flag             | Default      | Description                                                            |
| ---------------- | ------------ | ---------------------------------------------------------------------- |
| `<target>`       | HEAD         | Commit hash, tag, HEAD~n, branch, or special arguments                 |
| `[compare-with]` | -            | Optional second commit to compare with (shows diff between the two)    |
| `--pr <url>`     | -            | GitHub PR URL to review (e.g., https://github.com/owner/repo/pull/123) |
| `--port`         | 3000         | Preferred port; falls back to +1 if occupied                           |
| `--host`         | 127.0.0.1    | Host address to bind server to (use 0.0.0.0 for external access)       |
| `--no-open`      | false        | Don't automatically open browser                                       |
| `--mode`         | side-by-side | Display mode: `inline` or `side-by-side`                               |
| `--tui`          | false        | Use terminal UI mode instead of WebUI                                  |
| `--clean`        | false        | Clear all existing comments on startup                                 |
| `--watch`        | false        | Enable file watching mode with manual reload button (WebUI only)       |

## 🔄 Watch Mode

Add the `--watch` flag to monitor file changes and see a reload button when updates are detected:

```bash
npx difit --watch                    # Watch for changes
npx difit . --watch                  # Watch working directory changes
npx difit working --watch            # Watch staging area changes
npx difit HEAD main --watch          # Watch when comparing branches
```

When changes are detected, an orange reload button appears in the WebUI. Click it to refresh the diff view.

**Note**: Watch mode is currently available in WebUI only.

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

## 🎨 Syntax Highlighting Languages

- **JavaScript/TypeScript**: `.js`, `.jsx`, `.ts`, `.tsx`
- **Web Technologies**: HTML, CSS, JSON, XML, Markdown
- **Shell Scripts**: `.sh`, `.bash`, `.zsh`, `.fish`
- **Backend Languages**: PHP, SQL, Ruby, Java, Scala
- **Systems Languages**: C, C++, C#, Rust, Go
- **Mobile Languages**: Swift, Kotlin, Dart
- **Others**: Python, YAML, Solidity, Vim script

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

# Lint and format
pnpm run lint
pnpm run format
pnpm run typecheck
```

### Development Workflow

- **`pnpm run dev`**: Starts both Vite dev server (with hot reload) and CLI server simultaneously
- **`pnpm run start <target>`**: Builds everything and starts production server (for testing final build)
- **Development mode**: Uses Vite's dev server for hot reload and fast development
- **Production mode**: Serves built static files (used by npx and production builds)

## 🏗️ Architecture

- **CLI**: Commander.js for argument parsing with comprehensive validation
- **Backend**: Express server with simple-git for diff processing
- **GitHub Integration**: Octokit for GitHub API with automatic authentication (GitHub CLI + env vars)
- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS v4 with GitHub-like dark theme
- **Syntax Highlighting**: Prism.js with dynamic language loading
- **Testing**: Vitest for unit tests with co-located test files
- **Quality**: ESLint, Prettier, lefthook pre-commit hooks

## 📋 Requirements

- Node.js ≥ 21.0.0
- Git repository with commits to review

## 📄 License

MIT
