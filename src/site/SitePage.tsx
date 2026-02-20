import { Copy, Check } from 'lucide-react';
import type { ChangeEvent } from 'react';
import { useEffect, useRef, useState } from 'react';

import {
  FEATURE_KEYS,
  FEATURES_HEADING,
  FEATURE_TEXT,
  HERO_TEXT,
  LANGUAGE_OPTIONS,
  USAGE_COMMENT_TEXT,
  type SiteLanguage,
  type UsageCommentKey,
} from './sitePageContent';
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
