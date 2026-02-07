interface SuggestionDiffLineProps {
  line: string;
  type: 'add' | 'delete';
}

export function SuggestionDiffLine({ line, type }: SuggestionDiffLineProps) {
  const isAdd = type === 'add';
  return (
    <div
      className={`px-3 py-0.5 flex items-start ${isAdd ? 'bg-diff-addition-bg' : 'bg-diff-deletion-bg'}`}
    >
      <span
        className={`select-none mr-2 flex-shrink-0 ${isAdd ? 'text-green-400' : 'text-red-400'}`}
      >
        {isAdd ? '+' : '-'}
      </span>
      <span className="text-github-text-primary whitespace-pre-wrap break-all">{line}</span>
    </div>
  );
}
