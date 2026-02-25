interface WordMatch {
  word: string;
  start: number;
  end: number;
}

const WORD_REGEX = /[\w]+/g;
const MIN_WORD_LENGTH = 2;
const MAX_WORD_LENGTH = 100;

export function detectWords(text: string): WordMatch[] {
  const words: WordMatch[] = [];
  let match: RegExpExecArray | null;

  WORD_REGEX.lastIndex = 0;

  while ((match = WORD_REGEX.exec(text)) !== null) {
    const word = match[0];
    if (isValidWord(word)) {
      words.push({
        word,
        start: match.index,
        end: match.index + word.length,
      });
    }
  }

  return words;
}

export function isValidWord(word: string): boolean {
  if (word.length < MIN_WORD_LENGTH || word.length > MAX_WORD_LENGTH) {
    return false;
  }

  return true;
}

export function normalizeWord(word: string): string {
  return word.toLowerCase();
}

// Check if a token content is a valid word (not just symbols)
export function isWordToken(content: string): boolean {
  // Trim spaces from token content
  const trimmed = content.trim();
  if (!trimmed) return false;

  // Must match word pattern and be valid
  const match = trimmed.match(/^\w+$/);
  return match !== null && isValidWord(trimmed);
}
