# difit VS Code Extension

Open difit with one click and render it in a VS Code tab using Simple Browser.

- Project: https://github.com/yoshiko-pg/difit

## Requirements

- VS Code `^1.98.0`
- `difit` CLI installed on your machine (or install from the extension prompt)

## What It Does

- Adds `difit: Open Review` and `difit: Stop Review` commands.
- Shows an editor title button (top-right icon) for quick open.
- Shows a status bar button (`difit`) for quick open.
- Reuses a running difit process per workspace.
- Chooses launch args automatically:
  - with uncommitted changes: `difit . --no-open`
  - without uncommitted changes: `difit HEAD --no-open`
- Opens the URL in a VS Code tab via `simpleBrowser.api.open`.
- Writes runtime logs to Output channel `difit`.

## Settings

- `difit.executablePath` (default: `difit`)
- `difit.installCommand` (default: `npm install -g difit`)

## Build VSIX Locally

From repository root:

```bash
pnpm install
pnpm run package:vscode
```

Alternative (inside package directory):

```bash
pnpm run package
```

Generated file:

- `packages/vscode/difit-vscode-<version>.vsix`

## Install VSIX

1. Open Extensions view.
2. Click `...` (More Actions).
3. Choose `Install from VSIX...`.
4. Select `packages/vscode/difit-vscode-<version>.vsix`.
5. Run `Developer: Reload Window`.

## Troubleshooting

- Error `code: 127` on startup:
  - Usually means environment PATH mismatch for child processes.
  - The extension retries with a login shell and injects extension-host Node path.
  - If it still fails, check Output channel `difit`.
- `difit` not found:
  - Confirm `difit.executablePath`.
  - Or install with `difit.installCommand`.
