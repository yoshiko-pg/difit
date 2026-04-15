import { Command, Option } from 'commander';

import { parseCommentImportValue } from '../utils/commentImports.js';

import { readStdin } from './utils.js';

export function createCommentCommand(): Command {
  const comment = new Command('comment').description(
    'Add or retrieve comments on a running difit server',
  );

  comment
    .command('add')
    .description('Add comments to a running difit server')
    .argument('[json]', 'comment import JSON (object or array)')
    .requiredOption('--port <port>', 'port of the running difit server', parseInt)
    .action(async (json: string | undefined, opts: { port: number }) => {
      try {
        const input = json ?? (await readStdin());
        if (!input.trim()) {
          console.error('Error: No comment data provided. Pass JSON as argument or via stdin.');
          process.exit(1);
        }

        const imports = parseCommentImportValue(input);

        const response = await fetch(`http://localhost:${opts.port}/api/comment-imports`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(imports),
        });

        if (!response.ok) {
          const error = (await response.json()) as { error?: string };
          console.error(`Error: ${error.error ?? 'Failed to add comments'}`);
          process.exit(1);
        }

        const result = (await response.json()) as {
          success: boolean;
          importId: string;
          count: number;
        };
        console.log(
          JSON.stringify({
            success: result.success,
            importId: result.importId,
            count: result.count,
          }),
        );
      } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch failed')) {
          console.error(
            `Error: Cannot connect to difit server on port ${opts.port}. Is the server running?`,
          );
        } else {
          console.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        process.exit(1);
      }
    });

  comment
    .command('get')
    .description('Retrieve comments from a running difit server')
    .requiredOption('--port <port>', 'port of the running difit server', parseInt)
    .addOption(
      new Option('--format <format>', 'output format').choices(['text', 'json']).default('text'),
    )
    .action(async (opts: { port: number; format: string }) => {
      try {
        const endpoint = opts.format === 'json' ? '/api/comments-json' : '/api/comments-output';
        const response = await fetch(`http://localhost:${opts.port}${endpoint}`);

        if (!response.ok) {
          console.error('Error: Failed to retrieve comments');
          process.exit(1);
        }

        if (opts.format === 'json') {
          const data: unknown = await response.json();
          console.log(JSON.stringify(data));
        } else {
          const text = await response.text();
          if (text.trim()) {
            console.log(text);
          }
        }
      } catch {
        console.error(
          `Error: Cannot connect to difit server on port ${opts.port}. Is the server running?`,
        );
        process.exit(1);
      }
    });

  return comment;
}
