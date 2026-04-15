import type {
  CommentImport,
  DiffCommentPosition,
  DiffCommentThread,
  DiffLineRange,
  DiffCommentCodeSnapshot,
  DiffCommentMessage,
  ReplyCommentImport,
  ThreadCommentImport,
} from '../types/diff.js';
import { createId } from './createId.js';

interface MergeCommentImportsResult {
  threads: DiffCommentThread[];
  warnings: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isValidIsoTimestamp(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

function normalizeTimestamp(
  value: unknown,
  fieldName: 'createdAt' | 'updatedAt',
): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string' || value.trim().length === 0 || !isValidIsoTimestamp(value)) {
    throw new Error(`Invalid comment import field: ${fieldName}`);
  }
  return value;
}

function normalizeLineRange(value: unknown): DiffLineRange {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (!isRecord(value)) {
    throw new Error('Invalid comment import field: position.line');
  }

  const start = value.start;
  const end = value.end;
  if (
    typeof start !== 'number' ||
    typeof end !== 'number' ||
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start <= 0 ||
    end <= 0 ||
    start > end
  ) {
    throw new Error('Invalid comment import field: position.line');
  }

  return { start, end };
}

function normalizePosition(value: unknown): DiffCommentPosition {
  if (!isRecord(value)) {
    throw new Error('Invalid comment import field: position');
  }

  if (value.side !== 'old' && value.side !== 'new') {
    throw new Error('Invalid comment import field: position.side');
  }

  return {
    side: value.side,
    line: normalizeLineRange(value.line),
  };
}

function normalizeCodeSnapshot(value: unknown): DiffCommentCodeSnapshot | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value) || typeof value.content !== 'string') {
    throw new Error('Invalid comment import field: codeSnapshot');
  }

  if (value.language !== undefined && typeof value.language !== 'string') {
    throw new Error('Invalid comment import field: codeSnapshot.language');
  }

  return {
    content: value.content,
    language: value.language,
  };
}

function normalizeOptionalString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new Error(`Invalid comment import field: ${fieldName}`);
  }
  return value;
}

function normalizeRequiredBody(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error('Invalid comment import field: body');
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error('Invalid comment import field: body');
  }

  return trimmed;
}

function normalizeCommentImportEntry(value: unknown): CommentImport {
  if (!isRecord(value)) {
    throw new Error('Comment import must be an object');
  }

  if (value.type !== 'thread' && value.type !== 'reply') {
    throw new Error('Invalid comment import field: type');
  }

  if (typeof value.filePath !== 'string' || value.filePath.trim().length === 0) {
    throw new Error('Invalid comment import field: filePath');
  }

  const createdAt = normalizeTimestamp(value.createdAt, 'createdAt');
  const updatedAt = normalizeTimestamp(value.updatedAt, 'updatedAt');

  const normalized = {
    type: value.type,
    id: normalizeOptionalString(value.id, 'id'),
    filePath: value.filePath,
    position: normalizePosition(value.position),
    body: normalizeRequiredBody(value.body),
    author: normalizeOptionalString(value.author, 'author'),
    createdAt,
    updatedAt,
    codeSnapshot: normalizeCodeSnapshot(value.codeSnapshot),
  };

  return normalized as CommentImport;
}

export function normalizeCommentImports(input: unknown): CommentImport[] {
  if (Array.isArray(input)) {
    return input.map((entry) => normalizeCommentImportEntry(entry));
  }

  return [normalizeCommentImportEntry(input)];
}

export function parseCommentImportValue(value: string): CommentImport[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('Invalid --comment JSON');
  }

  return normalizeCommentImports(parsed);
}

function getPositionKey(position: DiffCommentPosition): string {
  if (typeof position.line === 'number') {
    return `${position.side}:${position.line}`;
  }

  return `${position.side}:${position.line.start}-${position.line.end}`;
}

function positionsMatch(left: DiffCommentPosition, right: DiffCommentPosition): boolean {
  return getPositionKey(left) === getPositionKey(right);
}

function normalizeAuthor(author: string | undefined): string {
  return author?.trim() || '';
}

function messageMatchesImport(
  message: DiffCommentMessage,
  commentImport: CommentImport,
  includeId = true,
): boolean {
  if (includeId && commentImport.id && message.id === commentImport.id) {
    return true;
  }

  if (normalizeAuthor(message.author) !== normalizeAuthor(commentImport.author)) {
    return false;
  }

  if (message.body !== commentImport.body) {
    return false;
  }

  if (commentImport.createdAt && message.createdAt !== commentImport.createdAt) {
    return false;
  }

  return true;
}

function rootThreadMatchesImport(
  thread: DiffCommentThread,
  commentImport: ThreadCommentImport,
): boolean {
  if (commentImport.id && thread.id === commentImport.id) {
    return true;
  }

  if (
    thread.filePath !== commentImport.filePath ||
    !positionsMatch(thread.position, commentImport.position)
  ) {
    return false;
  }

  const rootMessage = thread.messages[0];
  if (!rootMessage) {
    return false;
  }

  return messageMatchesImport(rootMessage, commentImport, true);
}

function toThreadTimestamp(
  commentImport: CommentImport,
  now: string,
): { createdAt: string; updatedAt: string } {
  const createdAt = commentImport.createdAt ?? now;
  const updatedAt = commentImport.updatedAt ?? createdAt;
  return { createdAt, updatedAt };
}

function maxIsoTimestamp(left: string, right: string): string {
  return left.localeCompare(right) >= 0 ? left : right;
}

function sortByNewestThread(left: DiffCommentThread, right: DiffCommentThread): number {
  return right.updatedAt.localeCompare(left.updatedAt);
}

function createImportedThread(commentImport: ThreadCommentImport, now: string): DiffCommentThread {
  const { createdAt, updatedAt } = toThreadTimestamp(commentImport, now);
  const threadId = commentImport.id ?? createId();

  return {
    id: threadId,
    filePath: commentImport.filePath,
    createdAt,
    updatedAt,
    position: commentImport.position,
    codeSnapshot: commentImport.codeSnapshot,
    messages: [
      {
        id: commentImport.id ?? threadId,
        body: commentImport.body,
        author: commentImport.author,
        createdAt,
        updatedAt,
      },
    ],
  };
}

function createImportedReply(commentImport: ReplyCommentImport, now: string): DiffCommentMessage {
  const { createdAt, updatedAt } = toThreadTimestamp(commentImport, now);

  return {
    id: commentImport.id ?? createId(),
    body: commentImport.body,
    author: commentImport.author,
    createdAt,
    updatedAt,
  };
}

function cloneLineRange(line: DiffLineRange): DiffLineRange {
  if (typeof line === 'number') {
    return line;
  }

  return {
    start: line.start,
    end: line.end,
  };
}

function clonePosition(position: DiffCommentPosition): DiffCommentPosition {
  return {
    side: position.side,
    line: cloneLineRange(position.line),
  };
}

function cloneCodeSnapshot(
  snapshot: DiffCommentCodeSnapshot | undefined,
): DiffCommentCodeSnapshot | undefined {
  if (!snapshot) {
    return undefined;
  }

  return {
    content: snapshot.content,
    language: snapshot.language,
  };
}

function cloneMessage(message: DiffCommentMessage): DiffCommentMessage {
  return {
    id: message.id,
    body: message.body,
    author: message.author,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
  };
}

function cloneThread(thread: DiffCommentThread): DiffCommentThread {
  return {
    id: thread.id,
    filePath: thread.filePath,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    position: clonePosition(thread.position),
    codeSnapshot: cloneCodeSnapshot(thread.codeSnapshot),
    messages: thread.messages.map(cloneMessage),
  };
}

function messagesMatch(left: DiffCommentMessage, right: DiffCommentMessage): boolean {
  if (left.id === right.id) {
    return true;
  }

  if (normalizeAuthor(left.author) !== normalizeAuthor(right.author)) {
    return false;
  }

  return left.body === right.body && left.createdAt === right.createdAt;
}

function threadsMatch(left: DiffCommentThread, right: DiffCommentThread): boolean {
  if (left.id === right.id) {
    return true;
  }

  if (left.filePath !== right.filePath || !positionsMatch(left.position, right.position)) {
    return false;
  }

  const leftRoot = left.messages[0];
  const rightRoot = right.messages[0];
  if (!leftRoot || !rightRoot) {
    return false;
  }

  return messagesMatch(leftRoot, rightRoot);
}

function sortReplies(left: DiffCommentMessage, right: DiffCommentMessage): number {
  const createdAtOrder = left.createdAt.localeCompare(right.createdAt);
  if (createdAtOrder !== 0) {
    return createdAtOrder;
  }

  return left.id.localeCompare(right.id);
}

function pickNewerMessage(
  existingMessage: DiffCommentMessage,
  incomingMessage: DiffCommentMessage,
): DiffCommentMessage {
  if (incomingMessage.updatedAt.localeCompare(existingMessage.updatedAt) >= 0) {
    return cloneMessage(incomingMessage);
  }

  return cloneMessage(existingMessage);
}

function mergeThread(
  existingThread: DiffCommentThread,
  incomingThread: DiffCommentThread,
): DiffCommentThread {
  const mergedMessages = existingThread.messages.map(cloneMessage);

  for (const incomingMessage of incomingThread.messages) {
    const matchIndex = mergedMessages.findIndex((message) =>
      messagesMatch(message, incomingMessage),
    );
    if (matchIndex >= 0) {
      mergedMessages[matchIndex] = pickNewerMessage(mergedMessages[matchIndex], incomingMessage);
      continue;
    }

    mergedMessages.push(cloneMessage(incomingMessage));
  }

  const [rootMessage, ...replyMessages] = mergedMessages;
  const orderedMessages = rootMessage
    ? [rootMessage, ...replyMessages.sort(sortReplies)]
    : replyMessages.sort(sortReplies);
  const updatedAt = orderedMessages.reduce(
    (latest, message) => maxIsoTimestamp(latest, message.updatedAt),
    maxIsoTimestamp(existingThread.updatedAt, incomingThread.updatedAt),
  );

  return {
    ...cloneThread(existingThread),
    createdAt:
      existingThread.createdAt.localeCompare(incomingThread.createdAt) <= 0
        ? existingThread.createdAt
        : incomingThread.createdAt,
    updatedAt,
    position: clonePosition(existingThread.position),
    codeSnapshot: cloneCodeSnapshot(incomingThread.codeSnapshot ?? existingThread.codeSnapshot),
    messages: orderedMessages,
  };
}

export function mergeCommentThreads(
  existingThreads: DiffCommentThread[],
  incomingThreads: DiffCommentThread[],
): MergeCommentImportsResult {
  const threads = existingThreads.map(cloneThread);

  for (const incomingThread of incomingThreads) {
    const existingIndex = threads.findIndex((thread) => threadsMatch(thread, incomingThread));
    if (existingIndex < 0) {
      threads.push(cloneThread(incomingThread));
      continue;
    }

    threads[existingIndex] = mergeThread(threads[existingIndex], incomingThread);
  }

  return { threads, warnings: [] };
}

function serializeLineRange(line: DiffLineRange): number | { start: number; end: number } {
  if (typeof line === 'number') {
    return line;
  }

  return { start: line.start, end: line.end };
}

export function serializeCommentImports(commentImports: CommentImport[]): string {
  return JSON.stringify(
    commentImports.map((commentImport) => ({
      type: commentImport.type,
      id: commentImport.id,
      filePath: commentImport.filePath,
      position: {
        side: commentImport.position.side,
        line: serializeLineRange(commentImport.position.line),
      },
      body: commentImport.body,
      author: commentImport.author,
      createdAt: commentImport.createdAt,
      updatedAt: commentImport.updatedAt,
      codeSnapshot: commentImport.codeSnapshot
        ? {
            content: commentImport.codeSnapshot.content,
            language: commentImport.codeSnapshot.language,
          }
        : undefined,
    })),
  );
}

export function mergeCommentImports(
  existingThreads: DiffCommentThread[],
  commentImports: CommentImport[],
): MergeCommentImportsResult {
  const threads = [...existingThreads];
  const warnings: string[] = [];

  for (const commentImport of commentImports) {
    const now = new Date().toISOString();

    if (commentImport.type === 'thread') {
      const hasDuplicate = threads.some((thread) => rootThreadMatchesImport(thread, commentImport));
      if (hasDuplicate) {
        continue;
      }

      threads.push(createImportedThread(commentImport, now));
      continue;
    }

    const targetThreads = threads
      .filter(
        (thread) =>
          thread.filePath === commentImport.filePath &&
          positionsMatch(thread.position, commentImport.position),
      )
      .sort(sortByNewestThread);

    const targetThread = targetThreads[0];
    if (!targetThread) {
      warnings.push(
        `Skipped reply import for ${commentImport.filePath}:${getPositionKey(commentImport.position)} because no matching thread was found.`,
      );
      continue;
    }

    const hasDuplicateReply = targetThread.messages.some((message) =>
      messageMatchesImport(message, commentImport, true),
    );
    if (hasDuplicateReply) {
      continue;
    }

    const importedReply = createImportedReply(commentImport, now);
    targetThread.messages = [...targetThread.messages, importedReply];
    targetThread.updatedAt = maxIsoTimestamp(targetThread.updatedAt, importedReply.updatedAt);
  }

  return { threads, warnings };
}
