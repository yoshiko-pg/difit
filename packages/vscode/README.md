# difit VS Code Extension

Launch `difit` with one click and render the local difit URL inside a VS Code tab via Simple Browser.

difit: https://github.com/yoshiko-pg/difit

## Features

- Top-right editor toolbar button (icon) to open review.
- Status bar button (`difit`) to open review.
- Command palette entries:
  - `difit: Open Review`
  - `difit: Stop Review`
- Reuses an existing difit process per workspace.
- If `difit` is missing, prompts and runs the install command in the integrated terminal.

## Settings

- `difit.executablePath` (default: `difit`)
- `difit.installCommand` (default: `npm install -g difit`)

## Build VSIX locally

From repository root:

```bash
pnpm install
pnpm --dir packages/vscode run package
```

Then install the generated `.vsix` file from VS Code:

1. Open Extensions view.
2. Click `...` (More Actions).
3. Choose `Install from VSIX...`.
4. Select `packages/vscode/difit-vscode-<version>.vsix`.
