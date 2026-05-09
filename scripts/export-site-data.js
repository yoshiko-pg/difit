#!/usr/bin/env node
import { execFileSync } from 'child_process';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { basename, dirname, extname, resolve } from 'path';

import { simpleGit } from 'simple-git';

import { GitDiffParser } from '../dist/server/git-diff.js';

const repoPath = process.cwd();
const outputPath = resolve(repoPath, 'public/site-data/manifest.json');
const snapshotsOutputPath = resolve(repoPath, 'public/site-data/snapshots');

const git = simpleGit(repoPath);
const parser = new GitDiffParser(repoPath);

const demoRevisionSpecs = [
  {
    target: 'a72112f',
    title: 'Standard feature diff',
    localized: {
      ja: {
        title: '標準的な機能diff',
      },
      ko: {
        title: '표준 기능 diff',
      },
      zh: {
        title: '标准功能 diff',
      },
    },
  },
  {
    target: 'e6977fed27ff3ffa30a77c97a0e9fcd5cf61c6c3',
    title: 'Image diff',
    localized: {
      ja: {
        title: '画像diff',
      },
      ko: {
        title: '이미지 diff',
      },
      zh: {
        title: '图片 diff',
      },
    },
  },
  {
    base: '55f23a19564e0de4888f1bfd2ae6c23f86103ba6',
    target: '080c0e6ab18f7bb7cc235ea951c26e0414c28076',
    title: '100+ file diff',
    localized: {
      ja: {
        title: '100ファイル以上のdiff',
      },
      ko: {
        title: '100개 이상 파일 diff',
      },
      zh: {
        title: '100+ 文件 diff',
      },
    },
  },
  {
    target: 'a72112f',
    idSuffix: 'comments',
    title: 'Diff with AI comments',
    localized: {
      ja: {
        title: 'AIからのコメントがついたdiff',
      },
      ko: {
        title: 'AI 코멘트가 있는 diff',
      },
      zh: {
        title: '带有 AI 评论的 diff',
      },
    },
    comments: [
      {
        id: 'site-demo-scroll-behavior-thread',
        filePath: 'src/client/hooks/usePreferredScrollBehavior.ts',
        createdAt: '2026-05-05T00:00:00.000Z',
        updatedAt: '2026-05-05T00:00:00.000Z',
        position: {
          side: 'new',
          line: 21,
        },
        codeSnapshot: {
          content: '  const systemPrefersReducedMotion = useSyncExternalStore(',
          language: 'typescript',
        },
        messages: [
          {
            id: 'site-demo-scroll-behavior-message',
            body: 'Good place to centralize the reduced-motion preference before it reaches the diff scroller.',
            author: 'demo-reviewer',
            createdAt: '2026-05-05T00:00:00.000Z',
            updatedAt: '2026-05-05T00:00:00.000Z',
          },
        ],
      },
      {
        id: 'site-demo-app-thread',
        filePath: 'src/client/App.tsx',
        createdAt: '2026-05-05T00:01:00.000Z',
        updatedAt: '2026-05-05T00:01:00.000Z',
        position: {
          side: 'new',
          line: 153,
        },
        codeSnapshot: {
          content:
            '  const { settings, updateSettings, scrollBehavior } = useAppearanceSettings();',
          language: 'tsx',
        },
        messages: [
          {
            id: 'site-demo-app-message',
            body: 'The derived scroll behavior is now wired into lazy rendering, so navigating large diffs can respect the user setting.',
            author: 'demo-reviewer',
            createdAt: '2026-05-05T00:01:00.000Z',
            updatedAt: '2026-05-05T00:01:00.000Z',
          },
        ],
      },
    ],
  },
];

function shortHash(hash) {
  return hash.slice(0, 7);
}

const binaryFilePattern = /\.(?:avif|gif|ico|jpe?g|pdf|png|webp|woff2?|zip)$/i;

function blobKey(ref, path) {
  return `${shortHash(ref)}:${path}`;
}

function blobAssetPath(ref, path) {
  return `site-data/blobs/${shortHash(ref)}/${Buffer.from(path).toString('base64url')}${extname(path)}`;
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

function writeBinaryBlob(ref, path) {
  if (!binaryFilePattern.test(path)) {
    return null;
  }

  try {
    const content = execFileSync('git', ['show', `${ref}:${path}`], { cwd: repoPath });
    const assetPath = blobAssetPath(ref, path);
    const outputPath = resolve(repoPath, 'public', assetPath);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, content);
    return assetPath;
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
      throw new Error(`Unavailable site demo revision ${spec.target}`, { cause: error });
    }

    const [targetHash, baseHash, message, authorName, date] = revisionFields.trim().split('\0');

    let firstParentHash = baseHash?.split(/\s+/)[0];
    if (spec.base) {
      firstParentHash = (await git.revparse([spec.base])).trim();
    }
    if (!targetHash || !firstParentHash || !message || !authorName || !date) continue;

    const idBase = `${shortHash(firstParentHash)}...${shortHash(targetHash)}`;
    revisions.push({
      id: spec.idSuffix ? `${idBase}-${spec.idSuffix}` : idBase,
      demoTitle: spec.title,
      demoTitleByLanguage: {
        en: spec.title,
        ...Object.fromEntries(
          Object.entries(spec.localized ?? {}).map(([language, value]) => [language, value.title]),
        ),
      },
      comments: spec.comments ?? [],
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
  const snapshots = {};

  for (const revision of revisions) {
    const blobs = {};
    const blobUrls = {};
    try {
      const diff = await parser.parseDiff(
        {
          baseCommitish: revision.baseHash,
          targetCommitish: revision.targetHash,
        },
        true,
      );
      const snapshot = {
        revision: {
          ...revision,
          comments: undefined,
        },
        diff: {
          ...diff,
          ignoreWhitespace: true,
          mode: 'split',
          baseCommitish: revision.baseShortHash,
          targetCommitish: revision.targetShortHash,
          requestedBaseCommitish: revision.baseShortHash,
          requestedTargetCommitish: revision.targetShortHash,
          repositoryId: `site-demo:${revision.id}`,
        },
        blobs,
        blobUrls,
        comments: revision.comments,
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

        if (file.status !== 'added') {
          const oldBlobUrl = writeBinaryBlob(revision.baseHash, oldPath);
          if (oldBlobUrl) {
            blobUrls[blobKey(revision.baseHash, oldPath)] = oldBlobUrl;
          }
        }
        if (file.status !== 'deleted') {
          const newBlobUrl = writeBinaryBlob(revision.targetHash, file.path);
          if (newBlobUrl) {
            blobUrls[blobKey(revision.targetHash, file.path)] = newBlobUrl;
          }
        }
      }

      snapshots[revision.id] = snapshot;
    } catch (error) {
      throw new Error(`Failed to export diff for ${revision.id}`, { cause: error });
    }
  }

  const availableRevisions = revisions.filter((revision) => snapshots[revision.id]);
  const exportedRevisions = availableRevisions.map(
    ({ comments: _comments, ...revision }) => revision,
  );

  return {
    generatedAt: new Date().toISOString(),
    repository: basename(repoPath),
    initialRevisionId: availableRevisions[0]?.id ?? null,
    revisions: exportedRevisions,
    snapshots,
  };
}

async function main() {
  const dataset = await buildDataset();
  mkdirSync(dirname(outputPath), { recursive: true });
  rmSync(snapshotsOutputPath, { recursive: true, force: true });
  mkdirSync(snapshotsOutputPath, { recursive: true });

  const { snapshots, ...manifest } = dataset;
  writeFileSync(outputPath, `${JSON.stringify(manifest)}\n`, 'utf8');

  for (const [revisionId, snapshot] of Object.entries(snapshots)) {
    const snapshotPath = resolve(snapshotsOutputPath, `${revisionId}.json`);
    writeFileSync(snapshotPath, `${JSON.stringify(snapshot)}\n`, 'utf8');
  }

  console.log(
    `Exported ${dataset.revisions.length} static site snapshots to ${outputPath} (${dataset.generatedAt})`,
  );
}

main().catch((error) => {
  console.error('Failed to export static site diffs:', error);
  process.exitCode = 1;
});
