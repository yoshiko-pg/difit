---
name: difit-review
description: Review branch diffs or GitHub PRs and show the findings inside difit with `--comment`. Use when the user asks to review `main` vs a feature branch, compare two commits or branches, or inspect a PR and wants the results preloaded as local difit comments instead of posted back to GitHub.
---

# Difit Review

## Overview

Review the requested diff with a code-review mindset, convert each actionable finding into a difit startup comment, and launch difit so the user can inspect the findings in context.

Keep the normal assistant response focused on findings first. Use difit comments only for concrete bugs, regressions, risky assumptions, or missing-test gaps that belong on a diff line.

## Review Workflow

1. Identify the review surface.
   - Branch or commit comparison: review the requested range and launch difit with `<target> [compare-with]`.
   - PR review: inspect the PR locally and keep the review output local. Do not post review comments back to GitHub.
2. Read the changed files, review them according to the user's instruction, and identify the findings that should be called out in difit.
3. Convert each finding into one startup comment.
   - Prefer `type: "thread"` for each finding.
   - Use `position.side: "new"` for lines that exist on the target side of the diff.
   - Use `position.side: "old"` for deleted-only lines.
   - Use a line range only when the issue genuinely spans multiple adjacent lines.
   - Keep `body` self-contained: state the risk and the reason it is wrong or incomplete.
4. Start difit so the user can inspect the findings in the UI.
5. If there are no findings, say so explicitly and still launch difit when the user asked to view the diff in difit.

## Command Rules

- Use the installed `difit` command in production-facing examples.
- Use one `--comment '<json>'` flag per finding.
- Keep each JSON blob compact and single-line so shell quoting stays predictable.

## Command Templates

Review a branch or commit diff:

```bash
difit <target> [compare-with] --comment '{"type":"thread","filePath":"src/example.ts","position":{"side":"new","line":42},"body":"This can fail when ..."}'
```

Review a PR:

```bash
difit --pr <url> --comment '{"type":"thread","filePath":"src/example.ts","position":{"side":"new","line":42},"body":"This can fail when ..."}'
```

## Comment Shape

Use this shape for most findings:

```json
{
  "type": "thread",
  "filePath": "src/example.ts",
  "position": { "side": "new", "line": 42 },
  "body": "This breaks when the PR contains multiple unresolved threads at the same diff position because replies are matched by latest position rather than thread identity."
}
```

Use `reply` only when intentionally attaching to an already imported thread at the same position.
