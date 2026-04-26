/* oxlint-disable react-hooks-js/refs */
// @floating-ui/react uses callback refs which trigger false positives in react-hooks/refs rule.
import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  safePolygon,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useHover,
  useInteractions,
  useRole,
} from '@floating-ui/react';
import { Check, ChevronDown, Copy, GitBranch } from 'lucide-react';
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
  if (revision.demoTitle) {
    return revision.demoTitle;
  }

  const oneLineMessage = revision.message.split('\n')[0] ?? '';
  const trimmedMessage = oneLineMessage.trim();
  const preview = trimmedMessage.length > 52 ? `${trimmedMessage.slice(0, 52)}...` : trimmedMessage;

  return `[${revision.targetShortHash}] ${preview}`;
}

function RevisionQuickMenu({
  revisions,
  selectedRevisionId,
  onSelectRevision,
}: {
  revisions: StaticDiffDataset['revisions'];
  selectedRevisionId: string;
  onSelectRevision: (revisionId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedRevision =
    revisions.find((revision) => revision.id === selectedRevisionId) ?? revisions[0];
  const currentLabel = selectedRevision ? formatRevisionLabel(selectedRevision) : 'Select...';

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement: 'bottom-end',
    middleware: [offset(6), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  const hover = useHover(context, {
    handleClose: safePolygon(),
  });
  const click = useClick(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: 'menu' });

  const { getReferenceProps, getFloatingProps } = useInteractions([hover, click, dismiss, role]);

  const getItemClasses = (highlighted: boolean) => {
    const highlightClasses = highlighted
      ? 'bg-[#d5d7db] border-l-4 border-l-[#9ca3af] font-semibold pl-2'
      : '';
    const hoverClasses = highlighted
      ? 'hover:bg-[#d5d7db] focus:bg-[#d5d7db]'
      : 'hover:bg-[#eef0f2] focus:bg-[#eef0f2]';

    return [
      'w-full text-left px-3 py-2 text-xs focus:outline-none transition-colors cursor-pointer text-[#4b5563]',
      hoverClasses,
      highlightClasses,
    ].join(' ');
  };

  const handleSelect = (revisionId: string) => {
    onSelectRevision(revisionId);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        ref={refs.setReference}
        type="button"
        className="flex items-center gap-1 cursor-pointer group"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`Revision menu: ${currentLabel}`}
        title={currentLabel}
        {...getReferenceProps()}
      >
        <div className="flex items-center gap-1 px-2 py-1 bg-white border border-[#d1d5db] rounded hover:bg-[#eef0f2] hover:border-[#bfc3c8] transition-colors max-w-[360px]">
          <GitBranch size={12} className="text-[#6b7280] shrink-0" />
          <code className="text-[11px] text-[#4b5563] truncate">{currentLabel}</code>
          <ChevronDown
            size={12}
            className="text-[#6b7280] group-hover:text-[#374151] transition-colors shrink-0"
          />
        </div>
      </button>

      {isOpen && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            className="bg-white border border-[#bfc3c8] rounded shadow-lg z-50 w-[360px] max-h-[360px] overflow-y-auto"
            {...getFloatingProps()}
          >
            <div className="px-3 py-2 text-xs font-semibold text-[#4b5563] bg-[#d5d7db] border-b border-[#bfc3c8]">
              Quick Diffs
            </div>
            {revisions.map((revision) => {
              const isSelected = revision.id === selectedRevisionId;
              const oneLineMessage = revision.message.split('\n')[0]?.trim() || revision.id;
              const primaryLabel = revision.demoTitle ?? oneLineMessage;

              return (
                <button
                  key={revision.id}
                  onClick={() => handleSelect(revision.id)}
                  className={getItemClasses(isSelected)}
                  type="button"
                >
                  <div className="flex items-start gap-2">
                    <code className="text-xs text-[#374151] font-mono whitespace-nowrap">
                      {revision.targetShortHash}
                    </code>
                    <span className="text-xs text-[#6b7280] flex-1 break-words">
                      <span className="block text-[#374151]">{primaryLabel}</span>
                      {revision.demoDescription && (
                        <span className="mt-0.5 block leading-snug">
                          {revision.demoDescription}
                        </span>
                      )}
                      {revision.demoTitle && (
                        <span className="mt-0.5 block leading-snug">{oneLineMessage}</span>
                      )}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </FloatingPortal>
      )}
    </div>
  );
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
  const [activeFeatureIndex, setActiveFeatureIndex] = useState(0);

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
  const resolvedFeatureIndex =
    activeFeatureIndex < featureHighlights.length ? activeFeatureIndex : 0;
  const activeFeature = featureHighlights[resolvedFeatureIndex] ?? {
    tab: 'fallback',
    label: '',
    desc: '',
  };
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
              <div className="ml-6 flex items-center gap-2 text-[11px] text-[#6b7280] whitespace-nowrap">
                <span>Revision:</span>
                <RevisionQuickMenu
                  revisions={revisions}
                  selectedRevisionId={selectedRevisionId}
                  onSelectRevision={setSelectedRevisionId}
                />
              </div>
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
      </section>

      <section className="w-[90vw] max-w-[1000px] mx-auto mt-6 space-y-2">
        <Comment>Recommended: Install skills</Comment>
        <div className="flex items-center gap-2">
          <Prompt>
            <span className="text-github-text-primary">npx skills add </span>
            <span className="text-[#f1e927]">yoshiko-pg/difit</span>
          </Prompt>
          <CopyBtn text="npx skills add yoshiko-pg/difit" />
        </div>
      </section>

      {/* ── Features as --help output ────────────────── */}
      <section className="w-full max-w-[92vw] md:max-w-[clamp(0px,70vw,1100px)] mx-auto my-6 space-y-2">
        <Stdout>
          <div className="mt-1 border border-github-border rounded-md bg-github-bg-secondary/30 overflow-hidden">
            <div className="border-b border-github-border bg-[#343a42]/70">
              <div className="overflow-x-auto">
                <div
                  className="flex min-w-max text-[11px] leading-none"
                  role="tablist"
                  aria-label={FEATURES_HEADING[language]}
                >
                  {featureHighlights.map((feature, index) => (
                    <button
                      key={feature.tab}
                      type="button"
                      role="tab"
                      id={`feature-tab-${index}`}
                      aria-selected={resolvedFeatureIndex === index}
                      aria-controls={`feature-panel-${index}`}
                      onClick={() => setActiveFeatureIndex(index)}
                      className={[
                        'px-3 py-2 border-r border-github-border whitespace-nowrap',
                        resolvedFeatureIndex === index
                          ? 'text-[#ff7b1a] bg-github-bg-secondary/40'
                          : 'text-github-text-muted/75 bg-transparent',
                      ].join(' ')}
                    >
                      {`${index + 1}:${feature.tab}${resolvedFeatureIndex === index ? '*' : ''}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div
              id={`feature-panel-${resolvedFeatureIndex}`}
              role="tabpanel"
              aria-labelledby={`feature-tab-${resolvedFeatureIndex}`}
              className="px-4 sm:px-5 py-3"
            >
              <p className="text-github-text-muted/80 text-[11px] mb-1">
                {`[${String(resolvedFeatureIndex + 1).padStart(2, '0')}]`}
              </p>
              <Feature label={activeFeature.label} desc={activeFeature.desc} />
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
