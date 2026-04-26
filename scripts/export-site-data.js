#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'fs';
import { basename, dirname, resolve } from 'path';

import { simpleGit } from 'simple-git';

import { GitDiffParser } from '../dist/server/git-diff.js';

const repoPath = process.cwd();
const outputPath = resolve(repoPath, 'public/site-data/diffs.json');

const git = simpleGit(repoPath);
const parser = new GitDiffParser(repoPath);

const demoRevisionSpecs = [
  {
    target: 'd590ab2',
    title: 'Large implementation diff',
    description: 'Image diff support across client, server, tests, and dependencies.',
  },
  {
    target: '1f5d010',
    title: 'Image and brand asset diff',
    description: 'Rename to difit with logo, favicon, and product copy changes.',
  },
  {
    target: 'c82f4b3',
    title: 'Notebook preview',
    description: 'Jupyter notebook sample and full notebook diff viewer implementation.',
  },
  {
    target: 'b908dc3',
    title: 'Markdown Mermaid preview',
    description: 'Markdown diagram preview support with Mermaid rendering.',
  },
  {
    target: 'fd01270',
    title: 'Markdown syntax sample',
    description: 'A dense Markdown sample that shows rendered preview behavior clearly.',
  },
  {
    target: '2a62204',
    title: 'Revision selection workflow',
    description: 'Merge-base quick diffs across CLI, web UI, storage, and server paths.',
  },
  {
    target: 'caeec50',
    title: 'Comment synchronization',
    description: 'Comment sessions synchronized across CLI, browser, and diff selections.',
  },
  {
    target: '9ca4e40',
    title: 'Review comment imports',
    description: 'Startup review comments imported into the diff for agent workflows.',
  },
];

function shortHash(hash) {
  return hash.slice(0, 7);
}

async function collectRevisions() {
  const revisions = [];

  for (const spec of demoRevisionSpecs) {
    const [targetHash, baseHash, message, authorName, date] = (
      await git.raw(['show', '-s', '--format=%H%x00%P%x00%s%x00%an%x00%aI', spec.target])
    )
      .trim()
      .split('\0');

    const firstParentHash = baseHash?.split(/\s+/)[0];
    if (!targetHash || !firstParentHash || !message || !authorName || !date) continue;

    revisions.push({
      id: `${shortHash(firstParentHash)}...${shortHash(targetHash)}`,
      demoTitle: spec.title,
      demoDescription: spec.description,
      baseHash: firstParentHash,
      baseShortHash: shortHash(firstParentHash),
      targetHash,
      targetShortHash: shortHash(targetHash),
      message,
      authorName,
      date,
    });
  }

  return revisions;
}

async function buildDataset() {
  const revisions = await collectRevisions();
  const diffs = {};

  for (const revision of revisions) {
    try {
      const diff = await parser.parseDiff(
        {
          baseCommitish: revision.baseHash,
          targetCommitish: revision.targetHash,
        },
        true,
      );
      diffs[revision.id] = {
        ...diff,
        ignoreWhitespace: true,
        mode: 'split',
        baseCommitish: revision.baseShortHash,
        targetCommitish: revision.targetShortHash,
        requestedBaseCommitish: revision.baseShortHash,
        requestedTargetCommitish: revision.targetShortHash,
      };
    } catch (error) {
      console.warn(`Failed to export diff for ${revision.id}:`, error);
    }
  }

  const availableRevisions = revisions.filter((revision) => diffs[revision.id]);

  return {
    generatedAt: new Date().toISOString(),
    repository: basename(repoPath),
    initialRevisionId: availableRevisions[0]?.id ?? null,
    revisions: availableRevisions,
    diffs,
  };
}

async function main() {
  const dataset = await buildDataset();
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(dataset, null, 2) + '\n', 'utf8');

  console.log(
    `Exported ${dataset.revisions.length} static site diffs to ${outputPath} (${dataset.generatedAt})`,
  );
}

main().catch((error) => {
  console.error('Failed to export static site diffs:', error);
  process.exitCode = 1;
});
