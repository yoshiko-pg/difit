---
name: difit
description: Ask the user for a code review through difit after code changes.
---

# Difit

## Overview

This skill requests a code review from the user using difit.
Before running commands, choose `<difit-command>` using the following rule:

- If `command -v difit` succeeds, use `difit`.
- Otherwise, use `npx difit`.
- If falling back to `npx difit` would require network access in a sandboxed environment without network permission, request escalated permissions and user approval before running it.

If the user leaves review comments, they are printed to stdout when the chosen difit command exits.
When review comments are returned, continue work and address them.
If the server is shut down without comments, treat it as "no review comments were provided." Restarting it is unnecessary.
Manual verification of whether the page launched correctly is also unnecessary.

## Commands

- Review uncommitted changes before commit: `<difit-command> .`
- Review the HEAD commit: `<difit-command>`
- Review staging area changes: `<difit-command> staged`
- Review unstaged changes only: `<difit-command> working`

Basic Usage:

```bash
<difit-command> <target>                    # View single commit diff. ex: difit 6f4a9b7
<difit-command> <target> [compare-with]     # Compare two commits/branches. ex: difit feature main
```

## Optional Startup Comments

If there is something you want to tell the user when difit opens, attach it as startup comments with `--comment`.
This is useful for review findings, explanations, and any context the user should see directly on the diff.

```bash
<difit-command> <target> [compare-with] \
  --comment '{"type":"thread","filePath":"src/foobar.ts","position":{"side":"old","line":102},"body":"line 1\nline 2"}' \
  --comment '{"type":"thread","filePath":"src/example.ts","position":{"side":"new","line":{"start":36,"end":39}},"body":"Range comment for L36-L39"}'
```

- Use `type: "thread"` for each comment.
- Write comment bodies in the language the user is using.
- Use `position.side: "new"` for lines that exist on the target side of the diff.
- Use `position.side: "old"` for lines that exist only on the deleted side.
- Use range comments for issues that span multiple lines.
- Never copy secrets, tokens, passwords, API keys, private keys, or other credential-like material from the diff into `--comment` bodies or any command-line arguments.

## Including Untracked Files

For uncommitted changes, if files not yet added to git should also appear in the diff, add `--include-untracked`.

```bash
<difit-command> . --include-untracked
```

## Constraints

Can only be used inside a Git-managed directory.
