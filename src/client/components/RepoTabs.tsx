import { type RepoInfo } from '../services/repoContext';

interface RepoTabsProps {
  repos: RepoInfo[];
  activeRepoId: string;
  onSelect: (repoId: string) => void;
}

/**
 * A GitHub-style horizontal tab bar shown at the very top of the app when
 * difit hosts more than one repository. Each tab shows only the repository
 * name; clicking one switches the active repository and re-fetches its diff.
 */
export function RepoTabs({ repos, activeRepoId, onSelect }: RepoTabsProps) {
  if (repos.length <= 1) {
    return null;
  }

  return (
    <nav
      className="flex-shrink-0 flex items-stretch gap-1 overflow-x-auto overflow-y-hidden bg-github-bg-primary border-b border-github-border px-3"
      style={{ touchAction: 'pan-x', overscrollBehavior: 'contain' }}
      aria-label="Repositories"
    >
      {repos.map((repo) => {
        const isActive = repo.id === activeRepoId;
        return (
          <button
            key={repo.id}
            type="button"
            onClick={() => onSelect(repo.id)}
            title={repo.name}
            aria-current={isActive ? 'page' : undefined}
            className={`relative whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              isActive
                ? 'border-github-warning text-github-text-primary'
                : 'border-transparent text-github-text-secondary hover:text-github-text-primary'
            }`}
          >
            {repo.name}
          </button>
        );
      })}
    </nav>
  );
}
