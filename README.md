<div align="center">
  <img src="public/logo.png" alt="ReviewIt" width="400">
</div>

# ReviewIt 🔍

A lightweight command-line tool that spins up a local web server to display Git commit diffs in a GitHub-like Files changed view. Perfect for code review workflows without leaving the terminal! 🚀

## ✨ Features

- ⚡ **Zero Config**: Just run `npx reviewit <commit>` and it works
- 🌙 **Review for AI**: Add comments and generate Claude Code prompts
- 🖥️ **Terminal UI**: View diffs directly in terminal with `--tui`

## ⚡ Quick Start

```bash
npx reviewit    # View HEAD commit changes in a beautiful diff viewer
```

## 🚀 Usage

### Basic Usage

```bash
npx reviewit <commit-ish>                # View single commit diff
npx reviewit <commit-ish> [compare-with] # Compare two commits/branches
npx reviewit --pr <github-pr-url>        # Review GitHub pull request
```

### Single commit review

```bash
npx reviewit 6f4a9b7  # Specific commit
npx reviewit HEAD^    # Previous commit
npx reviewit feature  # Latest commit on branch
```

### Compare two commits

```bash
npx reviewit HEAD main      # Compare HEAD with main branch
npx reviewit feature main   # Compare branches
npx reviewit . origin/main  # Compare working directory with remote main
```

### Special Arguments

ReviewIt supports special keywords for common diff scenarios:

```bash
npx reviewit          # HEAD commit changes
npx reviewit .        # All uncommitted changes (staged + unstaged)
npx reviewit staged   # Staged changes ready for commit
npx reviewit working  # Unstaged changes only (cannot use compare-with)
```

| Keyword   | Description                                            | Compare-with Support |
| --------- | ------------------------------------------------------ | -------------------- |
| `.`       | Shows all uncommitted changes (both staged & unstaged) | ✅ Yes               |
| `staged`  | Shows staged changes ready to be committed             | ✅ Yes               |
| `working` | Shows unstaged changes in your working directory       | ❌ No                |

### GitHub PR

```bash
npx reviewit --pr https://github.com/owner/repo/pull/123
```

ReviewIt automatically handles GitHub authentication using:

1. **GitHub CLI** (recommended): If you're logged in with `gh auth login`, ReviewIt uses your existing credentials
2. **Environment Variable**: Set `GITHUB_TOKEN` environment variable
3. **No Authentication**: Public repositories work without authentication (rate-limited)

## ⚙️ CLI Options

| Flag             | Default      | Description                                                            |
| ---------------- | ------------ | ---------------------------------------------------------------------- |
| `<commit-ish>`   | HEAD         | Any Git reference: hash, tag, HEAD~n, branch, or Special Arguments     |
| `[compare-with]` | (optional)   | Optional second commit to compare with (shows diff between the two)    |
| `--pr <url>`     | -            | GitHub PR URL to review (e.g., https://github.com/owner/repo/pull/123) |
| `--port`         | auto         | Preferred port; falls back if occupied                                 |
| `--no-open`      | false        | Don't automatically open browser                                       |
| `--mode`         | side-by-side | Diff mode: `inline` or `side-by-side`                                  |
| `--tui`          | false        | Use terminal UI mode instead of web interface                          |

## 💬 Comment System

ReviewIt includes an inline commenting system that integrates with Claude Code:

1. **Add Comments**: Click on any diff line to add a comment
2. **Edit Comments**: Edit existing comments with the edit button
3. **Generate Prompts**: Comments include a "Copy Prompt" button that formats the context for Claude Code
4. **Copy All**: Use "Copy All Prompt" to copy all comments in a structured format
5. **Persistent Storage**: Comments are saved in browser localStorage per commit

### Comment Prompt Format

```sh
src/components/Button.tsx:42 # Automatically added this line
This name should probably be more specific.
```

## 🎨 Syntax Highlighting

ReviewIt supports syntax highlighting for multiple programming languages with dynamic loading:

### Supported Languages

- **JavaScript/TypeScript**: `.js`, `.jsx`, `.ts`, `.tsx`
- **Web Technologies**: HTML, CSS, JSON, XML, Markdown
- **Shell Scripts**: `.sh`, `.bash`, `.zsh`, `.fish` files
- **Backend Languages**: PHP, SQL, Ruby, Java, Scala
- **Systems Languages**: C, C++, Rust, Go
- **Others**: Python, Swift, Kotlin, YAML

### Dynamic Language Loading

- Languages are loaded on-demand for better performance
- Automatic language detection from file extensions
- Fallback to plain text for unsupported languages
- Safe dependency resolution (e.g., PHP requires markup-templating)

## 🛠️ Development

```bash
# Install dependencies
pnpm install

# Start development server (with hot reload)
# This runs both Vite dev server and CLI with NODE_ENV=development
pnpm run dev

# Build and start production server
pnpm run start <commit-ish>

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
- **`pnpm run start <commit-ish>`**: Builds everything and starts production server (for testing final build)
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

MIT 📝
