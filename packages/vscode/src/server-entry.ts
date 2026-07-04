import { startServer } from '../../../src/server/server.js';
import { type DiffSelection } from '../../../src/types/diff.js';
import { type DiffMode } from '../../../src/types/watch.js';

interface LaunchRequest {
  selection: DiffSelection;
  diffMode: DiffMode;
  repoPath: string;
}

// The extension host owns this process through the IPC channel; exit when it
// goes away so no orphan servers are left behind.
process.on('disconnect', () => {
  process.exit(0);
});

async function main(): Promise<void> {
  const raw = process.argv[2];
  if (!raw) {
    throw new Error('Missing launch request argument');
  }

  const request = JSON.parse(raw) as LaunchRequest;

  const { url, port, isEmpty } = await startServer({
    selection: request.selection,
    diffMode: request.diffMode,
    repoPath: request.repoPath,
    openBrowser: false,
    keepAlive: true,
  });

  process.send?.({ type: 'ready', url, port, isEmpty });
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.send?.({ type: 'error', message });
  console.error(`difit server failed to start: ${message}`);
  process.exit(1);
});
