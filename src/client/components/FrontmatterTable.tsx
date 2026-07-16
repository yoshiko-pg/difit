import { type ReactNode } from 'react';

import type { FrontmatterDiffEntry } from '../utils/frontmatterDiff';

type FrontmatterSnapshotProps = {
  mode: 'snapshot';
  data: Record<string, unknown> | null;
  label?: string;
};

type FrontmatterDiffProps = {
  mode: 'diff';
  entries: FrontmatterDiffEntry[];
  label?: string;
};

export type FrontmatterTableProps = FrontmatterSnapshotProps | FrontmatterDiffProps;

function renderValue(value: unknown, depth: number): ReactNode {
  if (value === null) {
    return <span className="text-github-text-muted italic">null</span>;
  }
  if (value === undefined) {
    return <span className="text-github-text-muted italic">undefined</span>;
  }
  if (typeof value === 'string') {
    if (value === '') {
      return <span className="text-github-text-muted italic">&quot;&quot;</span>;
    }
    return <span>{value}</span>;
  }
  if (typeof value === 'boolean' || typeof value === 'number') {
    return <span>{String(value)}</span>;
  }
  if (value instanceof Date) {
    return <span>{value.toISOString()}</span>;
  }
  if (Array.isArray(value)) {
    return <pre className="whitespace-pre-wrap text-xs font-mono">{JSON.stringify(value)}</pre>;
  }
  if (typeof value === 'object') {
    if (depth === 0) {
      const entries = Object.entries(value as Record<string, unknown>);
      return (
        <table className="w-full border-collapse text-xs border border-github-border">
          <tbody>
            {entries.map(([k, v]) => (
              <tr key={k} className="border-b border-github-border">
                <td className="px-2 py-1 border border-github-border font-mono w-1/3">{k}</td>
                <td className="px-2 py-1 border border-github-border">
                  {renderValue(v, depth + 1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    return (
      <pre className="whitespace-pre-wrap text-xs font-mono">{JSON.stringify(value, null, 2)}</pre>
    );
  }
  return <span>{String(value)}</span>;
}

function KeyValueRow({ keyName, value }: { keyName: string; value: unknown }) {
  return (
    <tr className="border-b border-github-border">
      <td className="px-3 py-2 border border-github-border font-mono align-top">{keyName}</td>
      <td className="px-3 py-2 border border-github-border">{renderValue(value, 0)}</td>
    </tr>
  );
}

function KeyDiffRow({ entry }: { entry: FrontmatterDiffEntry }) {
  const beforeCellClass =
    entry.status === 'removed' || entry.status === 'modified' ? 'bg-diff-deletion-bg' : '';
  const afterCellClass =
    entry.status === 'added' || entry.status === 'modified' ? 'bg-diff-addition-bg' : '';

  return (
    <tr className="border-b border-github-border">
      <td className="px-3 py-2 border border-github-border font-mono align-top">{entry.key}</td>
      <td className={`px-3 py-2 border border-github-border align-top ${beforeCellClass}`}>
        {entry.status !== 'added' ? renderValue(entry.oldValue, 0) : null}
      </td>
      <td className={`px-3 py-2 border border-github-border align-top ${afterCellClass}`}>
        {entry.status !== 'removed' ? renderValue(entry.newValue, 0) : null}
      </td>
    </tr>
  );
}

function SnapshotView({ data, label }: { data: Record<string, unknown> | null; label?: string }) {
  if (data === null) {
    return null;
  }

  const entries = Object.entries(data);
  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="overflow-x-auto mb-4">
      {label && <div className="text-sm text-github-text-muted mb-1">{label}</div>}
      <table className="w-full border-collapse text-sm border border-github-border">
        <thead className="bg-github-bg-secondary">
          <tr className="border-b border-github-border">
            <th className="px-3 py-2 text-left font-semibold border border-github-border w-1/3">
              Key
            </th>
            <th className="px-3 py-2 text-left font-semibold border border-github-border">Value</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([key, value]) => (
            <KeyValueRow key={key} keyName={key} value={value} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DiffView({ entries, label }: { entries: FrontmatterDiffEntry[]; label?: string }) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="overflow-x-auto mb-4">
      {label && <div className="text-sm text-github-text-muted mb-1">{label}</div>}
      <table className="w-full border-collapse text-sm border border-github-border">
        <thead className="bg-github-bg-secondary">
          <tr className="border-b border-github-border">
            <th className="px-3 py-2 text-left font-semibold border border-github-border w-1/5">
              Key
            </th>
            <th className="px-3 py-2 text-left font-semibold border border-github-border">
              Before
            </th>
            <th className="px-3 py-2 text-left font-semibold border border-github-border">After</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <KeyDiffRow key={entry.key} entry={entry} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FrontmatterTable(props: FrontmatterTableProps): React.JSX.Element | null {
  if (props.mode === 'snapshot') {
    return <SnapshotView data={props.data} label={props.label} />;
  }
  return <DiffView entries={props.entries} label={props.label} />;
}
