import { useEffect, useState } from 'react';

import App from '../client/App';

import {
  installStaticApiBridge,
  loadStaticDataset,
  type StaticApiBridge,
} from './utils/staticApiBridge';

function StaticDiffApp() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let bridge: StaticApiBridge | null = null;

    const bootstrap = async () => {
      try {
        const dataset = await loadStaticDataset();
        bridge = installStaticApiBridge(dataset);

        if (!cancelled) {
          setLoading(false);
        }
      } catch (bootstrapError) {
        if (!cancelled) {
          setError(
            bootstrapError instanceof Error ? bootstrapError.message : 'Failed to load static diff',
          );
          setLoading(false);
        }
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
      bridge?.restore();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-github-bg-primary">
        <div className="text-github-text-secondary text-base">Loading static difit snapshot...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-github-bg-primary text-center gap-2 px-4">
        <h2 className="text-github-danger text-2xl mb-2">Static Snapshot Error</h2>
        <p className="text-github-text-secondary text-base">{error}</p>
      </div>
    );
  }

  return <App />;
}

export default StaticDiffApp;
