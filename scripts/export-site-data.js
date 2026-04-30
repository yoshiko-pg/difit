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
    target: 'b908dc3',
    title: 'Markdown Mermaid preview',
    description: 'Markdown diagram preview support with Mermaid rendering.',
  },
  {
    target: 'a851e37',
    title: 'Large threaded comments diff',
    description: 'A broad UI feature diff spanning review threads, navigation, storage, and tests.',
  },
  {
    target: 'c82f4b3',
    title: 'Notebook preview',
    description: 'Jupyter notebook sample and full notebook diff viewer implementation.',
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

const binaryFilePattern = /\.(?:avif|gif|ico|jpe?g|pdf|png|webp|woff2?|zip)$/i;

function blobKey(ref, path) {
  return `${shortHash(ref)}:${path}`;
}

async function readBlobText(ref, path) {
  if (binaryFilePattern.test(path)) {
    return null;
  }

  try {
    return await git.raw(['show', `${ref}:${path}`]);
  } catch {
    return null;
  }
}

async function collectRevisions() {
  const revisions = [];

  for (const spec of demoRevisionSpecs) {
    let revisionFields;
    try {
      revisionFields = await git.raw([
        'show',
        '-s',
        '--format=%H%x00%P%x00%s%x00%an%x00%aI',
        spec.target,
      ]);
    } catch (error) {
      console.warn(`Skipping unavailable site demo revision ${spec.target}:`, error);
      continue;
    }

    const [targetHash, baseHash, message, authorName, date] = revisionFields.trim().split('\0');

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
  const blobs = {};

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

      for (const file of diff.files) {
        const oldPath = file.oldPath ?? file.path;
        const oldContent =
          file.status === 'added' ? null : await readBlobText(revision.baseHash, oldPath);
        const newContent =
          file.status === 'deleted' ? null : await readBlobText(revision.targetHash, file.path);

        if (oldContent !== null) {
          blobs[blobKey(revision.baseHash, oldPath)] = oldContent;
        }
        if (newContent !== null) {
          blobs[blobKey(revision.targetHash, file.path)] = newContent;
        }
      }
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
    blobs,
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
