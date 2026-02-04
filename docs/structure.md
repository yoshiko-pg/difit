# difit Codebase Structure

## Overview

difit is a CLI tool that displays Git diffs in a GitHub-like web interface. The architecture consists of three main components:

1. CLI entry point that handles command-line arguments
2. Server component that provides APIs and serves the web interface
3. Client web application (Web/TUI)

## Directory Structure

```
src/
├── cli/              # Command-line interface
│   ├── index.ts      # Main CLI entry point
│   ├── utils.ts      # CLI utility functions
│   └── utils.test.ts # Unit tests for utilities
├── server/           # Express server
│   ├── server.ts     # Server setup and API endpoints
│   └── git-diff.ts   # Git operations and diff parsing
├── client/           # React web application
│   └── ...          # UI components
├── tui/              # Terminal UI alternative
│   └── App.tsx      # TUI application
└── types/            # Shared TypeScript types
    └── diff.ts      # Diff-related type definitions
```

## CLI Arguments and Options

### Basic Usage

```bash
difit [commit-ish] [compare-with]
```

### Positional Arguments

- `[commit-ish]`: Target commit/branch/tag to review (default: HEAD)
  - Git references: SHA, branch names, tags
  - HEAD references: HEAD, HEAD~n, HEAD^
  - Special values: "working", "staged", "."
- `[compare-with]`: Optional base for comparison
  - If omitted: uses `commit-ish^` (parent commit)
  - Special handling for "working": compares with "staged"

### Options

| Option          | Description                                | Default   |
| --------------- | ------------------------------------------ | --------- |
| `--port <port>` | Preferred port (auto-assigned if occupied) | 4966      |
| `--host <host>` | Host address to bind                       | 127.0.0.1 |
| `--no-open`     | Do not automatically open browser          | false     |
| `--mode <mode>` | Diff display mode (split or unified)       | split     |
| `--tui`         | Use terminal UI instead of web interface   | false     |
| `--pr <url>`    | Review GitHub PR by URL                    | -         |

### Special Arguments Behavior

#### "working"

- Shows unstaged changes (working directory vs staging area)
- Cannot be used with `compare-with` (except "staged")
- Prompts for untracked files inclusion

#### "staged"

- Shows staged changes vs specified commit
- Only allowed as target, not as base
- Exception: allowed as base when target is "working"

#### "."

- Shows all uncommitted changes (working + staged)
- Can be compared with any commit
- Prompts for untracked files inclusion

## Git Operations (simple-git)

### CLI Operations

1. **Untracked Files Detection** (`src/cli/index.ts:97-98`)
   - Uses `git.status()` to find untracked files
   - Prompts user for intent-to-add inclusion
   - Executes `git.add(['--intent-to-add', ...files])`

### Server Operations (`src/server/git-diff.ts`)

1. **Commit Validation**
   - `git.show([commitish, '--name-only'])` - Verify commit exists
2. **Diff Generation**
   - `git.diffSummary(diffArgs)` - Get changed files summary
   - `git.diff(['--color=never', ...diffArgs])` - Get full diff content
3. **Revision Resolution**
   - `git.revparse([commitish])` - Resolve refs to SHA
4. **Status Checks**
   - `git.status()` - Check repository state

### GitHub PR Integration

- Uses `@octokit/rest` for GitHub API
- Authentication: `GITHUB_TOKEN` env or `gh auth token`
- Resolves PR commits locally after fetching metadata

## Server Architecture

### Express Server Setup

- **Port Assignment**: Automatic fallback on EADDRINUSE
- **CORS**: Restricted to localhost origins
- **Static Files**: Serves client dist in production

### API Endpoints

| Endpoint               | Method | Description                                        |
| ---------------------- | ------ | -------------------------------------------------- |
| `/api/diff`            | GET    | Retrieve diff data with optional whitespace ignore |
| `/api/comments`        | POST   | Save review comments                               |
| `/api/comments-output` | GET    | Get formatted comments output                      |
| `/api/heartbeat`       | GET    | SSE endpoint for tab close detection               |

### Request Flow

1. CLI validates arguments and starts server
2. Server fetches Git diff data on startup
3. Client connects and requests diff via API
4. Comments are stored in memory
5. On disconnect, comments are output to console

## Dependencies

### Core Dependencies

- **commander**: CLI framework for argument parsing
- **simple-git**: Git command wrapper
- **express**: Web server framework
- **@octokit/rest**: GitHub API client
- **react/ink**: UI frameworks (web/terminal)

### Development Tools

- **vitest**: Testing framework
- **typescript**: Type safety
- **eslint/prettier**: Code quality
- **lefthook**: Git hooks
- **vite**: Build tool for client

## Build and Distribution

### Build Process

1. TypeScript compilation for CLI/server
2. Vite build for React client
3. Bundle into dist/ directory

### Package Structure

```
dist/
├── cli/        # Compiled CLI code
├── server/     # Compiled server code
└── client/     # Built React application
```

### Entry Point

- Binary: `dist/cli/index.js` (via package.json bin field)
- Shebang: `#!/usr/bin/env node`

## Error Handling

### CLI Errors

- Invalid arguments: Validation with descriptive messages
- Git errors: Caught and displayed to user
- Server startup: Port conflicts handled automatically

### Server Errors

- Invalid commits: Pre-validated before server start
- API errors: JSON error responses
- Shutdown: Graceful with comment preservation

## Security Considerations

1. **Network Binding**
   - Default: 127.0.0.1 (localhost only)
   - Warning displayed for external binding
2. **CORS Policy**
   - Restricted to localhost origins
3. **File Access**
   - Limited to current Git repository
   - No arbitrary file system access

## Testing Strategy

### Current Test Coverage

- **Unit Tests**: CLI utilities (validation functions)
- **Missing**: Integration tests for Git operations
- **Missing**: Server API endpoint tests
- **Missing**: Error scenario testing
