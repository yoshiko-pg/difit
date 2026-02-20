#!/usr/bin/env node

import { Command } from 'commander';
import React from 'react';
import { simpleGit, type SimpleGit } from 'simple-git';

import pkg from '../../package.json' with { type: 'json' };
import { startServer } from '../server/server.js';
import { type DiffViewMode } from '../types/diff.js';
import { DiffMode } from '../types/watch.js';
import { DEFAULT_DIFF_VIEW_MODE, normalizeDiffViewMode } from '../utils/diffMode.js';

import {
  shouldReadStdin,
  findUntrackedFiles,
  markFilesIntentToAdd,
  promptUser,
  validateDiffArguments,
  getPrPatch,
  getGitRoot,
} from './utils.js';

type SpecialArg = 'working' | 'staged' | '.';

function isSpecialArg(arg: string): arg is SpecialArg {
  return arg === 'working' || arg === 'staged' || arg === '.';
}

function determineDiffMode(targetCommitish: string, compareWith?: string): DiffMode {
  // If comparing specific commits/branches (not involving HEAD), no watching needed
  // Exception: allow watching when targetCommitish is '.' even with compareWith
  if (compareWith && targetCommitish !== 'HEAD' && targetCommitish !== '.') {
    return DiffMode.SPECIFIC;
  }

  if (targetCommitish === 'working') {
    return DiffMode.WORKING;
  }

  if (targetCommitish === 'staged') {
    return DiffMode.STAGED;
  }

  if (targetCommitish === '.') {
    return DiffMode.DOT;
  }
  // Default mode: HEAD^ vs HEAD or HEAD vs other commits (watch for HEAD changes)
  return DiffMode.DEFAULT;
}

interface CliOptions {
  port?: number;
  host?: string;
  open: boolean;
  mode: DiffViewMode;
  tui?: boolean;
  pr?: string;
  clean?: boolean;
  includeUntracked?: boolean;
  keepAlive?: boolean;
}

const program = new Command();

program
  .name('difit')
  .description('A lightweight Git diff viewer with GitHub-like interface')
  .version(pkg.version)
  .argument(
    '[commit-ish]',
    'Git commit, tag, branch, HEAD~n reference, or "working"/"staged"/"."',
    'HEAD',
  )
  .argument(
    '[compare-with]',
    'Optional: Compare with this commit/branch (shows diff between commit-ish and compare-with)',
  )
  .option('--port <port>', 'preferred port (auto-assigned if occupied)', parseInt)
  .option('--host <host>', 'host address to bind', '')
  .option('--no-open', 'do not automatically open browser')
  .option(
    '--mode <mode>',
    'diff mode (split or unified)',
    normalizeDiffViewMode,
    DEFAULT_DIFF_VIEW_MODE,
  )
  .option('--tui', 'use terminal UI instead of web interface')
  .option('--pr <url>', 'GitHub PR URL to review (e.g., https://github.com/owner/repo/pull/123)')
  .option('--clean', 'start with a clean slate by clearing all existing comments')
  .option('--include-untracked', 'automatically include untracked files in diff')
  .option('--keep-alive', 'keep server running even after browser disconnects')
  .action(async (commitish: string, compareWith: string | undefined, options: CliOptions) => {
    try {
      // Check if we should read from stdin
      const readFromStdin = shouldReadStdin({
        commitish,
        hasPositionalArgs: program.args.length > 0,
        hasPrOption: Boolean(options.pr),
        hasTuiOption: Boolean(options.tui),
      });

      if (readFromStdin) {
        // Read unified diff from stdin
        const diffContent = await readStdin();
        if (!diffContent.trim()) {
          console.error('Error: No diff content received from stdin');
          process.exit(1);
        }

        // Start server with stdin diff
        const { url } = await startServer({
          stdinDiff: diffContent,
          preferredPort: options.port,
          host: options.host,
          openBrowser: options.open,
          mode: options.mode,
          clearComments: options.clean,
          keepAlive: options.keepAlive,
        });

        console.log(`\n🚀 difit server started on ${url}`);
        console.log(`📋 Reviewing: diff from stdin`);
        if (options.keepAlive) {
          console.log('🔒 Keep-alive mode: server will stay running after browser disconnects');
        }
        console.log('\nPress Ctrl+C to stop the server');
        return;
      }

      // Handle PR URL option with gh patch output
      let prPatch: string | undefined;
      if (options.pr) {
        if (commitish !== 'HEAD' || compareWith) {
          console.error('Error: --pr option cannot be used with positional arguments');
          process.exit(1);
        }

        if (options.tui) {
          console.error('Error: --pr option cannot be used with --tui');
          process.exit(1);
        }

        try {
          prPatch = getPrPatch(options.pr);
        } catch (error) {
          console.error(
            `Error resolving PR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
          process.exit(1);
        }
      }

      // Detect git root (not required for PR patch mode)
      let repoPath: string | undefined;
      if (!prPatch) {
        try {
          repoPath = getGitRoot();
        } catch {
          // If not in a git repository, fall back to process.cwd()
          repoPath = undefined;
        }
      }

      // Determine target and base commitish
      let targetCommitish = commitish;
      let baseCommitish: string | undefined;

      if (!prPatch && compareWith) {
        // If compareWith is provided, use it as base
        baseCommitish = compareWith;
      } else if (!prPatch) {
        // Handle special arguments
        if (commitish === 'working') {
          // working compares working directory with staging area
          baseCommitish = 'staged';
        } else if (isSpecialArg(commitish)) {
          baseCommitish = 'HEAD';
        } else {
          baseCommitish = commitish + '^';
        }
      }

      if (!prPatch && (commitish === 'working' || commitish === '.')) {
        const git = simpleGit(repoPath);
        await handleUntrackedFiles(git, options.includeUntracked);
      }

      if (options.tui) {
        if (!baseCommitish) {
          console.error('Error: --tui mode requires commit-ish comparison, not patch input.');
          process.exit(1);
        }

        // Check if we're in a TTY environment
        if (!process.stdin.isTTY) {
          console.error('Error: TUI mode requires an interactive terminal (TTY).');
          console.error('Try running the command directly in your terminal without piping.');
          process.exit(1);
        }

        // Dynamic import for TUI mode
        const { render } = await import('ink');
        const { default: TuiApp } = await import('../tui/App.js');

        render(
          React.createElement(TuiApp, {
            targetCommitish,
            baseCommitish,
            mode: options.mode,
            repoPath,
          }),
        );
        return;
      }

      if (!prPatch) {
        const validation = validateDiffArguments(targetCommitish, compareWith);
        if (!validation.valid) {
          console.error(`Error: ${validation.error}`);
          process.exit(1);
        }
      }

      const { url, port, isEmpty } = prPatch
        ? await startServer({
            stdinDiff: prPatch,
            preferredPort: options.port,
            host: options.host,
            openBrowser: options.open,
            mode: options.mode,
            clearComments: options.clean,
            keepAlive: options.keepAlive,
          })
        : await startServer({
            targetCommitish,
            baseCommitish: baseCommitish ?? `${targetCommitish}^`,
            preferredPort: options.port,
            host: options.host,
            openBrowser: options.open,
            mode: options.mode,
            clearComments: options.clean,
            keepAlive: options.keepAlive,
            diffMode: determineDiffMode(targetCommitish, compareWith),
            repoPath,
          });

      console.log(`\n🚀 difit server started on ${url}`);
      console.log(`📋 Reviewing: ${options.pr ? options.pr : targetCommitish}`);

      if (options.keepAlive) {
        console.log('🔒 Keep-alive mode: server will stay running after browser disconnects');
      }

      if (options.clean) {
        console.log('🧹 Starting with a clean slate - all existing comments will be cleared');
      }

      if (isEmpty) {
        console.log(
          '\n! \x1b[33mNo differences found. Browser will not open automatically.\x1b[0m',
        );
        console.log(`   Server is running at ${url} if you want to check manually.\n`);
      } else if (options.open) {
        console.log('🌐 Opening browser...\n');
      } else {
        console.log('💡 Use --open to automatically open browser\n');
      }

      process.on('SIGINT', async () => {
        console.log('\n👋 Shutting down difit server...');

        // Try to fetch comments before shutting down
        try {
          const response = await fetch(`http://localhost:${port}/api/comments-output`);
          if (response.ok) {
            const data = await response.text();
            if (data.trim()) {
              console.log(data);
            }
          }
        } catch {
          // Silently ignore fetch errors during shutdown
        }

        process.exit(0);
      });
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

program.parse();

// Check for untracked files and prompt user to add them for diff visibility
async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function handleUntrackedFiles(git: SimpleGit, addAutomatically?: boolean): Promise<void> {
  const files = await findUntrackedFiles(git);
  if (files.length === 0) {
    return;
  }

  const shouldAdd = addAutomatically || (await promptUserToIncludeUntracked(files));

  if (shouldAdd) {
    await markFilesIntentToAdd(git, files);
    console.log('✅ Files added with --intent-to-add');
    const filesAsArgs = files.join(' ');
    console.log(`   💡 To undo this, run \`git reset -- ${filesAsArgs}\``);
  } else {
    console.log('i Untracked files will not be shown in diff');
  }
}

async function promptUserToIncludeUntracked(files: string[]): Promise<boolean> {
  console.log(`\n📝 Found ${files.length} untracked file(s):`);
  for (const file of files) {
    console.log(`    - ${file}`);
  }

  return await promptUser(
    '\n❓ Would you like to include these untracked files in the diff review? (Y/n): ',
  );
}
