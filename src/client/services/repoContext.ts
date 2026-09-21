// Tracks which repository the UI is currently viewing when difit hosts several
// repositories at once (via the CLI `--repos` flag). All `/api/*` requests are
// scoped by appending a `repo=<id>` query param; when only one repository is
// hosted the id is empty and URLs are left untouched so single-repo behaviour
// is unchanged.

let activeRepoId = '';

export function getActiveRepoId(): string {
  return activeRepoId;
}

export function setActiveRepoId(id: string): void {
  activeRepoId = id;
}

/** Append the active `repo` query param to an API URL, if one is selected. */
export function appendRepoParam(url: string): string {
  if (!activeRepoId) {
    return url;
  }
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}repo=${encodeURIComponent(activeRepoId)}`;
}

export interface RepoInfo {
  id: string;
  name: string;
}
