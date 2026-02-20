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

type FeatureKey =
  | 'localGithubPr'
  | 'stdinFriendly'
  | 'aiReviewPrompts'
  | 'specialTargets'
  | 'focusedDiffs'
  | 'webTui';

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
  'localGithubPr',
  'stdinFriendly',
  'aiReviewPrompts',
  'specialTargets',
  'focusedDiffs',
  'webTui',
];

export const FEATURE_TEXT: Record<
  SiteLanguage,
  Record<FeatureKey, { label: string; desc: string }>
> = {
  en: {
    localGithubPr: {
      label: 'local + GitHub PR',
      desc: 'Review local commits/branches and GitHub PR URLs in one workflow',
    },
    stdinFriendly: {
      label: 'stdin friendly',
      desc: 'Pipe unified diffs from any tool and inspect them with the same UI',
    },
    aiReviewPrompts: {
      label: 'AI review prompts',
      desc: 'Line/range comments with Copy Prompt and Copy All for coding agents',
    },
    specialTargets: {
      label: 'special targets',
      desc: 'Shortcuts for common review scopes: ., staged, and working',
    },
    focusedDiffs: {
      label: 'focused diffs',
      desc: 'Auto-collapse deleted/generated files so you can review signal first',
    },
    webTui: {
      label: 'web + tui',
      desc: 'Choose split/unified views in WebUI or run in terminal with --tui',
    },
  },
  ja: {
    localGithubPr: {
      label: 'ローカル + GitHub PR',
      desc: 'ローカルのコミット/ブランチとGitHub PR URLを1つのワークフローでレビュー',
    },
    stdinFriendly: {
      label: 'stdin対応',
      desc: 'どのツールからでも unified diff をパイプして同じUIで確認',
    },
    aiReviewPrompts: {
      label: 'AIレビュー用プロンプト',
      desc: '行/範囲コメントから Copy Prompt / Copy All でコーディングエージェントへ',
    },
    specialTargets: {
      label: '特別ターゲット',
      desc: 'よく使うレビュー範囲を短縮指定: ., staged, working',
    },
    focusedDiffs: {
      label: '集中できる差分',
      desc: '削除/自動生成ファイルを自動で折りたたみ、重要な変更を先に確認',
    },
    webTui: {
      label: 'web + tui',
      desc: 'WebUIのsplit/unified表示、または --tui でターミナル表示を選択',
    },
  },
  ko: {
    localGithubPr: {
      label: '로컬 + GitHub PR',
      desc: '로컬 커밋/브랜치와 GitHub PR URL을 하나의 흐름에서 리뷰',
    },
    stdinFriendly: {
      label: 'stdin 친화적',
      desc: '어떤 도구의 unified diff도 파이프로 받아 같은 UI에서 확인',
    },
    aiReviewPrompts: {
      label: 'AI 리뷰 프롬프트',
      desc: '줄/범위 코멘트에서 Copy Prompt, Copy All로 코딩 에이전트에 전달',
    },
    specialTargets: {
      label: '특수 타깃',
      desc: '자주 쓰는 리뷰 범위를 축약: ., staged, working',
    },
    focusedDiffs: {
      label: '집중 diff',
      desc: '삭제/생성 파일을 자동으로 접어 중요한 변경부터 확인',
    },
    webTui: {
      label: 'web + tui',
      desc: 'WebUI의 split/unified 보기 또는 --tui 터미널 보기 선택',
    },
  },
  zh: {
    localGithubPr: {
      label: '本地 + GitHub PR',
      desc: '在同一流程中审查本地提交/分支和 GitHub PR URL',
    },
    stdinFriendly: {
      label: '支持 stdin',
      desc: '可将任意工具输出的 unified diff 通过管道送入并在同一 UI 查看',
    },
    aiReviewPrompts: {
      label: 'AI 评审提示词',
      desc: '行/范围评论可用 Copy Prompt、Copy All 发送给编码代理',
    },
    specialTargets: {
      label: '特殊目标',
      desc: '常用评审范围快捷写法：., staged, working',
    },
    focusedDiffs: {
      label: '聚焦差异',
      desc: '自动折叠删除/生成文件，先看关键信号',
    },
    webTui: {
      label: 'web + tui',
      desc: '可在 WebUI 选择 split/unified，或用 --tui 在终端查看',
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
