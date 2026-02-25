---
name: difit-dev
description: After completing the requested implementation, use the difit dev command to ask the user for a code review.
---

Use this skill to request a code review from the user through difit's dev command.
If the user leaves review comments, they are printed to stdout when the difit command exits.
When review comments are returned, continue work and address them.
If the server is shut down without comments, treat it as "no review comments were provided."

## Commands

- Review the HEAD commit: `pnpm run dev`
- Review uncommitted changes before commit: `pnpm run dev .`
