---
name: difit-review
description: Review branch diffs or GitHub PRs in the difit repository and show the findings inside difit with `--comment`. Use when the user asks to review `main` vs a feature branch, compare two commits or branches, or inspect a PR and wants the results preloaded as local difit comments instead of posted back to GitHub.
---

# Difit Review

## Overview

Review the requested diff with a code-review mindset, convert each actionable finding into a difit startup comment, and launch difit so the user can inspect the findings in context.

Keep the normal assistant response focused on findings first. Use difit comments only for concrete bugs, regressions, risky assumptions, or missing-test gaps that belong on a diff line.

## Review Workflow

1. Identify the review surface.
   - Branch or commit comparison: review the requested range and launch difit with `<target> [compare-with]`.
   - PR review: inspect the PR locally and keep the review output local. Do not post review comments back to GitHub.
2. Read the changed files and collect only actionable findings.
   - Prioritize bugs, behavior changes, data loss, broken mappings, unsafe assumptions, and missing tests.
   - Skip cosmetic nits unless the user explicitly asks for style feedback.
3. Convert each finding into one startup comment.
   - Prefer `type: "thread"` for each finding.
   - Use `position.side: "new"` for lines that exist on the target side of the diff.
   - Use `position.side: "old"` for deleted-only lines.
   - Use a line range only when the issue genuinely spans multiple adjacent lines.
   - Keep `body` self-contained: state the risk and the reason it is wrong or incomplete.
4. Start difit so the user can inspect the findings in the UI.
5. If there are no findings, say so explicitly and still launch difit when the user asked to view the diff in difit.

## Command Rules

- Inside this repository, prefer `pnpm run dev`.
- Do not insert an extra `--` after `pnpm run dev`; this script forwards args directly and `pnpm run dev -- ...` breaks argument parsing here.
- Use one `--comment '<json>'` flag per finding.
- Keep each JSON blob compact and single-line so shell quoting stays predictable.

## Command Templates

Review a branch or commit diff:

```bash
pnpm run dev <target> [compare-with] --comment '{"type":"thread","filePath":"src/example.ts","position":{"side":"new","line":42},"body":"This can fail when ..."}'
```

Review a PR:

```bash
pnpm run dev --pr <url> --comment '{"type":"thread","filePath":"src/example.ts","position":{"side":"new","line":42},"body":"This can fail when ..."}'
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
