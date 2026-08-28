---
name: difit
description: Ask the user for a code review by opening the changes in difit, a local diff viewer. Explicit opt-in only — use when the user names difit, asks to open or show the diff in the viewer, or has a standing instruction to request reviews through difit after changes. Do not use it for ordinary requests to review code, diffs, commits, branches, or pull requests.
---

# Difit

## When to Use This Skill

difit opens an external browser UI and starts a long-running local server, so launching it must be explicit opt-in:

- Use this skill only when the user explicitly names difit, asks to open or show the diff in a viewer, or has a standing instruction (for example in project docs or agent configuration) to request reviews through difit after code changes.
- Do NOT use it for ordinary review requests such as "review these changes", "use the reviewer agent", "find problems in this diff", or "review this PR/commit/branch". Answer those through your normal response channel.
- When a request is ambiguous, prefer the non-difit path.

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

## Reusing a Running Server

Keep at most one live difit server per Git root and review target. When you edit again after starting a review, reuse the running server instead of launching another one — repeated launches create duplicate ports and browser tabs.

- Before starting difit, check whether a difit server you started earlier is still running for the same Git root (for example, the background process you launched is still alive).
- If one is running for the same target, do not start another and do not reopen its URL. For working-tree targets (`.`, `working`, `staged`, and the HEAD default) difit watches the repository, and the open page prompts the user to reload when the diff changes.
- If review rounds are expected to repeat, start the server with `--keep-alive` (the server survives browser disconnects) or `--background` (a detached keep-alive server; prints JSON like `{"port":4966,"url":"http://localhost:4966","pid":123}` and does not auto-open a browser, so share the URL with the user once).
- While the server stays alive, exchange feedback without restarting it:
  - `<difit-command> comment get --port <port>` — read the user's review comments (`--format json` for structured output).
  - `<difit-command> comment add --port <port> '<json>'` — add new comments to the running server (same JSON shape as `--comment`).
  - `<difit-command> comment resolve <threadId...> --port <port>` — resolve threads you have addressed.
- If the review target changes (for example, a different commit range), stop the existing server and start a new one rather than leaving two servers for the same repository.

## Constraints

Can only be used inside a Git-managed directory.
