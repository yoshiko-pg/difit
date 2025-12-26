#!/usr/bin/env node

import { Command } from 'commander';
import React from 'react';
import { simpleGit, type SimpleGit } from 'simple-git';

import pkg from '../../package.json' with { type: 'json' };
import { startServer } from '../server/server.js';
import { DiffMode } from '../types/watch.js';

import {
  findUntrackedFiles,
  markFilesIntentToAdd,
  promptUser,
  validateDiffArguments,
  resolvePrCommits,
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
  mode: string;
  tui?: boolean;
  pr?: string;
  clean?: boolean;
}

const program = new Command();

program
  .name('difit')
  .description('A lightweight Git diff viewer with GitHub-like interface')
  .version(pkg.version)
  .argument(
    '[commit-ish]',
    'Git commit, tag, branch, HEAD~n reference, or "working"/"staged"/"."',
    'HEAD'
  )
  .argument(
    '[compare-with]',
    'Optional: Compare with this commit/branch (shows diff between commit-ish and compare-with)'
  )
  .option('--port <port>', 'preferred port (auto-assigned if occupied)', parseInt)
  .option('--host <host>', 'host address to bind', '')
  .option('--no-open', 'do not automatically open browser')
  .option('--mode <mode>', 'diff mode (side-by-side or inline)', 'side-by-side')
  .option('--tui', 'use terminal UI instead of web interface')
  .option('--pr <url>', 'GitHub PR URL to review (e.g., https://github.com/owner/repo/pull/123)')
  .option('--clean', 'start with a clean slate by clearing all existing comments')
  .action(async (commitish: string, compareWith: string | undefined, options: CliOptions) => {
    try {
      // Check if we should read from stdin
      const shouldReadStdin = !process.stdin.isTTY || commitish === '-';

      if (shouldReadStdin) {
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
        });

        console.log(`\n🚀 difit server started on ${url}`);
        console.log(`📋 Reviewing: diff from stdin`);
        console.log('\nPress Ctrl+C to stop the server');
        return;
      }

      // Detect git root
      let repoPath: string | undefined;
      try {
        repoPath = getGitRoot();
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }

      // Determine target and base commitish
      let targetCommitish = commitish;
      let baseCommitish: string;

      // Handle PR URL option
      if (options.pr) {
        if (commitish !== 'HEAD' || compareWith) {
          console.error('Error: --pr option cannot be used with positional arguments');
          process.exit(1);
        }

        try {
          const prCommits = await resolvePrCommits(options.pr);
          targetCommitish = prCommits.targetCommitish;
          baseCommitish = prCommits.baseCommitish;

          console.log(`📋 Reviewing PR: ${options.pr}`);
          console.log(`🎯 Target commit: ${targetCommitish.substring(0, 7)}`);
          console.log(`📍 Base commit: ${baseCommitish.substring(0, 7)}`);
        } catch (error) {
          console.error(
            `Error resolving PR: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
          process.exit(1);
        }
      } else if (compareWith) {
        // If compareWith is provided, use it as base
        baseCommitish = compareWith;
      } else {
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

      if (commitish === 'working' || commitish === '.') {
        const git = simpleGit(repoPath);
        await handleUntrackedFiles(git);
      }

      if (options.tui) {
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
          })
        );
        return;
      }

      // Skip validation for PR URLs as they're already resolved to valid commits
      if (!options.pr) {
        const validation = validateDiffArguments(targetCommitish, compareWith);
        if (!validation.valid) {
          console.error(`Error: ${validation.error}`);
          process.exit(1);
        }
      }

      const diffMode = determineDiffMode(targetCommitish, compareWith);

      const { url, port, isEmpty } = await startServer({
        targetCommitish,
        baseCommitish,
        preferredPort: options.port,
        host: options.host,
        openBrowser: options.open,
        mode: options.mode,
        clearComments: options.clean,
        diffMode,
        repoPath,
      });

      console.log(`\n🚀 difit server started on ${url}`);
      console.log(`📋 Reviewing: ${targetCommitish}`);

      if (options.clean) {
        console.log('🧹 Starting with a clean slate - all existing comments will be cleared');
      }

      if (isEmpty) {
        console.log(
          '\n! \x1b[33mNo differences found. Browser will not open automatically.\x1b[0m'
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

async function handleUntrackedFiles(git: SimpleGit): Promise<void> {
  const files = await findUntrackedFiles(git);
  if (files.length === 0) {
    return;
  }

  const userConsent = await promptUserToIncludeUntracked(files);
  if (userConsent) {
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
    '\n❓ Would you like to include these untracked files in the diff review? (Y/n): '
  );
}
