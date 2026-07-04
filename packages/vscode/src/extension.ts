import { type ChildProcess, fork, spawn } from 'node:child_process';

import * as vscode from 'vscode';

import { type DiffSelection } from '../../../src/types/diff.js';
import { DiffMode } from '../../../src/types/watch.js';
import { createDiffSelection, getDiffSelectionKey } from '../../../src/utils/diffSelection.js';

const OPEN_REVIEW_COMMAND = 'difit.openReview';
const STOP_REVIEW_COMMAND = 'difit.stopReview';
const STARTUP_TIMEOUT_MS = 30_000;
const SERVER_URL_PATTERN = /difit server started on (https?:\/\/\S+)/i;

interface ReviewTarget {
  selection: DiffSelection;
  diffMode: DiffMode;
  /** Positional argument used when launching an external difit CLI. */
  cliArg: string;
}

interface Session {
  readonly child: ChildProcess;
  readonly selectionKey: string;
  readonly url: Promise<string>;
}

const sessions = new Map<string, Session>();
let extensionContext: vscode.ExtensionContext | undefined;
let outputChannel: vscode.OutputChannel | undefined;

export function activate(context: vscode.ExtensionContext): void {
  extensionContext = context;
  context.subscriptions.push(getOutputChannel());

  context.subscriptions.push(
    vscode.commands.registerCommand(OPEN_REVIEW_COMMAND, () => {
      void openReview();
    }),
    vscode.commands.registerCommand(STOP_REVIEW_COMMAND, () => {
      stopReview();
    }),
  );

  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.name = 'difit';
  statusBarItem.text = '$(git-compare) difit';
  statusBarItem.tooltip = 'Open difit review in VS Code';
  statusBarItem.command = OPEN_REVIEW_COMMAND;
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);
}

export function deactivate(): void {
  for (const session of sessions.values()) {
    stopSession(session);
  }
  sessions.clear();
}

async function openReview(): Promise<void> {
  const workspaceFolder = resolveTargetWorkspaceFolder();
  if (!workspaceFolder) {
    void vscode.window.showErrorMessage('difit: Open a workspace folder first.');
    return;
  }

  let repoRoot: string;
  try {
    repoRoot = (await runGit(workspaceFolder.uri.fsPath, ['rev-parse', '--show-toplevel'])).trim();
  } catch {
    void vscode.window.showErrorMessage(
      `difit: "${workspaceFolder.name}" is not inside a Git repository.`,
    );
    return;
  }

  const target = await resolveReviewTarget(repoRoot);
  const selectionKey = getDiffSelectionKey(target.selection);

  const existing = sessions.get(repoRoot);
  if (existing && isProcessAlive(existing.child)) {
    if (existing.selectionKey === selectionKey) {
      try {
        await openInBrowser(await existing.url);
        return;
      } catch {
        // Fall through and restart the session.
      }
    }
    // The repository state changed (e.g. changes were committed) or the
    // session is broken; restart with the new selection.
    stopSession(existing);
  }
  sessions.delete(repoRoot);

  try {
    const url = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Window, title: 'Starting difit...' },
      () => startSession(repoRoot, target),
    );
    await openInBrowser(url);
  } catch (error) {
    sessions.delete(repoRoot);
    const message = error instanceof Error ? error.message : String(error);
    void vscode.window.showErrorMessage(`difit: ${message}`);
  }
}

function stopReview(): void {
  if (sessions.size === 0) {
    void vscode.window.showInformationMessage('difit: No running review server.');
    return;
  }

  for (const session of sessions.values()) {
    stopSession(session);
  }
  sessions.clear();
  void vscode.window.showInformationMessage('difit: Stopped all running review servers.');
}

/**
 * Review uncommitted changes when there are any (like `difit .`), otherwise
 * review the latest commit (like `difit HEAD`).
 */
async function resolveReviewTarget(repoRoot: string): Promise<ReviewTarget> {
  const status = await runGit(repoRoot, ['status', '--porcelain']).catch(() => '');
  // Untracked files are excluded: including them requires `git add
  // --intent-to-add`, which mutates the user's repository state.
  const hasTrackedChanges = status
    .split('\n')
    .some((line) => line.trim().length > 0 && !line.startsWith('??'));

  if (hasTrackedChanges) {
    return {
      selection: createDiffSelection('HEAD', '.'),
      diffMode: DiffMode.DOT,
      cliArg: '.',
    };
  }

  return {
    selection: createDiffSelection('HEAD^', 'HEAD'),
    diffMode: DiffMode.DEFAULT,
    cliArg: 'HEAD',
  };
}

function startSession(repoRoot: string, target: ReviewTarget): Promise<string> {
  const externalPath = getConfiguredExecutablePath();
  const child = externalPath
    ? spawnExternal(externalPath, repoRoot, target)
    : forkBundled(repoRoot, target);

  const url = waitForStartup(child, repoRoot);
  const session: Session = {
    child,
    selectionKey: getDiffSelectionKey(target.selection),
    url,
  };
  sessions.set(repoRoot, session);

  child.once('exit', (code, signal) => {
    getOutputChannel().appendLine(
      `[${repoRoot}] server exited (code: ${String(code)}, signal: ${String(signal)})`,
    );
    if (sessions.get(repoRoot)?.child === child) {
      sessions.delete(repoRoot);
    }
  });

  return url;
}

function forkBundled(repoRoot: string, target: ReviewTarget): ChildProcess {
  const context = extensionContext;
  if (!context) {
    throw new Error('Extension is not activated.');
  }

  const serverModule = context.asAbsolutePath('dist/server/index.js');
  const request = {
    selection: target.selection,
    diffMode: target.diffMode,
    repoPath: repoRoot,
  };

  getOutputChannel().appendLine(
    `[${repoRoot}] starting bundled difit (reviewing ${target.cliArg})`,
  );

  return fork(serverModule, [JSON.stringify(request)], {
    cwd: repoRoot,
    silent: true,
    // Never inherit the extension host's execArgv (e.g. --inspect), which
    // would make the child fight over the debug port.
    execArgv: [],
    env: { ...process.env, NODE_ENV: 'production' },
  });
}

function spawnExternal(
  executablePath: string,
  repoRoot: string,
  target: ReviewTarget,
): ChildProcess {
  const args = [target.cliArg, '--no-open', '--keep-alive'];
  getOutputChannel().appendLine(
    `[${repoRoot}] starting external difit: ${executablePath} ${args.join(' ')}`,
  );

  return spawn(executablePath, args, {
    cwd: repoRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function waitForStartup(child: ChildProcess, repoRoot: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let settled = false;

    const settle = (fn: () => void): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeoutHandle);
      fn();
    };

    const timeoutHandle = setTimeout(() => {
      settle(() => {
        child.kill();
        reject(new Error('Timed out waiting for the difit server to start.'));
      });
    }, STARTUP_TIMEOUT_MS);

    // The bundled server reports readiness over the fork IPC channel.
    child.on('message', (message: unknown) => {
      const payload = message as {
        type?: string;
        url?: string;
        message?: string;
      };
      if (payload.type === 'ready' && typeof payload.url === 'string') {
        const url = payload.url;
        settle(() => {
          resolve(url);
        });
      } else if (payload.type === 'error') {
        settle(() => {
          reject(new Error(payload.message ?? 'difit failed to start.'));
        });
      }
    });

    // An external difit CLI reports its URL on stdout instead.
    const handleOutput = (data: Buffer): void => {
      const text = data.toString();
      appendServerOutput(repoRoot, text);
      const matchedUrl = text.match(SERVER_URL_PATTERN)?.[1];
      if (matchedUrl) {
        settle(() => {
          resolve(matchedUrl);
        });
      }
    };
    child.stdout?.on('data', handleOutput);
    child.stderr?.on('data', handleOutput);

    child.once('error', (error) => {
      settle(() => {
        const hint =
          (error as NodeJS.ErrnoException).code === 'ENOENT'
            ? ' Check the "difit.executablePath" setting.'
            : '';
        reject(new Error(`Failed to launch difit: ${error.message}.${hint}`));
      });
    });

    child.once('exit', (code, signal) => {
      settle(() => {
        reject(
          new Error(
            `difit exited before startup (code: ${String(code)}, signal: ${String(signal)}).`,
          ),
        );
      });
    });
  });
}

function stopSession(session: Session): void {
  if (!isProcessAlive(session.child)) {
    return;
  }
  session.child.kill();
}

function isProcessAlive(child: ChildProcess): boolean {
  return child.exitCode === null && child.signalCode === null && !child.killed;
}

async function openInBrowser(url: string): Promise<void> {
  try {
    await vscode.commands.executeCommand('simpleBrowser.api.open', vscode.Uri.parse(url), {
      viewColumn: vscode.ViewColumn.Beside,
      preserveFocus: false,
    });
  } catch {
    // Simple Browser is unavailable (disabled built-in); open externally.
    await vscode.env.openExternal(vscode.Uri.parse(url));
  }
}

function resolveTargetWorkspaceFolder(): vscode.WorkspaceFolder | undefined {
  const activeUri = vscode.window.activeTextEditor?.document.uri;
  if (activeUri) {
    const folderFromActiveEditor = vscode.workspace.getWorkspaceFolder(activeUri);
    if (folderFromActiveEditor) {
      return folderFromActiveEditor;
    }
  }

  return vscode.workspace.workspaceFolders?.[0];
}

function getConfiguredExecutablePath(): string {
  return vscode.workspace.getConfiguration('difit').get<string>('executablePath', '').trim();
}

async function runGit(cwd: string, args: readonly string[]): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const child = spawn('git', [...args], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });
    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(
          new Error(stderr.trim() || `git ${args.join(' ')} exited with code ${String(code)}`),
        );
      }
    });
  });
}

function appendServerOutput(repoRoot: string, output: string): void {
  const channel = getOutputChannel();
  for (const line of output.split(/\r?\n/u)) {
    if (line.trim()) {
      channel.appendLine(`[${repoRoot}] ${line}`);
    }
  }
}

function getOutputChannel(): vscode.OutputChannel {
  outputChannel ??= vscode.window.createOutputChannel('difit');
  return outputChannel;
}
