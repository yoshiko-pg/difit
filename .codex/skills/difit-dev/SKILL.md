---
name: difit-dev
description: Ask the user for a code review through difit after code changes in this repository, using `pnpm run dev`.
metadata:
  internal: true
---

# Difit Dev

## Overview

This skill requests a code review from the user using `pnpm run dev` in this repository.
If the user leaves review comments, they are printed to stdout when the difit command exits.
When review comments are returned, continue work and address them.
If the server is shut down without comments, treat it as "no review comments were provided." Restarting it is unnecessary.
Manual verification of whether the page launched correctly is also unnecessary.

## Commands

- Review uncommitted changes before commit: `pnpm run dev .`
- Review the HEAD commit: `pnpm run dev`
- Review staging area changes: `pnpm run dev staged`
- Review unstaged changes only: `pnpm run dev working`

Basic Usage:

```bash
pnpm run dev <target>                    # View single commit diff. ex: pnpm run dev 6f4a9b7
pnpm run dev <target> [compare-with]     # Compare two commits/branches. ex: pnpm run dev feature main
```

## Optional Startup Comments

If there is something you want to tell the user when difit opens, attach it as startup comments with `--comment`.
This is useful for review findings, explanations, and any context the user should see directly on the diff.

```bash
pnpm run dev <target> [compare-with] \
  --comment '{"type":"thread","filePath":"src/foobar.ts","position":{"side":"old","line":102},"body":"line 1\nline 2"}' \
  --comment '{"type":"thread","filePath":"src/example.ts","position":{"side":"new","line":{"start":36,"end":39}},"body":"Range comment for L36-L39"}'
```

- Do not insert `--` after `pnpm run dev` in this repository. `pnpm run dev -- ...` breaks argument parsing here.
- Use `type: "thread"` for each comment.
- Write comment bodies in the language the user is using.
- Use `position.side: "new"` for lines that exist on the target side of the diff.
- Use `position.side: "old"` for lines that exist only on the deleted side.
- Use range comments for issues that span multiple lines.

## Including Untracked Files

For uncommitted changes, if files not yet added to git should also appear in the diff, add `--include-untracked`.

```bash
pnpm run dev . --include-untracked
```

## Constraints

Can only be used inside this Git-managed repository.
