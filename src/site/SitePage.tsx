import { Copy, Check } from 'lucide-react';
import type { ChangeEvent } from 'react';
import { useEffect, useRef, useState } from 'react';

import type { StaticDiffDataset } from './types/staticDiff';

/* ── Clipboard helper ───────────────────────────────────── */
function CopyBtn({ text, className = '' }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className={`text-github-text-muted hover:text-green-400 transition-colors ${className}`}
      title="Copy"
    >
      {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
    </button>
  );
}

/* ── Prompt line — the $ prefix that ties everything ────── */
function Prompt({ children, dim }: { children?: React.ReactNode; dim?: boolean }) {
  return (
    <div className={`flex items-start gap-0 ${dim ? 'opacity-50' : ''}`}>
      <span className="text-green-400 shrink-0 select-none">$</span>
      <span className="flex-1">
        {'\u00A0'}
        {children}
      </span>
    </div>
  );
}

/* ── Comment block — like a shell comment ───────────────── */
function Comment({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-github-text-muted">
      <span className="text-github-text-muted/60 select-none"># </span>
      {children}
    </p>
  );
}

/* ── Stdout block — indented output ─────────────────────── */
function Stdout({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

/* ── Typewriter for the hero line ───────────────────────── */
function Typewriter({ text, speed = 60 }: { text: string; speed?: number }) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);
  const idx = useRef(0);

  useEffect(() => {
    const timer = setInterval(() => {
      idx.current++;
      setDisplayed(text.slice(0, idx.current));
      if (idx.current >= text.length) {
        clearInterval(timer);
        setDone(true);
      }
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);

  return (
    <span>
      {displayed}
      <span className={`landing-cursor ${done ? 'landing-cursor-blink' : ''}`}>_</span>
    </span>
  );
}

/* ── Feature pane — terminal-like block ─────────────────── */
function wrapFeatureDescription(desc: string, maxChars = 36) {
  if (!desc.includes(' ')) {
    return Array.from({ length: Math.ceil(desc.length / maxChars) }, (_, index) =>
      desc.slice(index * maxChars, (index + 1) * maxChars),
    ).filter((line) => line.length > 0);
  }

  const words = desc.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
      current = word;
      continue;
    }

    lines.push(word);
    current = '';
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

function Feature({ label, desc }: { label: string; desc: string }) {
  const lines = wrapFeatureDescription(desc);

  return (
    <div className="space-y-1">
      <p className="text-cyan-400">&gt; {label}</p>
      {lines.map((line, index) => (
        <p key={`${line}-${index}`} className="text-github-text-secondary">
          ... {line}
        </p>
      ))}
    </div>
  );
}

function formatRevisionLabel(revision: StaticDiffDataset['revisions'][number]) {
  const oneLineMessage = revision.message.split('\n')[0] ?? '';
  const trimmedMessage = oneLineMessage.trim();
  const preview = trimmedMessage.length > 52 ? `${trimmedMessage.slice(0, 52)}...` : trimmedMessage;

  return `[${revision.targetShortHash}] ${preview}`;
}

const LANDING_ASCII = [
  '     _ _  __ _ _',
  '  __| (_)/ _(_) |_',
  ' / _` | | |_| | __|',
  '| (_| | |  _| | |_',
  ' \\__,_|_|_| |_|\\__|',
] as const;

type SiteLanguage = 'en' | 'ja' | 'ko' | 'zh';
type UsageCommentKey =
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

const LANGUAGE_OPTIONS: ReadonlyArray<{ code: SiteLanguage; label: string }> = [
  { code: 'en', label: 'EN' },
  { code: 'ja', label: 'JA' },
  { code: 'ko', label: 'KO' },
  { code: 'zh', label: 'ZH' },
];

const HERO_TEXT: Record<
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

const FEATURES_HEADING: Record<SiteLanguage, string> = {
  en: 'Features',
  ja: '機能',
  ko: '기능',
  zh: '功能',
};

const FEATURE_KEYS: readonly FeatureKey[] = [
  'localGithubPr',
  'stdinFriendly',
  'aiReviewPrompts',
  'specialTargets',
  'focusedDiffs',
  'webTui',
];

const FEATURE_TEXT: Record<SiteLanguage, Record<FeatureKey, { label: string; desc: string }>> = {
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

const USAGE_COMMENT_TEXT: Record<SiteLanguage, Record<UsageCommentKey, string>> = {
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

function renderUsageCommand(cmd: string) {
  return (
    <span>
      {cmd.split(' ').map((part, index, array) => (
        <span key={`${part}-${index}`}>
          {part === 'difit' ? <span className="text-[#f1e927]">{part}</span> : part}
          {index < array.length - 1 ? ' ' : ''}
        </span>
      ))}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════
   Main page — one continuous terminal session
   ═══════════════════════════════════════════════════════════ */
function SitePage() {
  type UsageExample =
    | { type: 'heading'; title: string }
    | { type: 'command'; cmd: string; commentKey: UsageCommentKey; align: boolean };

  const [revisions, setRevisions] = useState<StaticDiffDataset['revisions']>([]);
  const [selectedRevisionId, setSelectedRevisionId] = useState('');
  const [datasetError, setDatasetError] = useState(false);
  const [loadingRevisions, setLoadingRevisions] = useState(true);
  const [language, setLanguage] = useState<SiteLanguage>('en');

  useEffect(() => {
    let canceled = false;

    const loadRevisions = async () => {
      try {
        const response = await fetch('/site-data/diffs.json');
        if (!response.ok) {
          throw new Error(`Failed to load revisions (${response.status})`);
        }

        const dataset = (await response.json()) as StaticDiffDataset;
        if (canceled) return;

        setRevisions(dataset.revisions);

        const queryRevision = new URLSearchParams(window.location.search).get('snapshot');
        const defaultRevisionId =
          dataset.revisions.find((revision) => revision.id === queryRevision)?.id ??
          dataset.initialRevisionId ??
          dataset.revisions[0]?.id ??
          '';

        setSelectedRevisionId(defaultRevisionId);
      } catch (error) {
        if (!canceled) {
          setDatasetError(true);
          setRevisions([]);
          setSelectedRevisionId('');
          console.error('Failed to load static diff dataset:', error);
        }
      } finally {
        if (!canceled) {
          setLoadingRevisions(false);
        }
      }
    };

    void loadRevisions();

    return () => {
      canceled = true;
    };
  }, []);

  const previewUrl = selectedRevisionId
    ? `/preview?snapshot=${encodeURIComponent(selectedRevisionId)}`
    : '/preview';
  const hasRevisionSelector = revisions.length > 0 && !datasetError && !loadingRevisions;
  const browserAddress = 'http://localhost:4966';
  const heroText = HERO_TEXT[language];
  const featureHighlights = FEATURE_KEYS.map((key) => FEATURE_TEXT[language][key]);
  const usageCommentText = USAGE_COMMENT_TEXT[language];

  const usageExamples: UsageExample[] = [
    { type: 'heading', title: '## Basic Usage' },
    { type: 'command', cmd: 'difit <target>', commentKey: 'singleCommitDiff', align: true },
    {
      type: 'command',
      cmd: 'difit <target> [compare-with]',
      commentKey: 'compareTwoTargets',
      align: false,
    },

    { type: 'heading', title: '## Single commit review' },
    { type: 'command', cmd: 'difit', commentKey: 'headCommit', align: true },
    { type: 'command', cmd: 'difit 6f4a9b7', commentKey: 'specificCommit', align: true },
    {
      type: 'command',
      cmd: 'difit feature',
      commentKey: 'featureLatestCommit',
      align: true,
    },

    { type: 'heading', title: '## Compare two commits' },
    { type: 'command', cmd: 'difit @ main', commentKey: 'compareWithMain', align: true },
    { type: 'command', cmd: 'difit foobar main', commentKey: 'compareBranches', align: true },
    {
      type: 'command',
      cmd: 'difit . origin/main',
      commentKey: 'compareWorkingAndRemoteMain',
      align: false,
    },

    { type: 'heading', title: '## Special Arguments' },
    {
      type: 'command',
      cmd: 'difit .',
      commentKey: 'allUncommitted',
      align: true,
    },
    { type: 'command', cmd: 'difit staged', commentKey: 'stagingAreaChanges', align: true },
    { type: 'command', cmd: 'difit working', commentKey: 'unstagedOnly', align: true },

    { type: 'heading', title: '## Others' },
    {
      type: 'command',
      cmd: 'difit --pr https://github.com/owner/repo/pull/123',
      commentKey: 'reviewPrUrl',
      align: false,
    },
    {
      type: 'command',
      cmd: 'diff -u file1.txt file2.txt | difit',
      commentKey: 'viewExternalDiffs',
      align: false,
    },
    {
      type: 'command',
      cmd: 'cat changes.patch | difit',
      commentKey: 'reviewSavedPatches',
      align: false,
    },
  ];

  const handleRevisionChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setSelectedRevisionId(event.target.value);
  };

  return (
    <div className="min-h-screen bg-github-bg-primary font-mono text-sm leading-relaxed text-github-text-primary">
      <div className="fixed top-4 right-4 z-30 rounded-md border border-github-border/70 bg-github-bg-secondary/90 px-3 py-1.5 backdrop-blur-sm">
        <div className="flex items-center text-xs">
          {LANGUAGE_OPTIONS.map((option, index) => (
            <div key={option.code} className="flex items-center">
              {index > 0 ? (
                <span className="px-1 text-github-text-muted/70 select-none" aria-hidden>
                  |
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => setLanguage(option.code)}
                aria-label={option.label}
                aria-pressed={language === option.code}
                className={`transition-colors ${
                  language === option.code
                    ? 'text-github-text-primary'
                    : 'text-github-text-muted hover:text-github-text-secondary'
                }`}
              >
                {option.label}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* narrow = terminal text sections, wide = iframe demo */}
      {/* ── ASCII logo / intro ─────────────────────────── */}
      <section className="w-[90vw] max-w-[1000px] mx-auto pt-10 space-y-2">
        <Prompt>
          <span className="text-github-text-primary">find</span>{' '}
          <span className="text-github-text-secondary">&quot;the best local review tool&quot;</span>
        </Prompt>
        <div>
          <pre className="text-green-400 text-xs sm:text-sm leading-tight whitespace-pre select-none landing-ascii">
            {LANDING_ASCII.join('\n')}
          </pre>
        </div>
        <div>
          <p className="text-lg sm:text-xl text-github-text-primary mt-4">
            <Typewriter key={language} text={heroText.catchCopy} speed={45} />
          </p>
        </div>
        <div className="mt-2">
          <p className="text-github-text-secondary">
            {heroText.description[0]}
            <br />
            {heroText.description[1]}
          </p>
        </div>
      </section>

      <hr className="w-[90vw] max-w-[1000px] mx-auto border-github-border my-6" />

      {/* ── Quick start ──────────────────────────────── */}
      <section className="w-[90vw] max-w-[1000px] mx-auto space-y-2">
        <Comment>Try it now — no install required</Comment>
        <div className="flex items-center gap-2">
          <Prompt>
            <span className="text-github-text-primary">cd</span>{' '}
            <span className="text-github-text-secondary">/your/project</span>
          </Prompt>
        </div>
        <div className="flex items-center gap-2">
          <Prompt>
            <span className="text-[#f1e927]">npx</span>{' '}
            <span className="text-[#f1e927]">difit</span>
          </Prompt>
          <CopyBtn text="npx difit" />
        </div>
        <Stdout className="pl-0">
          <span className="text-github-text-muted">
            {'\u00A0\u00A0'}Opening diff viewer on{' '}
            <a
              href="/preview"
              target="_blank"
              rel="noreferrer"
              className="text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              {browserAddress}
            </a>{' '}
            ...
          </span>
        </Stdout>
      </section>

      <hr className="w-[90vw] max-w-[1000px] mx-auto border-github-border my-6" />

      {/* ── Live demo ────────────────────────────────── */}
      <section className="w-[90vw] max-w-[1000px] mx-auto space-y-2">
        <Comment>Here&apos;s what you&apos;ll see ↓</Comment>
      </section>
      <div className="w-[90vw] mx-auto mt-3 relative group/demo">
        <div className="rounded-xl overflow-hidden border border-[#d1d5db] shadow-lg">
          {/* Browser chrome — light theme */}
          <div className="flex items-center gap-2 px-4 py-2.5 bg-[#d5d7db] border-b border-[#bfc3c8]">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
              <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
              <div className="w-3 h-3 rounded-full bg-[#28c840]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="ml-1 px-4 py-1 rounded-md bg-white text-[11px] text-[#9ca3af] font-mono border border-[#e5e7eb]">
                {browserAddress}
              </div>
            </div>
            {hasRevisionSelector && (
              <label className="ml-6 flex items-center gap-2 text-[11px] text-[#6b7280] whitespace-nowrap">
                Revision:
                <select
                  value={selectedRevisionId}
                  onChange={handleRevisionChange}
                  className="max-w-[340px] border border-[#d1d5db] bg-white rounded text-[11px] text-[#6b7280] px-2 py-1"
                  aria-label="Revision"
                >
                  {revisions.map((revision) => (
                    <option key={revision.id} value={revision.id}>
                      {formatRevisionLabel(revision)}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <iframe
            title="difit live preview"
            src={previewUrl}
            loading="eager"
            className="w-full bg-white"
            style={{ height: '70vh', minHeight: '500px' }}
          />
        </div>
        {/* Hover tooltip — outside top-right */}
        <div className="absolute -top-12 right-4 opacity-0 group-hover/demo:opacity-100 transition-opacity duration-300 pointer-events-none z-10">
          <div className="landing-bubble-down px-4 py-2.5 rounded-xl bg-green-500 text-white text-sm font-bold shadow-lg whitespace-nowrap">
            Try leaving a comment!
          </div>
        </div>
      </div>

      <hr className="w-[90vw] max-w-[1000px] mx-auto border-github-border my-6" />

      {/* ── Install ──────────────────────────────────── */}
      <section className="w-[90vw] max-w-[1000px] mx-auto space-y-2">
        <Comment>Or install globally</Comment>
        <div className="flex items-center gap-2">
          <Prompt>
            <span className="text-github-text-primary">npm</span> install -g{' '}
            <span className="text-[#f1e927]">difit</span>
          </Prompt>
          <CopyBtn text="npm install -g difit" />
        </div>
        <Stdout>
          <span className="text-github-text-muted">
            added 1 package in 3s
            <br />
            Requires <span className="text-github-text-secondary">Node.js ≥ 21</span> and{' '}
            <span className="text-github-text-secondary">git</span>
          </span>
        </Stdout>
      </section>

      {/* ── Features as --help output ────────────────── */}
      <section className="w-[92vw] md:w-[70vw] max-w-[1100px] mx-auto my-6 space-y-2">
        <Stdout>
          <div className="mt-1 border border-github-border/70 rounded-md bg-github-bg-secondary/30">
            <div className="flex items-center gap-3 px-3 sm:px-4 py-2">
              <span className="h-px flex-1 bg-github-border/70" aria-hidden />
              <span className="text-[11px] tracking-[0.18em] uppercase text-github-text-muted/80">
                {FEATURES_HEADING[language]}
              </span>
              <span className="h-px flex-1 bg-github-border/70" aria-hidden />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 px-2 sm:px-3 pb-1">
              {featureHighlights.map((feature, index) => (
                <div
                  key={feature.label}
                  className={[
                    'px-3 py-2.5 border-github-border/70',
                    index > 0 ? 'border-t' : '',
                    index >= 2 ? 'sm:border-t' : 'sm:border-t-0',
                    index % 2 === 1 ? 'sm:border-l' : 'sm:border-l-0',
                    index >= 3 ? 'lg:border-t' : 'lg:border-t-0',
                    index % 3 === 0 ? 'lg:border-l-0' : 'lg:border-l',
                  ].join(' ')}
                >
                  <p className="text-github-text-muted/80 text-[11px] mb-1">
                    {`[${String(index + 1).padStart(2, '0')}]`}
                  </p>
                  <Feature label={feature.label} desc={feature.desc} />
                </div>
              ))}
            </div>
          </div>
        </Stdout>
      </section>

      {/* ── Usage examples as actual commands ────────── */}
      <section className="w-[90vw] max-w-[1000px] mx-auto space-y-2">
        <Comment>Usage examples</Comment>
        <div className="space-y-3 mt-1">
          {usageExamples.map((entry) =>
            entry.type === 'heading' ? (
              <p key={entry.title} className="text-github-text-muted">
                {entry.title}
              </p>
            ) : (
              <div key={entry.cmd} className="flex items-center gap-3">
                <Prompt>
                  {entry.align ? (
                    <span className="inline-block w-[18ch]">{renderUsageCommand(entry.cmd)}</span>
                  ) : (
                    <span>{renderUsageCommand(entry.cmd)}</span>
                  )}
                  <span className="text-github-text-secondary">
                    {entry.align ? '' : '\u00A0\u00A0'}# {usageCommentText[entry.commentKey]}
                  </span>
                </Prompt>
              </div>
            ),
          )}
        </div>
      </section>

      <hr className="w-[90vw] max-w-[1000px] mx-auto border-github-border my-6" />

      {/* ── Links / footer ───────────────────────────── */}
      <section className="w-[90vw] max-w-[1000px] mx-auto space-y-2">
        <Prompt>
          <span className="text-github-text-primary">echo</span>{' '}
          <span className="text-github-text-secondary">&quot;MIT License&quot;</span>
        </Prompt>
        <Prompt>
          <span className="text-github-text-primary">open</span>{' '}
          <a
            href="https://github.com/yoshiko-pg/difit"
            className="text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            https://github.com/yoshiko-pg/difit
          </a>
          <span className="text-github-text-muted ml-3"># Star on GitHub ⭐️</span>
        </Prompt>
      </section>

      {/* Blinking cursor at the end */}
      <div className="w-[90vw] max-w-[1000px] mx-auto flex items-center gap-3 pt-4 pb-10">
        <span className="text-green-400">$</span>
        <span className="landing-cursor landing-cursor-blink">_</span>
      </div>
    </div>
  );
}

export default SitePage;
