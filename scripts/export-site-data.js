#!/usr/bin/env node
import { execFileSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { basename, dirname, extname, resolve } from 'path';

import { simpleGit } from 'simple-git';

import { GitDiffParser } from '../dist/server/git-diff.js';

const repoPath = process.cwd();
const outputPath = resolve(repoPath, 'public/site-data/diffs.json');

const git = simpleGit(repoPath);
const parser = new GitDiffParser(repoPath);

const demoRevisionSpecs = [
  {
    target: 'a72112f',
    title: 'Standard feature diff',
    description: 'A typical product change touching app code, hooks, settings, and tests.',
    localized: {
      ja: {
        title: '標準的な機能diff',
        description: 'アプリコード、hooks、設定、テストにまたがる典型的なプロダクト変更。',
        message: 'diffスクロールアニメーションで視差低減設定を尊重',
      },
      ko: {
        title: '표준 기능 diff',
        description: '앱 코드, hooks, 설정, 테스트를 아우르는 일반적인 제품 변경입니다.',
        message: 'diff 스크롤 애니메이션에 동작 줄이기 설정 반영',
      },
      zh: {
        title: '标准功能 diff',
        description: '涉及应用代码、hooks、设置和测试的典型产品改动。',
        message: '在 diff 滚动动画中遵循减少动态效果设置',
      },
    },
  },
  {
    target: 'e6977fed27ff3ffa30a77c97a0e9fcd5cf61c6c3',
    title: 'Image diff',
    description: 'A logo image update rendered with the image diff viewer.',
    localized: {
      ja: {
        title: '画像diff',
        description: '画像diffビューアで表示するロゴ画像の更新。',
        message: 'READMEのロゴを更新',
      },
      ko: {
        title: '이미지 diff',
        description: '이미지 diff 뷰어로 확인하는 로고 이미지 업데이트입니다.',
        message: 'README 로고 업데이트',
      },
      zh: {
        title: '图片 diff',
        description: '使用图片 diff 查看器展示的 logo 图片更新。',
        message: '更新 README logo',
      },
    },
  },
  {
    base: '55f23a19564e0de4888f1bfd2ae6c23f86103ba6',
    target: '080c0e6ab18f7bb7cc235ea951c26e0414c28076',
    title: '100+ file diff',
    description: 'A broad site migration range with more than 100 changed files.',
    localized: {
      ja: {
        title: '100ファイル以上のdiff',
        description: '100ファイルを超える広範なサイト移行の差分。',
        message: 'copy(site): ヒーローのキャッチコピーを更新',
      },
      ko: {
        title: '100개 이상 파일 diff',
        description: '100개가 넘는 파일을 포함한 대규모 사이트 마이그레이션 범위입니다.',
        message: 'copy(site): 히어로 캐치카피 업데이트',
      },
      zh: {
        title: '100+ 文件 diff',
        description: '包含 100 多个变更文件的大范围站点迁移差异。',
        message: 'copy(site): 更新主视觉标语',
      },
    },
  },
  {
    target: 'a72112f',
    idSuffix: 'comments',
    title: 'Standard diff with comments',
    description: 'The standard feature diff with sample review comments already attached.',
    localized: {
      ja: {
        title: 'コメント付きの標準diff',
        description: 'サンプルレビューコメントがあらかじめ付いた標準的な機能diff。',
        message: 'diffスクロールアニメーションで視差低減設定を尊重',
      },
      ko: {
        title: '코멘트가 있는 표준 diff',
        description: '샘플 리뷰 코멘트가 미리 포함된 표준 기능 diff입니다.',
        message: 'diff 스크롤 애니메이션에 동작 줄이기 설정 반영',
      },
      zh: {
        title: '带评论的标准 diff',
        description: '预先附带示例评审评论的标准功能 diff。',
        message: '在 diff 滚动动画中遵循减少动态效果设置',
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
      console.warn(`Skipping unavailable site demo revision ${spec.target}:`, error);
      continue;
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
      demoDescription: spec.description,
      demoTitleByLanguage: {
        en: spec.title,
        ...Object.fromEntries(
          Object.entries(spec.localized ?? {}).map(([language, value]) => [language, value.title]),
        ),
      },
      demoDescriptionByLanguage: {
        en: spec.description,
        ...Object.fromEntries(
          Object.entries(spec.localized ?? {}).map(([language, value]) => [
            language,
            value.description,
          ]),
        ),
      },
      demoMessageByLanguage: {
        en: message,
        ...Object.fromEntries(
          Object.entries(spec.localized ?? {}).map(([language, value]) => [
            language,
            value.message,
          ]),
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
  const diffs = {};
  const blobs = {};
  const blobUrls = {};
  const comments = {};

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
        repositoryId: `site-demo:${revision.id}`,
      };
      comments[revision.id] = revision.comments;

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
    } catch (error) {
      console.warn(`Failed to export diff for ${revision.id}:`, error);
    }
  }

  const availableRevisions = revisions.filter((revision) => diffs[revision.id]);
  const exportedRevisions = availableRevisions.map(
    ({ comments: _comments, ...revision }) => revision,
  );

  return {
    generatedAt: new Date().toISOString(),
    repository: basename(repoPath),
    initialRevisionId: availableRevisions[0]?.id ?? null,
    revisions: exportedRevisions,
    diffs,
    blobs,
    blobUrls,
    comments,
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
