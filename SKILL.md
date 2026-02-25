---
name: difit
description: |
  After completing the requested implementation, use the difit command to ask the user for a code review.
---

This skill requests a code review from the user using the difit command.
If the user leaves review comments, they are printed to stdout when the difit command exits.
When review comments are returned, continue work and address them.
If the server is shut down without comments, treat it as "no review comments were provided."

# Commands

- Review the HEAD commit: `difit`
- Review uncommitted changes before commit: `difit .`

## Basic Usage

```bash
difit <target>                    # View single commit diff
difit <target> [compare-with]     # Compare two commits/branches
```

## Single commit review

```bash
difit          # HEAD (latest) commit
difit 6f4a9b7  # Specific commit
difit feature  # Latest commit on feature branch
```

## Compare two commits

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

# Constraints

Can only be used inside a Git-managed directory.
