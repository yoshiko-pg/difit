import {
  Terminal,
  MessageSquare,
  GitCompare,
  Copy,
  Eye,
  Keyboard,
  Github,
  ChevronRight,
  Sparkles,
  Zap,
  Check,
} from 'lucide-react';
import { useState } from 'react';

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-github-text-muted hover:text-github-text-primary transition-colors"
      title="Copy to clipboard"
    >
      {copied ?
        <Check size={16} className="text-green-400" />
      : <Copy size={16} />}
    </button>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="group relative p-6 rounded-xl border border-github-border bg-github-bg-secondary/50 hover:border-green-500/50 hover:bg-github-bg-secondary transition-all duration-300">
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-green-500/5 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="relative">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-green-500/10 text-green-400 mb-4">
          {icon}
        </div>
        <h3 className="text-lg font-bold text-github-text-primary mb-2">{title}</h3>
        <p className="text-sm text-github-text-secondary leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function UsageExample({ command, description }: { command: string; description: string }) {
  return (
    <div className="flex items-start gap-3 group">
      <ChevronRight
        size={16}
        className="mt-1 text-green-500 shrink-0 group-hover:translate-x-0.5 transition-transform"
      />
      <div>
        <code className="text-sm font-mono text-green-400">{command}</code>
        <p className="text-xs text-github-text-muted mt-0.5">{description}</p>
      </div>
    </div>
  );
}

function SitePage() {
  return (
    <div className="min-h-screen bg-github-bg-primary text-github-text-primary">
      {/* Gradient background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-b from-green-500/8 via-cyan-500/4 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-gradient-to-tl from-purple-500/5 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="relative">
        {/* Nav */}
        <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="difit" className="h-8 invert" />
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://www.npmjs.com/package/difit"
              className="text-sm text-github-text-secondary hover:text-github-text-primary transition-colors"
            >
              npm
            </a>
            <a
              href="https://github.com/because-and/difit"
              className="flex items-center gap-1.5 text-sm text-github-text-secondary hover:text-github-text-primary transition-colors"
            >
              <Github size={16} />
              GitHub
            </a>
          </div>
        </nav>

        {/* Hero */}
        <section className="px-6 pt-16 pb-8 max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-green-500/30 bg-green-500/10 text-green-400 text-xs font-medium mb-8">
            <Sparkles size={12} />
            The local code review tool for the AI era
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.1] mb-6">
            <span className="landing-gradient-text">Beautiful diffs.</span>
            <br />
            <span className="text-github-text-primary">Right in your terminal.</span>
          </h1>

          <p className="text-lg sm:text-xl text-github-text-secondary max-w-2xl mx-auto mb-10 leading-relaxed">
            GitHub-style diff viewer for local git.
            <br className="hidden sm:block" />
            Review code, add comments, copy AI prompts — all from{' '}
            <code className="px-1.5 py-0.5 rounded bg-github-bg-tertiary text-green-400 text-base font-mono">
              npx
            </code>
            .
          </p>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-green-500 to-cyan-500 rounded-lg opacity-60 group-hover:opacity-100 blur-sm transition-opacity" />
              <div className="relative flex items-center gap-3 px-6 py-3 pr-12 rounded-lg bg-github-bg-primary font-mono text-lg">
                <span className="text-green-400">$</span>
                <span className="text-github-text-primary">npx difit</span>
                <CopyButton text="npx difit" />
              </div>
            </div>
          </div>
          <p className="text-xs text-github-text-muted">
            No install required. Just run it in any git repo.
          </p>
        </section>

        {/* Live Demo */}
        <section className="py-16 mx-auto" style={{ width: '90vw', maxWidth: '90vw' }}>
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 text-sm text-github-text-muted mb-3">
              <Zap size={14} className="text-yellow-400" />
              Live interactive demo
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold">See it in action</h2>
          </div>

          <div className="relative rounded-xl overflow-hidden border border-github-border landing-demo-glow">
            {/* Browser chrome */}
            <div className="flex items-center gap-2 px-4 py-3 bg-github-bg-secondary border-b border-github-border">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                <div className="w-3 h-3 rounded-full bg-[#28c840]" />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="px-4 py-1 rounded-md bg-github-bg-primary text-xs text-github-text-muted font-mono">
                  localhost:4966
                </div>
              </div>
            </div>
            <iframe
              title="difit live preview"
              src="/preview"
              loading="eager"
              className="w-full bg-github-bg-primary"
              style={{ height: '680px' }}
            />
          </div>
        </section>

        {/* Features */}
        <section className="px-6 py-20 max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Everything you need for
              <span className="landing-gradient-text"> local code review</span>
            </h2>
            <p className="text-github-text-secondary max-w-xl mx-auto">
              Built for developers who want fast, beautiful diffs without leaving the terminal.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <FeatureCard
              icon={<GitCompare size={20} />}
              title="GitHub-Style Diffs"
              description="Split and unified views with syntax highlighting for 30+ languages. Exactly like GitHub, but local."
            />
            <FeatureCard
              icon={<MessageSquare size={20} />}
              title="Review Comments"
              description="Click any line to add comments. Select ranges for multi-line feedback. All saved in your browser."
            />
            <FeatureCard
              icon={<Copy size={20} />}
              title="AI Prompt Copy"
              description="One-click copy of comments as structured prompts. Feed your review directly to Claude, GPT, or any AI agent."
            />
            <FeatureCard
              icon={<Eye size={20} />}
              title="PR Review"
              description="Pass a GitHub PR URL and review it locally with full diff context. Works with GitHub Enterprise too."
            />
            <FeatureCard
              icon={<Keyboard size={20} />}
              title="Keyboard-First"
              description="Navigate files, lines, and comments entirely with keyboard shortcuts. Vim-style j/k navigation included."
            />
            <FeatureCard
              icon={<Terminal size={20} />}
              title="Zero Config"
              description="Just npx difit. No setup, no config files, no dependencies to manage. Works in any git repository."
            />
          </div>
        </section>

        {/* Usage Examples */}
        <section className="px-6 py-20 max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-start">
            <div>
              <h2 className="text-3xl font-bold mb-4">
                Flexible <span className="landing-gradient-text">diff targets</span>
              </h2>
              <p className="text-github-text-secondary mb-8">
                Review any commit, compare branches, inspect staging area, or pipe in diffs from any
                tool.
              </p>

              <div className="space-y-4">
                <UsageExample command="difit" description="View HEAD commit diff" />
                <UsageExample
                  command="difit @ main"
                  description="Compare current branch with main"
                />
                <UsageExample command="difit ." description="All uncommitted changes" />
                <UsageExample command="difit staged" description="Staging area only" />
                <UsageExample
                  command="difit --pr <github-url>"
                  description="Review a GitHub PR locally"
                />
                <UsageExample
                  command="cat patch.diff | difit"
                  description="Pipe in any unified diff"
                />
              </div>
            </div>

            <div className="rounded-xl border border-github-border bg-github-bg-secondary/50 overflow-hidden">
              <div className="px-4 py-3 border-b border-github-border">
                <span className="text-xs font-medium text-github-text-muted">Quick Start</span>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <p className="text-xs text-github-text-muted mb-2">Try it instantly:</p>
                  <div className="relative">
                    <pre className="px-4 py-3 rounded-lg bg-github-bg-primary font-mono text-sm">
                      <span className="text-github-text-muted">$ </span>
                      <span className="text-green-400">npx</span> difit
                    </pre>
                    <CopyButton text="npx difit" />
                  </div>
                </div>
                <div>
                  <p className="text-xs text-github-text-muted mb-2">Or install globally:</p>
                  <div className="relative">
                    <pre className="px-4 py-3 rounded-lg bg-github-bg-primary font-mono text-sm">
                      <span className="text-github-text-muted">$ </span>
                      <span className="text-green-400">npm</span> install -g difit
                    </pre>
                    <CopyButton text="npm install -g difit" />
                  </div>
                </div>
                <div className="pt-2 border-t border-github-border">
                  <p className="text-xs text-github-text-muted">
                    Requires Node.js 21+ and a git repository.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="px-6 py-20 max-w-4xl mx-auto text-center">
          <div className="relative rounded-2xl border border-github-border bg-github-bg-secondary/30 p-12 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 via-transparent to-cyan-500/5" />
            <div className="relative">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to review some diffs?</h2>
              <p className="text-github-text-secondary mb-8 max-w-lg mx-auto">
                One command. No signup. No config.
                <br />
                Just beautiful, local code review.
              </p>
              <div className="relative inline-block group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-green-500 to-cyan-500 rounded-lg opacity-60 group-hover:opacity-100 blur-sm transition-opacity" />
                <div className="relative flex items-center gap-3 px-8 py-4 pr-14 rounded-lg bg-github-bg-primary font-mono text-xl">
                  <span className="text-green-400">$</span>
                  <span>npx difit</span>
                  <CopyButton text="npx difit" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="px-6 py-8 max-w-6xl mx-auto border-t border-github-border">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="difit" className="h-5 invert opacity-50" />
              <span className="text-sm text-github-text-muted">MIT License</span>
            </div>
            <div className="flex items-center gap-6">
              <a
                href="https://www.npmjs.com/package/difit"
                className="text-sm text-github-text-muted hover:text-github-text-secondary transition-colors"
              >
                npm
              </a>
              <a
                href="https://github.com/because-and/difit"
                className="text-sm text-github-text-muted hover:text-github-text-secondary transition-colors"
              >
                GitHub
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default SitePage;
