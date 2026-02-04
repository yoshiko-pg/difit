# difit Test Structure and Design

## Overview

This document describes the testing strategy for difit, including existing tests and planned test additions. The goal is to achieve comprehensive coverage of CLI parameter handling, Git operations, and server communication.

## Test Framework and Tools

- **Framework**: Vitest
- **Assertion**: Vitest built-in expect
- **Mocking**: Vitest vi.mock and vi.fn
- **HTTP Testing**: Native fetch or supertest (TBD)

## Existing Test Coverage

### 1. CLI Utilities (`src/cli/utils.test.ts`)

#### Coverage Areas

- **validateCommitish**: Format validation for Git references
  - SHA hashes (full and short)
  - Parent references (^, ^^)
  - Ancestor references (~n)
  - HEAD variations
  - Branch names
  - Special cases (".")
- **validateDiffArguments**: Argument combination validation
  - Format validation
  - Special argument restrictions
  - Same value comparison
  - Working directory restrictions
- **shortHash**: Hash truncation utility
- **parseGitHubPrUrl**: GitHub PR URL parsing

#### Test Quality

- Good coverage of edge cases
- Input validation including null/undefined
- Clear test descriptions
- Missing: Error message validation

## Planned Test Additions

### 1. CLI Integration Tests (`src/cli/index.test.ts`)

#### Test Design

```typescript
// Mock setup
vi.mock('simple-git');
vi.mock('../server/server.js');
vi.mock('./utils.js', async () => ({
  ...(await vi.importActual('./utils.js')),
  promptUser: vi.fn(),
}));
```

#### Test Scenarios

##### A. Basic Argument Handling

```typescript
describe('CLI argument processing', () => {
  test.each([
    ['no args', [], 'HEAD', 'HEAD^'],
    ['one arg', ['main'], 'main', 'main^'],
    ['two args', ['main', 'develop'], 'main', 'develop'],
    ['special: working', ['working'], 'working', 'staged'],
    ['special: staged', ['staged'], 'staged', 'HEAD'],
    ['special: dot', ['.'], '.', 'HEAD'],
  ])('%s', async (name, args, expectedTarget, expectedBase) => {
    // Test that correct arguments are passed to startServer
  });
});
```

##### B. Option Processing

```typescript
describe('CLI options', () => {
  test.each([
    ['--port', ['--port', '4000'], { port: 4000 }],
    ['--host', ['--host', '0.0.0.0'], { host: '0.0.0.0' }],
    ['--no-open', ['--no-open'], { open: false }],
    ['--mode', ['--mode', 'unified'], { mode: 'unified' }],
    ['--tui', ['--tui'], { tui: true }],
  ])('%s option', async (name, args, expectedOptions) => {
    // Verify options are passed correctly
  });
});
```

##### C. SimpleGit Interactions

```typescript
describe('Git operations', () => {
  test('handles untracked files for working/dot', async () => {
    const mockGit = {
      status: vi.fn().mockResolvedValue({
        not_added: ['file1.js', 'file2.js'],
      }),
      add: vi.fn().mockResolvedValue(undefined),
    };

    // Test prompt and intent-to-add flow
  });

  test('skips untracked check for regular commits', async () => {
    // Verify git.status not called for HEAD, branches, etc.
  });
});
```

##### D. PR Integration

```typescript
describe('GitHub PR handling', () => {
  test('resolves PR commits', async () => {
    // Mock resolvePrCommits
    // Verify correct commits passed to server
  });

  test('rejects PR with positional args', async () => {
    // Test error handling
  });
});
```

##### E. Error Scenarios

```typescript
describe('Error handling', () => {
  test.each([
    ['invalid args', ['working', 'main'], 'working.*cannot be compared'],
    ['same commit', ['HEAD', 'HEAD'], 'Cannot compare.*with itself'],
    ['server error', ['HEAD'], 'Failed to start server'],
  ])('%s', async (name, args, errorPattern) => {
    // Test process.exit and console.error
  });
});
```

### 2. Server Integration Tests (`src/server/server.test.ts`)

#### Test Design

```typescript
// Mock only Git operations, use real Express server
vi.mock('./git-diff.js', () => ({
  GitDiffParser: vi.fn().mockImplementation(() => ({
    validateCommit: vi.fn().mockResolvedValue(true),
    parseDiff: vi.fn().mockResolvedValue(mockDiffData),
  })),
}));
```

#### Test Scenarios

##### A. Server Startup

```typescript
describe('Server startup', () => {
  test('starts on preferred port', async () => {
    const { port, url } = await startServer({
      targetCommitish: 'HEAD',
      baseCommitish: 'HEAD^',
      preferredPort: 3456,
    });
    expect(port).toBe(3456);
  });

  test('fallback on port conflict', async () => {
    // Occupy port 3000, verify server uses 3001
  });

  test('binds to specified host', async () => {
    const { url } = await startServer({
      host: '0.0.0.0',
    });
    expect(url).toContain('localhost'); // Display host conversion
  });
});
```

##### B. API Endpoints

```typescript
describe('API endpoints', () => {
  let server;
  let port;

  beforeEach(async () => {
    const result = await startServer(defaultOptions);
    port = result.port;
  });

  test('GET /api/diff', async () => {
    const res = await fetch(`http://localhost:${port}/api/diff`);
    const data = await res.json();
    expect(data).toHaveProperty('files');
    expect(data).toHaveProperty('ignoreWhitespace', false);
  });

  test('GET /api/diff?ignoreWhitespace=true', async () => {
    // Verify re-parsing with whitespace ignored
  });

  test('POST /api/comments', async () => {
    const comments = [{ file: 'test.js', line: 10, body: 'Test' }];
    const res = await fetch(`http://localhost:${port}/api/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comments }),
    });
    expect(res.ok).toBe(true);
  });

  test('GET /api/heartbeat (SSE)', async () => {
    // Test Server-Sent Events connection
  });
});
```

##### C. Static File Serving

```typescript
describe('Static files', () => {
  test('serves client in production', async () => {
    process.env.NODE_ENV = 'production';
    // Test static file serving
  });

  test('dev mode response', async () => {
    process.env.NODE_ENV = 'development';
    // Test dev HTML response
  });
});
```

### 3. GitDiffParser Tests (`src/server/git-diff.test.ts`)

#### Test Scenarios

```typescript
describe('GitDiffParser', () => {
  test('validates commits', async () => {
    const mockGit = {
      show: vi.fn().mockResolvedValue('file1.js\nfile2.js'),
    };
    // Test validation logic
  });

  test('handles special arguments', async () => {
    // Test working, staged, . handling
  });

  test('parses diff output', async () => {
    // Test diff parsing with various formats
  });

  test('handles whitespace ignore', async () => {
    // Test --ignore-all-space flag
  });
});
```

## Test Execution Strategy

### 1. Unit Tests

- Run in isolation with all dependencies mocked
- Fast execution, no side effects
- Focus on logic and edge cases

### 2. Integration Tests

- Mock only external dependencies (Git, file system)
- Test component interactions
- Verify actual HTTP communication

### 3. Safety Measures

- No actual Git operations (fully mocked)
- Use random ports for server tests
- Clean up all resources in afterEach
- No working directory modifications

## Test Data Fixtures

### Mock Diff Data

```typescript
const mockDiffData = {
  targetCommit: 'abc123',
  baseCommit: 'def456',
  targetMessage: 'Fix: something',
  baseMessage: 'Initial commit',
  files: [
    {
      path: 'src/index.js',
      additions: 10,
      deletions: 5,
      chunks: [...]
    }
  ],
  stats: { additions: 10, deletions: 5 },
  isEmpty: false
};
```

### Mock Git Status

```typescript
const mockGitStatus = {
  not_added: ['newfile.js'],
  modified: ['existing.js'],
  staged: ['staged.js'],
};
```

## Coverage Goals

### Target Coverage

- Line coverage: >90%
- Branch coverage: >85%
- Function coverage: 100%

### Critical Paths

1. All CLI argument combinations
2. All error scenarios
3. All API endpoints
4. Git operation failures
5. Server startup edge cases

## CI/CD Integration

### Test Commands

```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage"
}
```

### Pre-commit Hooks

- Run affected tests only
- Block commit on test failure

## Future Considerations

### E2E Tests

- Full process spawn tests
- Actual Git repository operations in temp dirs
- Browser automation for UI testing

### Performance Tests

- Large diff handling
- Concurrent request handling
- Memory usage monitoring

### Security Tests

- Path traversal prevention
- XSS prevention in diff display
- CORS policy verification
