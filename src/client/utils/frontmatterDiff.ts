export type FrontmatterDiffStatus = 'added' | 'removed' | 'modified' | 'unchanged';

export type FrontmatterDiffEntry = {
  key: string;
  status: FrontmatterDiffStatus;
  oldValue: unknown;
  newValue: unknown;
};

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  const record = value as Record<string, unknown>;
  const sortedKeys = Object.keys(record).sort();
  const sorted: Record<string, unknown> = {};
  for (const k of sortedKeys) {
    sorted[k] = canonicalize(record[k]);
  }
  return sorted;
}

function canonicalStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function computeFrontmatterDiff(
  oldData: Record<string, unknown> | null,
  newData: Record<string, unknown> | null,
): FrontmatterDiffEntry[] {
  if (newData === null) {
    if (oldData === null) {
      return [];
    }
    return Object.keys(oldData).map((key) => ({
      key,
      status: 'removed',
      oldValue: oldData[key],
      newValue: undefined,
    }));
  }

  if (oldData === null) {
    return Object.keys(newData).map((key) => ({
      key,
      status: 'added',
      oldValue: undefined,
      newValue: newData[key],
    }));
  }

  const entries: FrontmatterDiffEntry[] = [];

  for (const key of Object.keys(newData)) {
    if (!(key in oldData)) {
      entries.push({ key, status: 'added', oldValue: undefined, newValue: newData[key] });
      continue;
    }
    const oldValue = oldData[key];
    const newValue = newData[key];
    const status =
      canonicalStringify(oldValue) === canonicalStringify(newValue) ? 'unchanged' : 'modified';
    entries.push({ key, status, oldValue, newValue });
  }

  for (const key of Object.keys(oldData)) {
    if (!(key in newData)) {
      entries.push({ key, status: 'removed', oldValue: oldData[key], newValue: undefined });
    }
  }

  return entries;
}
