import { useEffect, useMemo, useState } from 'react';

import type { StaticDiffDataset } from './types/staticDiff';
import './styles/landing.css';

const features = [
  {
    title: 'Side-by-side or unified',
    description: 'Switch view mode on the fly to match the review task without leaving the page.',
  },
  {
    title: 'Line-level comments',
    description:
      'Drop comments directly on lines and keep review notes synced with the exact diff context.',
  },
  {
    title: 'Revision switcher',
    description: 'Jump between branch and commit ranges to inspect how a change evolved over time.',
  },
];

const quickStartSteps = [
  'Install and run in any Git repository.',
  'Open the browser UI instantly.',
  'Review, annotate, and export your prompts.',
];

export function LandingPage() {
  const [dataset, setDataset] = useState<StaticDiffDataset | null>(null);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState('');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch('/landing-data/diffs.json');
        if (!response.ok) return;

        const data = (await response.json()) as StaticDiffDataset;
        if (cancelled) return;

        setDataset(data);
        const initialSnapshot =
          (data.initialRevisionId &&
            data.diffs[data.initialRevisionId] &&
            data.initialRevisionId) ||
          data.revisions.find((revision) => data.diffs[revision.id])?.id ||
          '';
        setSelectedSnapshotId(initialSnapshot);
      } catch {
        // Landing still works without snapshot metadata.
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const iframeSrc = useMemo(() => {
    if (!selectedSnapshotId) {
      return '/app-static';
    }
    return `/app-static?snapshot=${encodeURIComponent(selectedSnapshotId)}`;
  }, [selectedSnapshotId]);

  const selectableRevisions = useMemo(
    () => dataset?.revisions.filter((revision) => dataset.diffs[revision.id]) ?? [],
    [dataset],
  );

  return (
    <main className="landing-page">
      <div className="landing-orb landing-orb-left" aria-hidden />
      <div className="landing-orb landing-orb-right" aria-hidden />

      <header className="landing-header">
        <div className="landing-brand">difit</div>
        <a
          className="landing-link"
          href="https://github.com/yoshiko-pg/difit"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>
      </header>

      <section className="landing-hero">
        <p className="landing-kicker">One-page landing with a static difit embed</p>
        <h1 className="landing-title">Review difit by using difit itself.</h1>
        <p className="landing-description">
          The panel below is a static-exported difit session generated at build time. It ships with
          commit snapshots from this repository, so anyone can browse diffs safely without a live
          backend API.
        </p>
        <div className="landing-cta-group">
          <a className="landing-cta landing-cta-primary" href="/" target="_blank" rel="noreferrer">
            Open full viewer
          </a>
          <a
            className="landing-cta landing-cta-secondary"
            href="https://github.com/yoshiko-pg/difit#readme"
            target="_blank"
            rel="noopener noreferrer"
          >
            Read docs
          </a>
        </div>
      </section>

      <section className="landing-demo" aria-label="live difit demo">
        <div className="landing-demo-head">
          <span className="landing-demo-dot" />
          <span className="landing-demo-title">Static difit snapshot / commit history</span>
          {selectableRevisions.length > 0 && (
            <label className="landing-snapshot-selector">
              <span>Snapshot:</span>
              <select
                value={selectedSnapshotId}
                onChange={(event) => setSelectedSnapshotId(event.target.value)}
              >
                {selectableRevisions.map((revision) => (
                  <option key={revision.id} value={revision.id}>
                    {revision.targetShortHash} {revision.message}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <iframe
          className="landing-demo-frame"
          src={iframeSrc}
          title="difit live preview"
          loading="eager"
        />
      </section>

      <section className="landing-info-grid">
        <article className="landing-card">
          <h2>Quick start</h2>
          <ol>
            {quickStartSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <pre className="landing-code">
            <code>pnpm dlx difit HEAD</code>
          </pre>
        </article>

        <article className="landing-card">
          <h2>Core strengths</h2>
          <ul>
            {features.map((feature) => (
              <li key={feature.title}>
                <strong>{feature.title}</strong>
                <p>{feature.description}</p>
              </li>
            ))}
          </ul>
        </article>
      </section>
    </main>
  );
}

export default LandingPage;
