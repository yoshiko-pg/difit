#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'fs';
import { basename, dirname, resolve } from 'path';

import { simpleGit } from 'simple-git';

import { GitDiffParser } from '../dist/server/git-diff.js';

const repoPath = process.cwd();
const outputPath = resolve(repoPath, 'public/site-data/diffs.json');
const rawLimit = Number.parseInt(process.env.DIFIT_SITE_HISTORY ?? '8', 10);
const historyLimit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 8;
const historyScanLimit = Math.max(historyLimit * 4, historyLimit + 8);

const git = simpleGit(repoPath);
const parser = new GitDiffParser(repoPath);

function shortHash(hash) {
  return hash.slice(0, 7);
}

async function collectRevisions() {
  const [logResult, revListText] = await Promise.all([
    git.log({ maxCount: historyScanLimit }),
    git.raw(['rev-list', `--max-count=${historyScanLimit}`, '--parents', 'HEAD']),
  ]);

  const commitInfoMap = new Map(logResult.all.map((commit) => [commit.hash, commit]));
  const revisions = [];

  for (const line of revListText.trim().split('\n')) {
    if (!line) continue;

    const [targetHash, baseHash] = line.trim().split(/\s+/);
    if (!targetHash || !baseHash) continue;

    const info = commitInfoMap.get(targetHash);
    if (!info) continue;

    revisions.push({
      id: `${shortHash(baseHash)}...${shortHash(targetHash)}`,
      baseHash,
      baseShortHash: shortHash(baseHash),
      targetHash,
      targetShortHash: shortHash(targetHash),
      message: info.message,
      authorName: info.author_name,
      date: info.date,
    });

    if (revisions.length >= historyLimit) {
      break;
    }
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
