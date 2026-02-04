export const EDITOR_OPTIONS = [
  { id: 'vscode', label: 'VS Code', protocol: 'vscode', aliases: ['vscode', 'code'] },
  { id: 'cursor', label: 'Cursor', protocol: 'cursor', aliases: ['cursor'] },
  {
    id: 'none',
    label: 'Hide “Open in editor” button',
    protocol: null,
    aliases: ['none', 'disabled', 'off'],
  },
] as const;

export type EditorOption = (typeof EDITOR_OPTIONS)[number];
export type EditorOptionId = EditorOption['id'];

export const DEFAULT_EDITOR_ID: EditorOptionId = 'vscode';

export const resolveEditorOption = (input?: string): EditorOption => {
  const normalized = (input ?? DEFAULT_EDITOR_ID).toLowerCase();
  const matched = EDITOR_OPTIONS.find(
    (option) => option.id === normalized || option.aliases.some((alias) => alias === normalized),
  );
  const fallback = EDITOR_OPTIONS.find((option) => option.id === DEFAULT_EDITOR_ID);
  return matched ?? fallback ?? EDITOR_OPTIONS[0];
};
