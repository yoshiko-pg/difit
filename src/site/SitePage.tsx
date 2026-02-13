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
      {copied ?
        <Check size={13} className="text-green-400" />
      : <Copy size={13} />}
    </button>
  );
}

/* ── Prompt line — the $ prefix that ties everything ────── */
function Prompt({ children, dim }: { children?: React.ReactNode; dim?: boolean }) {
  return (
    <div className={`flex items-start gap-3 ${dim ? 'opacity-50' : ''}`}>
      <span className="text-green-400 shrink-0 select-none">$</span>
      <span className="flex-1">{children}</span>
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
  return <div className={`pl-6 ${className}`}>{children}</div>;
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

/* ── Feature line — compact single-line feature ─────────── */
function Feature({ label, desc }: { label: string; desc: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-cyan-400 shrink-0">{label}</span>
      <span className="text-github-text-muted">—</span>
      <span className="text-github-text-secondary">{desc}</span>
    </div>
  );
}

function formatRevisionLabel(revision: StaticDiffDataset['revisions'][number]) {
  const oneLineMessage = revision.message.split('\n')[0] ?? '';
  const trimmedMessage = oneLineMessage.trim();
  const preview = trimmedMessage.length > 52 ? `${trimmedMessage.slice(0, 52)}...` : trimmedMessage;

  return `${revision.baseShortHash}...${revision.targetShortHash} (${revision.authorName}) ${preview}`;
}

/* ═══════════════════════════════════════════════════════════
   Main page — one continuous terminal session
   ═══════════════════════════════════════════════════════════ */
function SitePage() {
  const [revisions, setRevisions] = useState<StaticDiffDataset['revisions']>([]);
  const [selectedRevisionId, setSelectedRevisionId] = useState('');
  const [datasetError, setDatasetError] = useState(false);
  const [loadingRevisions, setLoadingRevisions] = useState(true);

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

  const previewUrl =
    selectedRevisionId ? `/preview?snapshot=${encodeURIComponent(selectedRevisionId)}` : '/preview';
  const hasRevisionSelector = revisions.length > 0 && !datasetError && !loadingRevisions;
  const browserAddress = 'http://localhost:4966';

  const handleRevisionChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setSelectedRevisionId(event.target.value);
  };

  return (
    <div className="min-h-screen bg-github-bg-primary font-mono text-sm leading-relaxed text-github-text-primary">
      {/* narrow = terminal text sections, wide = iframe demo */}
      {/* ── ASCII logo / intro ─────────────────────────── */}
      <section className="w-[90vw] max-w-[1000px] mx-auto pt-10 space-y-2">
        <Prompt>
          <span className="text-yellow-300">cd</span> /your/project
        </Prompt>
        <div>
          <pre className="text-green-400 text-xs sm:text-sm leading-tight whitespace-pre select-none landing-ascii">
            {`     _ _  __ _ _
  __| (_)/ _(_) |_
 / _\` | | |_| | __|
| (_| | |  _| | |_
 \\__,_|_|_| |_|\\__|`}
          </pre>
        </div>
        <div>
          <p className="text-lg sm:text-xl text-github-text-primary mt-4">
            <Typewriter text="Beautiful diffs. Right in your terminal." speed={45} />
          </p>
        </div>
        <div className="mt-2">
          <p className="text-github-text-secondary">
            GitHub-style diff viewer for local git. Review code, add comments,
            <br />
            copy AI prompts — all from one command.
          </p>
        </div>
      </section>

      <hr className="w-[90vw] max-w-[1000px] mx-auto border-github-border my-6" />

      {/* ── Quick start ──────────────────────────────── */}
      <section className="w-[90vw] max-w-[1000px] mx-auto space-y-2">
        <Comment>Try it now — no install required</Comment>
        <div className="flex items-center gap-2">
          <Prompt>
            <span className="text-green-400">npx</span> difit
          </Prompt>
          <CopyBtn text="npx difit" />
        </div>
        <Stdout>
          <span className="text-github-text-muted">
            Opening diff viewer on <span className="text-cyan-400">http://localhost:4966</span> ...
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
          <div className="flex items-center gap-2 px-4 py-2.5 bg-[#f0f0f0] border-b border-[#d1d5db]">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="px-4 py-1 rounded-md bg-white text-[11px] text-[#6b7280] font-mono border border-[#e5e7eb]">
                {browserAddress}
              </div>
            </div>
            {hasRevisionSelector && (
              <label className="flex items-center gap-3 text-[11px] text-[#6b7280] whitespace-nowrap">
                Revision:
                <select
                  value={selectedRevisionId}
                  onChange={handleRevisionChange}
                  className="max-w-[340px] border border-[#d1d5db] bg-white rounded text-[11px] text-[#111827] px-2 py-1"
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

      {/* ── Features as --help output ────────────────── */}
      <section className="w-[90vw] max-w-[1000px] mx-auto space-y-2">
        <Prompt>
          difit <span className="text-yellow-300">--help</span>
        </Prompt>
        <Stdout>
          <div className="space-y-4 mt-1">
            <p className="text-github-text-primary font-bold">FEATURES</p>
            <div className="space-y-2 pl-2">
              <Feature
                label="split & unified"
                desc="GitHub-style diff views with 30+ language syntax highlighting"
              />
              <Feature
                label="review comments"
                desc="Click any line to comment. Drag to select ranges. Saved in browser"
              />
              <Feature
                label="AI prompt copy"
                desc="One-click copy as structured prompts for Claude, GPT, or any agent"
              />
              <Feature
                label="PR review"
                desc="Pass a GitHub PR URL, review locally. Enterprise Server supported"
              />
              <Feature
                label="keyboard-first"
                desc="Vim-style j/k navigation. c to comment, ? for all shortcuts"
              />
              <Feature
                label="zero config"
                desc="No setup, no config files. Works in any git repo"
              />
            </div>
          </div>
        </Stdout>
      </section>

      <hr className="w-[90vw] max-w-[1000px] mx-auto border-github-border my-6" />

      {/* ── Usage examples as actual commands ────────── */}
      <section className="w-[90vw] max-w-[1000px] mx-auto space-y-2">
        <Comment>Usage examples</Comment>
        <div className="space-y-3 mt-1">
          {[
            { cmd: 'difit', comment: 'latest commit' },
            { cmd: 'difit @ main', comment: 'compare with main branch' },
            { cmd: 'difit .', comment: 'all uncommitted changes' },
            { cmd: 'difit staged', comment: 'staging area only' },
            {
              cmd: 'difit --pr https://github.com/org/repo/pull/42',
              comment: 'review a PR locally',
            },
            { cmd: 'cat changes.patch | difit', comment: 'pipe in any diff' },
          ].map(({ cmd, comment }) => (
            <div key={cmd} className="flex items-center gap-3">
              <Prompt>
                {cmd}
                <span className="text-github-text-muted/50 ml-3">
                  {'  '}# {comment}
                </span>
              </Prompt>
            </div>
          ))}
        </div>
      </section>

      <hr className="w-[90vw] max-w-[1000px] mx-auto border-github-border my-6" />

      {/* ── Install ──────────────────────────────────── */}
      <section className="w-[90vw] max-w-[1000px] mx-auto space-y-2">
        <Comment>Or install globally</Comment>
        <div className="flex items-center gap-2">
          <Prompt>
            <span className="text-green-400">npm</span> install -g difit
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

      <hr className="w-[90vw] max-w-[1000px] mx-auto border-github-border my-6" />

      {/* ── Links / footer ───────────────────────────── */}
      <section className="w-[90vw] max-w-[1000px] mx-auto space-y-2">
        <Prompt dim>
          <span className="text-yellow-300">echo</span>{' '}
          <span className="text-github-text-secondary">&quot;MIT License&quot;</span>
        </Prompt>
        <Stdout>
          <div className="flex items-center gap-6 text-github-text-muted">
            <a
              href="https://github.com/because-and/difit"
              className="hover:text-github-text-secondary transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://www.npmjs.com/package/difit"
              className="hover:text-github-text-secondary transition-colors"
            >
              npm
            </a>
            <span>MIT License</span>
          </div>
        </Stdout>
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
