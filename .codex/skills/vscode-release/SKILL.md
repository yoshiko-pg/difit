---
name: vscode-release
description: Execute the VS Code extension release workflow when the user asks to publish/release the difit VS Code extension. Run local VSIX build and smoke verification first, ask for explicit OK in Japanese, then publish with vsce.
---

# VS Code Extension Release Workflow

Follow this workflow for the current repository.

## Prepare local build verification

1. Verify release target files in `packages/vscode` and confirm current branch state.
2. Run `pnpm install --frozen-lockfile`.
3. Run `pnpm -C packages/vscode run package`.
4. Read `packages/vscode/package.json` and confirm the current extension version.
5. Confirm the VSIX exists at `packages/vscode/difit-vscode-<version>.vsix`.
6. Ask the user to smoke test the local VSIX install in VS Code:
   - Install from VSIX.
   - Confirm the `difit` command opens review correctly.
   - Confirm the toolbar button/icon appears and works.
7. Ask for explicit OK in Japanese before publishing.

## Release after explicit OK

Treat the locally verified build result at OK time as the source of truth. Do not skip rebuilding after version changes.

1. Bump extension version in `packages/vscode/package.json`:
   - `pnpm -C packages/vscode version patch --no-git-tag-version`
2. Re-run `pnpm -C packages/vscode run package` and confirm the new VSIX filename.
3. Commit `packages/vscode/package.json` with an English message: `chore(vscode): release vX.Y.Z`.
4. Create tag `vscode-vX.Y.Z`.
5. Push `main` and tags: `git push origin main --tags`.
6. If push is rejected by non-fast-forward:
   - Run `git pull --rebase origin main`.
   - Retry `git push origin main --tags`.
7. Publish to Visual Studio Marketplace:
   - `pnpm -C packages/vscode exec vsce publish`
   - Use the already bumped version from `packages/vscode/package.json`.

## Output to user

- Respond in Japanese.
- Report local build verification result, released version, created tag, and publish result.
- Mention if any recovery step was required (for example, rebase due to non-fast-forward).
