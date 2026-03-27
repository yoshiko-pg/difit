---
name: difit
description: Ask the user for a code review through difit after code changes. Use when implementation is finished and you want to launch difit for the user, optionally preload comments with `--comment`, or include untracked files in the review target.
---

# Difit

## Overview

This skill requests a code review from the user using the difit command.
If the user leaves review comments, they are printed to stdout when the difit command exits.
When review comments are returned, continue work and address them.
If the server is shut down without comments, treat it as "no review comments were provided."

## Commands

- Review the HEAD commit: `difit`
- Review uncommitted changes before commit: `difit .`

## Basic Usage

```bash
difit <target>                    # View single commit diff
difit <target> [compare-with]     # Compare two commits/branches
```

## Single Commit Review

```bash
difit          # HEAD (latest) commit
difit 6f4a9b7  # Specific commit
difit feature  # Latest commit on feature branch
```

## Compare Two Commits

```bash
difit @ main         # Compare with main branch (@ is alias for HEAD)
difit feature main   # Compare branches
difit . origin/main  # Compare working directory with remote main
```

## Special Arguments

difit supports special keywords for common diff scenarios:

```bash
difit .        # All uncommitted changes (staging area + unstaged)
difit staged   # Staging area changes
difit working  # Unstaged changes only
```

## Optional Startup Comments

If there is something you want to tell the user when difit opens, attach it as startup comments with `--comment`.
This is useful for review findings, explanations, and any context the user should see directly on the diff.

```bash
difit --comment '{"type":"thread","filePath":"src/example.ts","position":{"side":"new","line":42},"body":"This can fail when ..."}'
```

- Use `type: "thread"` for each comment.
- Use `position.side: "new"` for lines that exist on the target side of the diff.
- Use `position.side: "old"` for lines that exist only on the deleted side.
- Use range comments for issues that span multiple lines.

## Including Untracked Files

For uncommitted changes, if files not yet added to git should also appear in the diff, add `--include-untracked`.

```bash
difit . --include-untracked
```

## Constraints

Can only be used inside a Git-managed directory.
