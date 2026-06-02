import type { DiffCommentThread, DiffFile } from '../../types/diff';

export interface FileLineIndex {
  old: Map<number, string>;
  new: Map<number, string>;
}

function trimTrailingWhitespace(line: string): string {
  return line.replace(/[ \t]+$/, '');
}

function splitSnapshot(content: string): string[] {
  return content.replace(/\r\n/g, '\n').split('\n').map(trimTrailingWhitespace);
}

export function buildFileLineIndex(file: DiffFile): FileLineIndex {
  const oldIndex = new Map<number, string>();
  const newIndex = new Map<number, string>();

  for (const chunk of file.chunks) {
    for (const line of chunk.lines) {
      if (line.oldLineNumber !== undefined) {
        oldIndex.set(line.oldLineNumber, line.content);
      }
      if (line.newLineNumber !== undefined) {
        newIndex.set(line.newLineNumber, line.content);
      }
    }
  }

  return { old: oldIndex, new: newIndex };
}

export function isThreadOutdated(
  thread: DiffCommentThread,
  index: FileLineIndex | undefined,
): boolean {
  const snapshot = thread.codeSnapshot?.content;
  if (snapshot === undefined) return false;

  if (!index) return true;

  const sideIndex = thread.position.side === 'old' ? index.old : index.new;
  const range =
    typeof thread.position.line === 'number'
      ? { start: thread.position.line, end: thread.position.line }
      : thread.position.line;

  const snapshotLines = splitSnapshot(snapshot);

  for (let i = 0; i <= range.end - range.start; i++) {
    const current = sideIndex.get(range.start + i);
    if (current === undefined) continue;
    const expected = snapshotLines[i] ?? '';
    if (trimTrailingWhitespace(current) !== expected) return true;
  }

  return false;
}
