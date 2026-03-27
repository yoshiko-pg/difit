---
name: difit-review
description: A skill for reviewing a specific diff and showing the findings as comments inside difit (the diff viewer). Use it to review branch diffs, commit diffs, or GitHub PRs, then preload findings or code explanations into difit with `--comment` before launching it for the user.
metadata:
  internal: true
---

# Difit Review

## Overview

This skill launches a requested git diff in a viewer that is easy for humans to read. At the same time, the agent can attach arbitrary comments via the `--comment` option.
This comment mechanism is well suited for code review findings and code explanations.

In this local repository copy, use `pnpm run dev` instead of the installed `difit` command.

## Steps

The final command typically looks like this:

```bash
pnpm run dev <target> [compare-with] \
  --comment '{"type":"thread","filePath":"src/foobar.ts","position":{"side":"old","line":102},"body":"line 1\nline 2"}' \
  --comment '{"type":"thread","filePath":"src/example.ts","position":{"side":"new","line":{"start":36,"end":39}},"body":"Range comment for L36-L39"}'
```

The detailed procedure is as follows.

1. Identify the target diff and review its contents.

- Inspect the diff specified by the user. This may be a local git revision, a GitHub URL, a patch file, or something similar.
- Understand the diff normally, inspect surrounding code when needed, and think through the response required by the user's request, whether that is review findings, explanations, or something else.
- For PR reviews, inspect the PR locally and keep the review result limited to difit output. Do not post comments back to remote GitHub.

2. Attach the prepared comments and launch difit.

- **pnpm run dev launch options**
  - Use `pnpm run dev <target> [compare-with]` to specify the target diff.
  - Do not insert `--` after `pnpm run dev` in this repository. `pnpm run dev -- ...` breaks argument parsing here.
  - For uncommitted changes use `pnpm run dev .`, for working tree changes use `pnpm run dev working`, and for staged changes use `pnpm run dev staging`.
  - For PRs use `pnpm run dev --pr <URL>`. For stdin input, use a form such as `diff -u file1.txt file2.txt | pnpm run dev`.
- **Comment arguments**
  - Use `type: "thread"` for each comment.
  - Use `position.side: "new"` for lines that exist on the target side of the diff.
  - Use `position.side: "old"` for lines that exist only on the deleted side.
  - Use range comments for issues that span multiple lines.
- **Additional argument for files not yet added to git**
  - For uncommitted changes, if you decide files not yet added to git should also appear in the diff, add `--include-untracked`.

3. Share the difit URL and finish the response.
   - If there were no comments to attach, explicitly say so.
   - No manual verification of the launched difit page is required.
