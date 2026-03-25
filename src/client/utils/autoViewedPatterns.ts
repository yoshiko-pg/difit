function normalizePath(value: string): string {
  return value.replaceAll('\\', '/').replace(/^\.\/+/, '');
}

function escapeRegex(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

function normalizePatterns(patterns: string[]): string[] {
  const uniquePatterns = new Set<string>();

  patterns.forEach((pattern) => {
    const trimmedPattern = pattern.trim();
    if (trimmedPattern) {
      uniquePatterns.add(normalizePath(trimmedPattern));
    }
  });

  return [...uniquePatterns];
}

function splitPathSegments(value: string): string[] {
  return normalizePath(value)
    .split('/')
    .filter((segment) => segment.length > 0);
}

function matchesSegment(pathSegment: string, patternSegment: string): boolean {
  let regexSource = '^';

  for (const character of patternSegment) {
    if (character === '*') {
      regexSource += '.*';
      continue;
    }

    if (character === '?') {
      regexSource += '.';
      continue;
    }

    regexSource += escapeRegex(character);
  }

  regexSource += '$';

  return new RegExp(regexSource).test(pathSegment);
}

function matchesPathSegments(
  pathSegments: string[],
  patternSegments: string[],
  pathIndex = 0,
  patternIndex = 0,
): boolean {
  if (patternIndex >= patternSegments.length) {
    return pathIndex >= pathSegments.length;
  }

  const currentPattern = patternSegments[patternIndex];
  if (!currentPattern) {
    return pathIndex >= pathSegments.length;
  }

  if (currentPattern === '**') {
    const nextPatternIndex = patternIndex + 1;

    if (nextPatternIndex >= patternSegments.length) {
      return true;
    }

    for (let nextPathIndex = pathIndex; nextPathIndex <= pathSegments.length; nextPathIndex += 1) {
      if (matchesPathSegments(pathSegments, patternSegments, nextPathIndex, nextPatternIndex)) {
        return true;
      }
    }

    return false;
  }

  const currentPathSegment = pathSegments[pathIndex];
  if (!currentPathSegment || !matchesSegment(currentPathSegment, currentPattern)) {
    return false;
  }

  return matchesPathSegments(pathSegments, patternSegments, pathIndex + 1, patternIndex + 1);
}

export function normalizeAutoViewedPatterns(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return normalizePatterns(
    value.filter((pattern): pattern is string => typeof pattern === 'string'),
  );
}

export function parseAutoViewedPatterns(input: string): string[] {
  return normalizePatterns(input.split(/\r?\n/));
}

export function formatAutoViewedPatterns(patterns: string[]): string {
  return normalizeAutoViewedPatterns(patterns).join('\n');
}

export function matchesAutoViewedPattern(filePath: string, pattern: string): boolean {
  const normalizedPattern = normalizePath(pattern.trim());
  if (!normalizedPattern) {
    return false;
  }

  const normalizedFilePath = normalizePath(filePath);

  // Patterns without a path separator match against the basename, so `*.test.ts`
  // works for files nested anywhere in the repository.
  if (!normalizedPattern.includes('/')) {
    const fileName = normalizedFilePath.split('/').pop() ?? normalizedFilePath;
    return matchesSegment(fileName, normalizedPattern);
  }

  return matchesPathSegments(
    splitPathSegments(normalizedFilePath),
    splitPathSegments(normalizedPattern),
  );
}

export function matchesAutoViewedPatterns(filePath: string, patterns: string[]): boolean {
  return normalizeAutoViewedPatterns(patterns).some((pattern) =>
    matchesAutoViewedPattern(filePath, pattern),
  );
}
