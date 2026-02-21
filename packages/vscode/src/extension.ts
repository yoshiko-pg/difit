import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';

import * as vscode from 'vscode';

const OPEN_REVIEW_COMMAND = 'difit.openReview';
const STOP_REVIEW_COMMAND = 'difit.stopReview';
const SERVER_URL_PATTERN = /difit server started on (https?:\/\/\S+)/i;
const STARTUP_TIMEOUT_MS = 20_000;
const INSTALL_ACTION_LABEL = 'Install';

type DifitSession = {
  readonly process: ChildProcessWithoutNullStreams;
  readonly workspaceFolder: vscode.WorkspaceFolder;
  readonly difitArgs: readonly string[];
  startupPromise: Promise<string>;
  url?: string;
};

const sessions = new Map<string, DifitSession>();
let outputChannel: vscode.OutputChannel | undefined;

export function activate(context: vscode.ExtensionContext): void {
  outputChannel = vscode.window.createOutputChannel('difit');
  context.subscriptions.push(outputChannel);

  context.subscriptions.push(
    vscode.commands.registerCommand(OPEN_REVIEW_COMMAND, () => {
      void openReview();
    }),
  );

  context.subscriptions.push(
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

  const key = workspaceKey(workspaceFolder);
  const existingSession = sessions.get(key);

  if (existingSession && isProcessAlive(existingSession.process)) {
    try {
      const url = existingSession.url ?? (await existingSession.startupPromise);
      await openInSimpleBrowser(url);
    } catch (error) {
      sessions.delete(key);
      const message = error instanceof Error ? error.message : 'Unknown error';
      void vscode.window.showErrorMessage(`difit: ${message}`);
    }
    return;
  }

  sessions.delete(key);

  const executablePath = getExecutablePath();
  const availability = await checkDifitExecutable(executablePath);

  if (availability === 'missing') {
    await promptInstallFlow(getInstallCommand());
    return;
  }

  if (availability === 'error') {
    void vscode.window.showErrorMessage(
      `difit: Failed to run '${executablePath} --version'. Check "difit.executablePath".`,
    );
    return;
  }

  const difitArgs = await resolveDifitLaunchArgs(workspaceFolder);
  const session = createSession(workspaceFolder, executablePath, difitArgs);
  sessions.set(key, session);

  try {
    const url = await session.startupPromise;
    await openInSimpleBrowser(url);
  } catch (error) {
    sessions.delete(key);
    const message = error instanceof Error ? error.message : 'Unknown error';
    void vscode.window.showErrorMessage(`difit: ${message}`);
  }
}

function stopReview(): void {
  const workspaceFolder = resolveTargetWorkspaceFolder();
  if (workspaceFolder) {
    const key = workspaceKey(workspaceFolder);
    const session = sessions.get(key);
    if (session) {
      stopSession(session);
      sessions.delete(key);
      void vscode.window.showInformationMessage(
        `difit: Stopped review server for ${workspaceFolder.name}.`,
      );
      return;
    }
  }

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

function stopSession(session: DifitSession): void {
  if (!isProcessAlive(session.process)) {
    return;
  }

  const stoppedWithSigInt = session.process.kill('SIGINT');
  if (!stoppedWithSigInt) {
    session.process.kill();
  }
}

function createSession(
  workspaceFolder: vscode.WorkspaceFolder,
  executablePath: string,
  difitArgs: readonly string[],
): DifitSession {
  const channel = getOutputChannel();

  const child = spawn(executablePath, [...difitArgs], {
    cwd: workspaceFolder.uri.fsPath,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  channel.appendLine(
    `[${workspaceFolder.name}] starting: ${executablePath} ${difitArgs.join(' ')} (cwd: ${workspaceFolder.uri.fsPath})`,
  );

  const session: DifitSession = {
    process: child,
    workspaceFolder,
    difitArgs,
    startupPromise: Promise.resolve(''),
  };

  let settled = false;
  let timeoutHandle: NodeJS.Timeout | undefined;

  const settleResolve = (url: string, resolve: (value: string) => void): void => {
    if (settled) {
      return;
    }

    settled = true;
    session.url = url;
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
    resolve(url);
  };

  const settleReject = (error: Error, reject: (reason: Error) => void): void => {
    if (settled) {
      return;
    }

    settled = true;
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
    reject(error);
  };

  session.startupPromise = new Promise<string>((resolve, reject) => {
    const handleOutput = (source: 'stdout' | 'stderr', data: Buffer): void => {
      const text = data.toString();
      appendOutput(channel, workspaceFolder.name, source, text);

      const matchedUrl = extractServerUrl(text);
      if (matchedUrl) {
        settleResolve(matchedUrl, resolve);
      }
    };

    child.stdout.on('data', (data: Buffer) => {
      handleOutput('stdout', data);
    });

    child.stderr.on('data', (data: Buffer) => {
      handleOutput('stderr', data);
    });

    child.once('error', (error) => {
      appendOutput(channel, workspaceFolder.name, 'stderr', String(error));
      settleReject(
        new Error(
          `Failed to start difit in ${workspaceFolder.name}: ${error.message || String(error)}`,
        ),
        reject,
      );
    });

    child.once('close', (code, signal) => {
      channel.appendLine(
        `[${workspaceFolder.name}] process exited (code: ${String(code)}, signal: ${String(signal)})`,
      );

      const key = workspaceKey(workspaceFolder);
      const current = sessions.get(key);
      if (current?.process === child) {
        sessions.delete(key);
      }

      if (!settled) {
        settleReject(
          new Error(
            `difit exited before startup in ${workspaceFolder.name} (code: ${String(code)}, signal: ${String(signal)})`,
          ),
          reject,
        );
      }
    });

    timeoutHandle = setTimeout(() => {
      settleReject(
        new Error(`Timed out waiting for difit startup in ${workspaceFolder.name}.`),
        reject,
      );
    }, STARTUP_TIMEOUT_MS);
  });

  return session;
}

function appendOutput(
  channel: vscode.OutputChannel,
  workspaceName: string,
  source: 'stdout' | 'stderr',
  output: string,
): void {
  const lines = output.split(/\r?\n/u);
  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }
    channel.appendLine(`[${workspaceName}] ${source}: ${line}`);
  }
}

function extractServerUrl(output: string): string | undefined {
  const match = output.match(SERVER_URL_PATTERN);
  return match?.[1];
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

function workspaceKey(workspaceFolder: vscode.WorkspaceFolder): string {
  return workspaceFolder.uri.toString();
}

function isProcessAlive(process: ChildProcessWithoutNullStreams): boolean {
  return process.exitCode === null && !process.killed;
}

async function openInSimpleBrowser(url: string): Promise<void> {
  try {
    await vscode.commands.executeCommand('simpleBrowser.api.open', vscode.Uri.parse(url), {
      viewColumn: vscode.ViewColumn.Beside,
      preserveFocus: false,
    });
  } catch {
    void vscode.window.showErrorMessage(
      `difit: Failed to open URL in Simple Browser. Install/enable the built-in Simple Browser extension. URL: ${url}`,
    );
  }
}

type ExecutableAvailability = 'available' | 'missing' | 'error';

async function resolveDifitLaunchArgs(
  workspaceFolder: vscode.WorkspaceFolder,
): Promise<readonly string[]> {
  const hasUncommittedChanges = await detectUncommittedChanges(workspaceFolder);
  return hasUncommittedChanges ? ['.', '--no-open'] : ['HEAD', '--no-open'];
}

async function detectUncommittedChanges(workspaceFolder: vscode.WorkspaceFolder): Promise<boolean> {
  return await new Promise<boolean>((resolve) => {
    const gitStatus = spawn('git', ['status', '--porcelain'], {
      cwd: workspaceFolder.uri.fsPath,
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    let output = '';
    gitStatus.stdout.on('data', (data: Buffer) => {
      output += data.toString();
    });

    gitStatus.once('error', () => {
      resolve(false);
    });

    gitStatus.once('close', (code) => {
      if (code !== 0) {
        resolve(false);
        return;
      }
      resolve(output.trim().length > 0);
    });
  });
}

async function checkDifitExecutable(executablePath: string): Promise<ExecutableAvailability> {
  return await new Promise<ExecutableAvailability>((resolve) => {
    const probe = spawn(executablePath, ['--version'], {
      stdio: 'ignore',
    });

    let settled = false;

    const settle = (value: ExecutableAvailability): void => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(value);
    };

    probe.once('error', (error) => {
      const errNoException = error as NodeJS.ErrnoException;
      if (errNoException.code === 'ENOENT') {
        settle('missing');
        return;
      }
      settle('error');
    });

    probe.once('exit', (code) => {
      settle(code === 0 ? 'available' : 'error');
    });
  });
}

async function promptInstallFlow(installCommand: string): Promise<void> {
  const action = await vscode.window.showInformationMessage(
    'difit command was not found. Install it globally?',
    {
      modal: true,
      detail: `The following command will run in VS Code terminal:\n${installCommand}`,
    },
    INSTALL_ACTION_LABEL,
  );

  if (action !== INSTALL_ACTION_LABEL) {
    return;
  }

  const terminal = vscode.window.createTerminal({ name: 'difit setup' });
  terminal.show(true);
  terminal.sendText(installCommand, true);
  void vscode.window.showInformationMessage(
    'difit install command was sent to the terminal. Run "difit: Open Review" again after install finishes.',
  );
}

function getExecutablePath(): string {
  const configured = vscode.workspace
    .getConfiguration('difit')
    .get<string>('executablePath', 'difit');
  const normalized = configured.trim();
  return normalized.length > 0 ? normalized : 'difit';
}

function getInstallCommand(): string {
  const configured = vscode.workspace
    .getConfiguration('difit')
    .get<string>('installCommand', 'npm install -g difit');
  const normalized = configured.trim();
  return normalized.length > 0 ? normalized : 'npm install -g difit';
}

function getOutputChannel(): vscode.OutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel('difit');
  }
  return outputChannel;
}
