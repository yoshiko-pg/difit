# difit for VS Code

Review your Git changes in a GitHub-like diff viewer, right inside VS Code.

[difit](https://github.com/yoshiko-pg/difit) is bundled with this extension — no separate install, no PATH setup, no Node version manager headaches. The server runs on the Node.js runtime that ships with VS Code.

## Usage

- Click the **difit** status bar item (or the icon in the editor title), or run **difit: Open Review** from the command palette.
- With uncommitted changes, it reviews them (like `difit .`). With a clean working tree, it reviews the latest commit (like `difit HEAD`).
- The review opens beside your editor in the built-in Simple Browser. Comments, viewed-state, and live reload work just like the difit CLI.
- Run **difit: Stop Review** to shut the server down. It also stops automatically when VS Code exits.

## Settings

| Setting                | Description                                                                                                                                                             |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `difit.executablePath` | Optional path to an external `difit` executable. Leave empty (default) to use the bundled difit. Set this if you want to run a newer or local build of the CLI instead. |

## How it works

The extension forks the bundled difit server with VS Code's own Node.js runtime and talks to it over IPC, so it works regardless of your shell or Node setup. Native file-watcher binaries for all supported platforms are included; on an unsupported platform difit still works, just without live reload.

## Development

```bash
# from the repository root
pnpm install
pnpm run build              # builds the difit client assets into dist/client
pnpm -C packages/vscode run build     # bundles the extension into packages/vscode/dist
pnpm -C packages/vscode run package   # produces the .vsix
```
