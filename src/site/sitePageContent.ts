export type SiteLanguage = 'en' | 'ja' | 'ko' | 'zh';

export type UsageCommentKey =
  | 'singleCommitDiff'
  | 'compareTwoTargets'
  | 'headCommit'
  | 'specificCommit'
  | 'featureLatestCommit'
  | 'compareWithMain'
  | 'compareBranches'
  | 'compareWorkingAndRemoteMain'
  | 'allUncommitted'
  | 'stagingAreaChanges'
  | 'unstagedOnly'
  | 'reviewPrUrl'
  | 'viewExternalDiffs'
  | 'reviewSavedPatches';

type ShellCommentKey =
  | 'tryNow'
  | 'liveDemo'
  | 'installGlobally'
  | 'installSkills'
  | 'usageExamples'
  | 'starOnGitHub';

export const LANGUAGE_OPTIONS: ReadonlyArray<{ code: SiteLanguage; label: string }> = [
  { code: 'en', label: 'EN' },
  { code: 'ja', label: 'JA' },
  { code: 'ko', label: 'KO' },
  { code: 'zh', label: 'ZH' },
];

const SUPPORTED_LANGUAGE_CODES = new Set<SiteLanguage>(
  LANGUAGE_OPTIONS.map((option) => option.code),
);

export const resolveSiteLanguage = (
  languageTags: readonly string[],
  fallback: SiteLanguage = 'en',
): SiteLanguage => {
  for (const languageTag of languageTags) {
    const languageCode = languageTag.toLowerCase().split('-', 1)[0];
    if (SUPPORTED_LANGUAGE_CODES.has(languageCode as SiteLanguage)) {
      return languageCode as SiteLanguage;
    }
  }

  return fallback;
};

export const HERO_TEXT: Record<
  SiteLanguage,
  { catchCopy: string; description: readonly [string, string] }
> = {
  en: {
    catchCopy: 'Beautiful diffs. Launched from your terminal.',
    description: [
      'GitHub-style diff viewer for local git.',
      'Review code, add comments, copy AI prompts — all from one command.',
    ],
  },
  ja: {
    catchCopy: '美しいdiffを、ターミナルからすぐに。',
    description: [
      'ローカルgitのためのGitHubスタイル差分ビューア。',
      'コードレビュー、コメント、AI向けプロンプトコピーまで、1コマンドで。',
    ],
  },
  ko: {
    catchCopy: '아름다운 diff를 터미널에서 바로.',
    description: [
      '로컬 git을 위한 GitHub 스타일 diff 뷰어.',
      '코드 리뷰, 코멘트, AI 프롬프트 복사를 한 명령으로.',
    ],
  },
  zh: {
    catchCopy: '美观的 diff，从终端立即启动。',
    description: [
      '面向本地 git 的 GitHub 风格差异查看器。',
      '代码评审、评论、复制 AI 提示词，一条命令完成。',
    ],
  },
};

export const SHELL_COMMENT_TEXT: Record<SiteLanguage, Record<ShellCommentKey, string>> = {
  en: {
    tryNow: 'Try it now — no install required',
    liveDemo: "Here's what you'll see",
    installGlobally: 'Or install globally',
    installSkills: 'Recommended: Install skills',
    usageExamples: 'Usage examples',
    starOnGitHub: 'Star on GitHub',
  },
  ja: {
    tryNow: '今すぐ試す — インストール不要',
    liveDemo: '表示される画面',
    installGlobally: 'またはグローバルにインストール',
    installSkills: '推奨: skills をインストール',
    usageExamples: '使用例',
    starOnGitHub: 'GitHubでスター',
  },
  ko: {
    tryNow: '지금 바로 사용해 보기 — 설치 불필요',
    liveDemo: '표시되는 화면',
    installGlobally: '또는 전역 설치',
    installSkills: '권장: skills 설치',
    usageExamples: '사용 예시',
    starOnGitHub: 'GitHub에서 스타',
  },
  zh: {
    tryNow: '立即试用 — 无需安装',
    liveDemo: '你会看到的画面',
    installGlobally: '或全局安装',
    installSkills: '推荐：安装 skills',
    usageExamples: '使用示例',
    starOnGitHub: '在 GitHub 上加星',
  },
};

export const USAGE_COMMENT_TEXT: Record<SiteLanguage, Record<UsageCommentKey, string>> = {
  en: {
    singleCommitDiff: 'view single commit diff',
    compareTwoTargets: 'compare two commits/branches',
    headCommit: 'HEAD (latest) commit',
    specificCommit: 'specific commit',
    featureLatestCommit: 'latest commit on feature branch',
    compareWithMain: 'compare with main branch',
    compareBranches: 'compare branches',
    compareWorkingAndRemoteMain: 'compare working directory with remote main',
    allUncommitted: 'all uncommitted changes (staging area + unstaged)',
    stagingAreaChanges: 'staging area changes',
    unstagedOnly: 'unstaged changes only',
    reviewPrUrl: 'review GitHub pull request URL',
    viewExternalDiffs: 'view diffs from other tools',
    reviewSavedPatches: 'review saved patches',
  },
  ja: {
    singleCommitDiff: '単一コミットの差分を表示',
    compareTwoTargets: '2つのコミット/ブランチを比較',
    headCommit: 'HEAD（最新）コミット',
    specificCommit: '特定のコミット',
    featureLatestCommit: 'featureブランチの最新コミット',
    compareWithMain: 'mainブランチと比較',
    compareBranches: 'ブランチ同士を比較',
    compareWorkingAndRemoteMain: '作業ディレクトリとリモートmainを比較',
    allUncommitted: '未コミット変更すべて（staging + unstaged）',
    stagingAreaChanges: 'ステージング済みの変更',
    unstagedOnly: 'unstaged変更のみ',
    reviewPrUrl: 'GitHub Pull Request URLをレビュー',
    viewExternalDiffs: '他ツールの差分を表示',
    reviewSavedPatches: '保存したパッチをレビュー',
  },
  ko: {
    singleCommitDiff: '단일 커밋 diff 보기',
    compareTwoTargets: '두 커밋/브랜치 비교',
    headCommit: 'HEAD(최신) 커밋',
    specificCommit: '특정 커밋',
    featureLatestCommit: 'feature 브랜치의 최신 커밋',
    compareWithMain: 'main 브랜치와 비교',
    compareBranches: '브랜치끼리 비교',
    compareWorkingAndRemoteMain: '작업 디렉터리와 원격 main 비교',
    allUncommitted: '미커밋 변경 전체(staging + unstaged)',
    stagingAreaChanges: '스테이징 영역 변경',
    unstagedOnly: 'unstaged 변경만',
    reviewPrUrl: 'GitHub Pull Request URL 리뷰',
    viewExternalDiffs: '다른 도구의 diff 보기',
    reviewSavedPatches: '저장된 패치 리뷰',
  },
  zh: {
    singleCommitDiff: '查看单个提交差异',
    compareTwoTargets: '比较两个提交/分支',
    headCommit: 'HEAD（最新）提交',
    specificCommit: '指定提交',
    featureLatestCommit: 'feature 分支最新提交',
    compareWithMain: '与 main 分支比较',
    compareBranches: '比较分支',
    compareWorkingAndRemoteMain: '比较工作区与远程 main',
    allUncommitted: '所有未提交更改（staging + unstaged）',
    stagingAreaChanges: '暂存区更改',
    unstagedOnly: '仅 unstaged 更改',
    reviewPrUrl: '评审 GitHub Pull Request URL',
    viewExternalDiffs: '查看来自其他工具的差异',
    reviewSavedPatches: '评审已保存的补丁',
  },
};
