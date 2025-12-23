/**
 * Utilities for repository identification and storage isolation
 */

interface RepositoryInfo {
  remoteUrl: string | null;
  repositoryPath: string;
  repositoryIdentifier: string;
}

// Cache to avoid repeated fetches
let cachedRepositoryId: string | null = null;

/**
 * Fetch repository information from the server
 */
async function fetchRepositoryInfo(): Promise<RepositoryInfo> {
  const response = await fetch('/api/repository-info');
  if (!response.ok) {
    throw new Error('Failed to fetch repository info');
  }
  return (await response.json()) as RepositoryInfo;
}

/**
 * Hash a string using SHA-256 (Web Crypto API)
 */
async function hashString(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Get a stable, hashed repository identifier for storage isolation.
 * Returns a cached value if available to avoid repeated fetches.
 */
export async function getRepositoryIdentifier(): Promise<string> {
  if (cachedRepositoryId) {
    return cachedRepositoryId;
  }

  try {
    const info = await fetchRepositoryInfo();
    // Hash the repository identifier for safe use in storage keys
    const hashed = await hashString(info.repositoryIdentifier);
    cachedRepositoryId = hashed;
    return hashed;
  } catch (error) {
    console.error('Failed to get repository identifier:', error);
    // Fallback to a default value - this will cause data to be shared
    // but is better than crashing
    return 'default';
  }
}

/**
 * Clear the cached repository identifier (useful for testing)
 */
export function clearRepositoryIdentifierCache(): void {
  cachedRepositoryId = null;
}
