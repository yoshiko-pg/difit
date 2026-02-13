import {
  Terminal,
  MessageSquare,
  GitCompare,
  Copy,
  Sparkles,
  Eye,
  Keyboard,
  Github,
  Check,
  ArrowRight,
} from 'lucide-react';
import { useState } from 'react';

function CopyButton({ text, className = '' }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className={`text-github-text-muted hover:text-github-text-primary transition-colors ${className}`}
      title="Copy to clipboard"
    >
      {copied ?
        <Check size={14} className="text-green-400" />
      : <Copy size={14} />}
    </button>
  );
}

/* ── Bento cell wrapper ─────────────────────────────────── */
function Cell({
  children,
  className = '',
  accent,
}: {
  children: React.ReactNode;
  className?: string;
  accent?: 'green' | 'cyan' | 'purple';
}) {
  const accentGradient = {
    green: 'from-green-500/8 to-transparent',
    cyan: 'from-cyan-500/8 to-transparent',
    purple: 'from-purple-500/8 to-transparent',
  };

  return (
    <div
      className={`relative rounded-2xl border border-github-border bg-github-bg-secondary/40 overflow-hidden ${className}`}
    >
      {accent && (
        <div
          className={`absolute inset-0 bg-gradient-to-br ${accentGradient[accent]} pointer-events-none`}
        />
      )}
      <div className="relative h-full">{children}</div>
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────── */
function SitePage() {
  return (
    <div className="min-h-screen bg-github-bg-primary text-github-text-primary">
      {/* Subtle ambient glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-b from-green-500/6 via-cyan-500/3 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="relative w-[90vw] max-w-[1400px] mx-auto py-6 space-y-3">
        {/* ── Row 1: Hero headline + CTA + GitHub ────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_auto] gap-3">
          {/* Headline */}
          <Cell className="p-8 lg:p-10 flex items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-green-500/30 bg-green-500/10 text-green-400 text-[11px] font-medium tracking-wide uppercase mb-5">
                <Sparkles size={11} />
                Code review for the AI era
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.08]">
                <span className="landing-gradient-text">Beautiful diffs.</span>
                <br />
                Right in your terminal.
              </h1>
              <p className="mt-4 text-github-text-secondary text-base max-w-lg leading-relaxed">
                GitHub-style diff viewer for local git. Review code, add comments, copy AI
                prompts&nbsp;&mdash; all from one command.
              </p>
            </div>
          </Cell>

          {/* npx CTA */}
          <Cell
            className="p-6 flex flex-col items-center justify-center min-w-[220px]"
            accent="green"
          >
            <span className="text-[11px] text-github-text-muted uppercase tracking-wider mb-3">
              Try it now
            </span>
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-green-500 to-cyan-500 rounded-xl opacity-50 group-hover:opacity-100 blur-sm transition-opacity" />
              <div className="relative flex items-center gap-3 px-5 py-3 rounded-xl bg-github-bg-primary font-mono text-lg">
                <span className="text-green-400">$</span>
                <span>npx difit</span>
                <CopyButton text="npx difit" className="ml-1" />
              </div>
            </div>
            <span className="text-[11px] text-github-text-muted mt-3">No install required</span>
          </Cell>

          {/* GitHub link card */}
          <a href="https://github.com/because-and/difit" className="group">
            <Cell className="p-6 flex flex-col items-center justify-center h-full min-w-[140px] hover:border-github-text-muted transition-colors">
              <Github
                size={28}
                className="text-github-text-secondary group-hover:text-github-text-primary transition-colors mb-2"
              />
              <span className="text-xs text-github-text-muted group-hover:text-github-text-secondary transition-colors">
                Star on GitHub
              </span>
              <ArrowRight
                size={14}
                className="mt-2 text-github-text-muted opacity-0 group-hover:opacity-100 transition-opacity"
              />
            </Cell>
          </a>
        </div>

        {/* ── Row 2: Live Demo (full width, hero element) ── */}
        <Cell className="landing-demo-glow">
          {/* Browser chrome */}
          <div className="flex items-center gap-2 px-4 py-2.5 bg-github-bg-secondary/60 border-b border-github-border">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
            </div>
            <div className="flex-1 flex justify-center">
              <div className="px-3 py-0.5 rounded-md bg-github-bg-primary/60 text-[11px] text-github-text-muted font-mono">
                localhost:4966
              </div>
            </div>
          </div>
          <iframe
            title="difit live preview"
            src="/preview"
            loading="eager"
            className="w-full bg-github-bg-primary"
            style={{ height: '70vh', minHeight: '500px' }}
          />
        </Cell>

        {/* ── Row 3: Feature bento tiles ─────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* GitHub Diffs - tall */}
          <Cell className="p-6 md:row-span-2" accent="green">
            <GitCompare size={20} className="text-green-400 mb-4" />
            <h3 className="text-lg font-bold mb-2">GitHub-Style Diffs</h3>
            <p className="text-sm text-github-text-secondary leading-relaxed mb-4">
              Split &amp; unified views with syntax highlighting for 30+ languages.
            </p>
            <div className="mt-auto space-y-1.5 font-mono text-xs text-github-text-muted">
              <div className="flex gap-2">
                <span className="text-green-400">+</span>
                <span className="text-green-400/70">const result = compute();</span>
              </div>
              <div className="flex gap-2">
                <span className="text-red-400">-</span>
                <span className="text-red-400/70">const result = oldFunc();</span>
              </div>
              <div className="flex gap-2">
                <span className="text-github-text-muted">&nbsp;</span>
                <span>return result;</span>
              </div>
            </div>
          </Cell>

          {/* Review Comments */}
          <Cell className="p-6" accent="cyan">
            <MessageSquare size={20} className="text-cyan-400 mb-4" />
            <h3 className="text-lg font-bold mb-2">Review Comments</h3>
            <p className="text-sm text-github-text-secondary leading-relaxed">
              Click any line to comment. Drag to select ranges. Persistent in your browser.
            </p>
          </Cell>

          {/* Commands - tall, spans 2 rows */}
          <Cell className="p-6 md:row-span-2 lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <Terminal size={18} className="text-github-text-muted" />
              <span className="text-[11px] text-github-text-muted uppercase tracking-wider font-medium">
                Flexible diff targets
              </span>
            </div>
            <div className="space-y-2.5 font-mono text-sm">
              {[
                { cmd: 'difit', desc: 'Latest commit' },
                { cmd: 'difit @ main', desc: 'Compare with main' },
                { cmd: 'difit .', desc: 'Uncommitted changes' },
                { cmd: 'difit staged', desc: 'Staging area' },
                { cmd: 'difit --pr <url>', desc: 'GitHub PR review' },
                { cmd: 'cat patch | difit', desc: 'Pipe any diff' },
              ].map(({ cmd, desc }) => (
                <div
                  key={cmd}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg bg-github-bg-primary/50 group"
                >
                  <span className="text-green-400 shrink-0">$</span>
                  <span className="text-github-text-primary">{cmd}</span>
                  <span className="ml-auto text-xs text-github-text-muted hidden sm:block">
                    {desc}
                  </span>
                </div>
              ))}
            </div>
          </Cell>

          {/* AI Prompt */}
          <Cell className="p-6" accent="purple">
            <Sparkles size={20} className="text-purple-400 mb-4" />
            <h3 className="text-lg font-bold mb-2">AI Prompt Copy</h3>
            <p className="text-sm text-github-text-secondary leading-relaxed">
              Comments become structured prompts. One click to Claude, GPT, or any AI agent.
            </p>
          </Cell>
        </div>

        {/* ── Row 4: Bottom tiles ────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* PR Review */}
          <Cell className="p-6">
            <Eye size={18} className="text-github-text-muted mb-3" />
            <h3 className="font-bold mb-1">PR Review</h3>
            <p className="text-sm text-github-text-secondary">
              Review GitHub PRs locally. Enterprise Server supported.
            </p>
          </Cell>

          {/* Keyboard */}
          <Cell className="p-6">
            <Keyboard size={18} className="text-github-text-muted mb-3" />
            <h3 className="font-bold mb-1">Keyboard-First</h3>
            <p className="text-sm text-github-text-secondary">
              Full vim-style navigation.{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-github-bg-tertiary text-xs font-mono">j</kbd>{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-github-bg-tertiary text-xs font-mono">k</kbd>{' '}
              to move,{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-github-bg-tertiary text-xs font-mono">c</kbd>{' '}
              to comment.
            </p>
          </Cell>

          {/* Install */}
          <Cell className="p-6" accent="green">
            <span className="text-[11px] text-github-text-muted uppercase tracking-wider font-medium">
              Install globally
            </span>
            <div className="relative mt-3">
              <pre className="px-4 py-3 rounded-xl bg-github-bg-primary/60 font-mono text-sm pr-10">
                <span className="text-github-text-muted">$ </span>
                <span className="text-green-400">npm</span> install -g difit
              </pre>
              <CopyButton
                text="npm install -g difit"
                className="absolute right-3 top-1/2 -translate-y-1/2"
              />
            </div>
            <p className="text-xs text-github-text-muted mt-3">Requires Node.js 21+ &amp; git</p>
          </Cell>
        </div>

        {/* ── Footer ─────────────────────────────────── */}
        <footer className="flex items-center justify-between pt-4 pb-2 text-xs text-github-text-muted">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="difit" className="h-4 invert opacity-40" />
            <span>MIT License</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://www.npmjs.com/package/difit"
              className="hover:text-github-text-secondary transition-colors"
            >
              npm
            </a>
            <a
              href="https://github.com/because-and/difit"
              className="hover:text-github-text-secondary transition-colors"
            >
              GitHub
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default SitePage;
