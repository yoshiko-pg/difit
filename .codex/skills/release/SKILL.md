---
name: release
description: Execute the difit release workflow when the user says "リリース" or asks to cut a release. Update CHANGELOG Unreleased from commits since latest tag, ask for explicit OK confirmation in Japanese, then release using the confirmed Unreleased section as the exact source of truth.
---

# Release Workflow

Follow this workflow for the current repository.

## Prepare changelog draft

1. Run `./scripts/get-changes-since-tag.sh`.
2. Categorize changes into these sections as needed: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`, `Thanks`.
3. Use script output rules:
   - Use GitHub username from script output.
   - Exclude `yoshiko-pg` and `renovate[bot]` from `Thanks`.
   - Include PR numbers when available.
   - Use commit subject and body for categorization.
4. Write the categorized content into `CHANGELOG.md` under `## [Unreleased]`.
5. Ask for user confirmation in Japanese.

## Release after explicit OK

Treat the `Unreleased` section at OK time as the single source of truth. Do not regenerate or overwrite that content.

1. Run `npm version --no-git-tag-version patch`.
2. Move current `Unreleased` content into a new version section with today's date.
3. Update bottom links:
   - Update `Unreleased` compare link to new version tag.
   - Add compare link for the new version.
4. Commit `CHANGELOG.md` and `package.json` with an English message: `chore: release vX.Y.Z`.
5. Create tag `vX.Y.Z`.
6. Push `main` and tags: `git push origin main --tags`.
7. If push is rejected by non-fast-forward:
   - Run `git pull --rebase origin main`.
   - Retry `git push origin main --tags`.
8. Build release notes from the new version section text in `CHANGELOG.md`.
9. Create GitHub release on origin:
   - `gh release create vX.Y.Z --title "vX.Y.Z" --notes-file <notes-file>`

## Output to user

- Respond in Japanese.
- Report updated files, created tag, and GitHub release URL.
- Mention if any recovery step was required (for example, rebase due to non-fast-forward).
