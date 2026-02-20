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

type FeatureKey = 'multiInput' | 'comments' | 'aiAgents' | 'responsive';

export const LANGUAGE_OPTIONS: ReadonlyArray<{ code: SiteLanguage; label: string }> = [
  { code: 'en', label: 'EN' },
  { code: 'ja', label: 'JA' },
  { code: 'ko', label: 'KO' },
  { code: 'zh', label: 'ZH' },
];

export const HERO_TEXT: Record<
  SiteLanguage,
  { catchCopy: string; description: readonly [string, string] }
> = {
  en: {
    catchCopy: 'Beautiful diffs. Right in your terminal',
    description: [
      'GitHub-style diff viewer for local git.',
      'Review code, add comments, copy AI prompts — all from one command.',
    ],
  },
  ja: {
    catchCopy: '美しい差分を、ターミナルで。',
    description: [
      'ローカルgitのためのGitHubスタイル差分ビューア。',
      'コードレビュー、コメント、AI向けプロンプトコピーまで、1コマンドで。',
    ],
  },
  ko: {
    catchCopy: '아름다운 diff를 터미널에서.',
    description: [
      '로컬 git을 위한 GitHub 스타일 diff 뷰어.',
      '코드 리뷰, 코멘트, AI 프롬프트 복사를 한 명령으로.',
    ],
  },
  zh: {
    catchCopy: '在终端里查看优雅的差异。',
    description: [
      '面向本地 git 的 GitHub 风格差异查看器。',
      '代码评审、评论、复制 AI 提示词，一条命令完成。',
    ],
  },
};

export const FEATURES_HEADING: Record<SiteLanguage, string> = {
  en: 'Features',
  ja: '機能',
  ko: '기능',
  zh: '功能',
};

export const FEATURE_KEYS: readonly FeatureKey[] = [
  'multiInput',
  'comments',
  'aiAgents',
  'responsive',
];

export const FEATURE_TEXT: Record<
  SiteLanguage,
  Record<FeatureKey, { tab: string; label: string; desc: string }>
> = {
  en: {
    multiInput: {
      tab: 'input',
      label: 'multi-source input',
      desc: 'Review local diffs, stdin patches, and GitHub PR URLs in one flow',
    },
    comments: {
      tab: 'notes',
      label: 'comment workflow',
      desc: 'Add line/range comments directly in the diff UI and keep review context',
    },
    aiAgents: {
      tab: 'agents',
      label: 'AI agent bridge',
      desc: 'Use Copy Prompt / Copy All to pass review context to coding agents',
    },
    responsive: {
      tab: 'mobile',
      label: 'responsive UI',
      desc: 'Stay readable across desktop and mobile with adaptive layouts',
    },
  },
  ja: {
    multiInput: {
      tab: '入力',
      label: '多様な入力対応',
      desc: 'ローカル diff・stdin・GitHub PR URL を1つのUIでレビュー',
    },
    comments: {
      tab: 'コメ',
      label: 'コメント機能',
      desc: '行・範囲ごとにコメントを残しながらレビューの文脈を保持',
    },
    aiAgents: {
      tab: 'AI',
      label: 'AIエージェント連携',
      desc: 'Copy Prompt / Copy All でレビュー内容をコーディングエージェントへ連携',
    },
    responsive: {
      tab: 'レスポン',
      label: 'レスポンシブ対応',
      desc: 'デスクトップとモバイルの両方で見やすいレイアウトを提供',
    },
  },
  ko: {
    multiInput: {
      tab: '입력',
      label: '다양한 입력 지원',
      desc: '로컬 diff, stdin, GitHub PR URL을 하나의 UI에서 리뷰',
    },
    comments: {
      tab: '코멘트',
      label: '코멘트 기능',
      desc: '라인/범위 코멘트를 남기며 리뷰 맥락을 유지',
    },
    aiAgents: {
      tab: 'AI',
      label: 'AI 에이전트 연동',
      desc: 'Copy Prompt / Copy All로 리뷰 맥락을 코딩 에이전트에 전달',
    },
    responsive: {
      tab: '반응형',
      label: '반응형 대응',
      desc: '데스크톱과 모바일 모두에서 읽기 쉬운 레이아웃 제공',
    },
  },
  zh: {
    multiInput: {
      tab: '输入',
      label: '多样输入支持',
      desc: '可在同一界面审查本地 diff、stdin 补丁与 GitHub PR URL',
    },
    comments: {
      tab: '评论',
      label: '评论功能',
      desc: '支持行/范围评论，持续保留评审上下文',
    },
    aiAgents: {
      tab: 'AI',
      label: 'AI 代理联动',
      desc: '通过 Copy Prompt / Copy All 将评审上下文传给编码代理',
    },
    responsive: {
      tab: '响应',
      label: '响应式支持',
      desc: '在桌面与移动端都保持易读布局',
    },
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
