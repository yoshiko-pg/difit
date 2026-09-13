# ADR 0001: Poll git state instead of watching the filesystem

- Status: Accepted
- Date: 2026-09-11
- Affects: `src/server/file-watcher.ts`, `src/server/git-diff.ts`, `packages/vscode`

## Context

difit starts a local server and shows a diff in the browser. It reloads the browser when the repository changes. Before this decision, the reload signal came from `@parcel/watcher`, which watches the filesystem through inotify on Linux.

On a large repository, the watcher made the startup very slow. A measurement on a monorepo with 73,790 tracked files and 88,866 directories showed this:

| Startup step                  | Time   |
| ----------------------------- | ------ |
| Everything before the watcher | ~600ms |
| `fileWatcher`                 | 4876ms |
| Total to ready                | 5627ms |

A cold start took almost 30 seconds.

### Why the watcher was slow

inotify adds one watch for each directory. `@parcel/watcher` must walk the whole tree and add every watch before `subscribe()` returns.

The code passed `ignore: ['node_modules/**', ...]` and expected this to skip those trees. It does not. The `ignore` option accepts two different kinds of value, and they use two different mechanisms:

- A **glob** filters the events that reach the callback. The native backend still walks the tree.
- A **path** prunes the walk in the native backend.

Every entry in the configuration was a glob. difit paid the full traversal cost and then also ran the glob filter on each event.

In this monorepo, 70,707 of the 88,866 directories were inside nested `node_modules` folders.

### What the events were used for

The watcher callback discarded the event path. It only decided whether to call `debouncedBroadcast()`. The broadcast message contains no file list. The client re-fetches the complete diff.

The watcher was therefore a boolean edge detector. It answered one question: "did anything change?" It walked 88,866 directories to produce one bit.

## Options considered

Measurements are from the same monorepo.

### 1. Keep the watcher, pass prune paths instead of globs

Run `git ls-files --others --ignored --exclude-standard --directory --no-empty-directory`, convert each directory to an absolute path, and pass those paths in `ignore`. This uses the repository's own `.gitignore` instead of a hardcoded `node_modules` guess.

| `ignore` value                                        | subscribe time                     |
| ----------------------------------------------------- | ---------------------------------- |
| `[]`                                                  | 4350ms                             |
| Globs (the old behavior)                              | 4512ms                             |
| Absolute paths of nested `node_modules`               | 1024ms                             |
| Absolute paths from `git ls-files --others --ignored` | 955ms, plus 210ms for the git call |

This prunes the walk from 88,866 to 9,243 directories. It works, but it keeps ~1.2s on the critical path and keeps the native dependency.

### 2. Watch only the directories that hold tracked files

`git ls-files` reports 73,790 files in 8,492 directories. inotify watches directories, not files, so the candidate list is those 8,492 directories.

This measured much worse than the problem it tried to solve:

| Step                      | Time    |
| ------------------------- | ------- |
| 8,476 `subscribe()` calls | 16259ms |
| Unsubscribe               | 66200ms |

Each `@parcel/watcher` subscription is a heavyweight object with its own thread, its own inotify instance, and its own directory snapshot. The library is built for a few calls over large roots, not thousands of calls over small ones. The per-call overhead dominates, not the directory count.

### 3. Poll git for the state that decides the diff (chosen)

`git status --porcelain` produces the same bit the watcher produced, and it produces it more directly.

| Repository               | `git status --porcelain` |
| ------------------------ | ------------------------ |
| difit itself, warm       | 6ms                      |
| The 73,790-file monorepo | 220ms                    |

`git status` is not a naive scan. It uses the index stat cache and compares inode metadata instead of reading file contents. Almost all of the 220ms is kernel time in `lstat`.

## Decision

difit polls git state. It does not watch the filesystem.

`FileWatcherService` keeps its public API (`start`, `stop`, `addClient`, `removeClient`, `broadcast`), so `server.ts` did not change.

### The change signal

Each poll builds a SHA-1 of:

1. The commit that `HEAD` points to.
2. The symbolic ref of `HEAD`.
3. The working tree report, when the mode needs it.

The symbolic ref is necessary. `git checkout -b feature` changes what the user reviews, but it does not move the commit hash. Without the ref, that transition is invisible.

A poll that cannot read git returns `null`. The caller treats `null` as "unknown", not as "changed", so a temporary git failure does not cause a reload.

### Per-mode signal scope

Each diff mode reads only the git state that can change its own output:

| Mode             | Scope      | Reads                                                  |
| ---------------- | ---------- | ------------------------------------------------------ |
| `DEFAULT`        | `head`     | `HEAD` and the symbolic ref only                       |
| `STAGED`         | `index`    | The above, plus the staged column of the status report |
| `WORKING`, `DOT` | `worktree` | The above, plus the full status report                 |
| `SPECIFIC`       | none       | Nothing. This mode never polls.                        |

`DEFAULT` cannot show an uncommitted change, so it never pays for `git status`.

Restricting `STAGED` to the staged column also fixes a defect. The old watcher fired on any touch of `.git/index`, so an unstaged edit triggered a reload that changed nothing on screen.

### Adaptive interval

The next delay is `duration / 0.1`, clamped to 1–10 seconds. This holds the poller near 10% of one core on any repository. difit itself polls at the 1s floor. The monorepo backs off to about 2.4s and measures 0.3% of one core.

### Polling only while a client is connected

`broadcastChange()` already returned early when no client was connected, so that work was discarded. The poller now starts on the first `addClient` and stops on the last `removeClient`. A difit tab left open in a background window uses no CPU. This was confirmed: zero CPU ticks over 8 seconds with no client connected.

## Consequences

### Gains

| Metric                        | Before               | After            |
| ----------------------------- | -------------------- | ---------------- |
| `fileWatcher` startup         | 4876ms               | 287ms            |
| `validateCommit` (see below)  | 231ms                | 6ms              |
| Total to ready                | 5627ms               | 884ms            |
| Idle CPU, no client connected | inotify watches held | zero             |
| Polling CPU on the monorepo   | —                    | 0.3% of one core |

`@parcel/watcher` is gone from the dependency list. This removed more than the server code:

- `packages/vscode/src/watcher-shim.ts` and `modules.d.ts`.
- About 105 lines in `packages/vscode/build.mjs` that downloaded, extracted, and cached **ten** native prebuilt binaries, one for each platform, architecture, and libc combination. The published VSIX shrinks accordingly.
- The `detect-libc` dependency, used only by the deleted shim.
- Two `knip.json` workarounds.

Also removed from the server: a `git check-ignore` child process for each event path, the glob matcher, and the manual git worktree resolution. `simpleGit(watchPath)` handles worktrees natively.

### Costs

**Detection latency becomes the poll interval.** It is about 1.3s on a normal repository and about 2.4s on the monorepo, instead of the near-instant response of inotify. This is acceptable because the client then re-fetches and re-renders the entire diff. The pre-existing 300ms debounce shows the design never targeted millisecond latency.

**Steady CPU cost while a tab is open.** It is 0.3% of one core on the monorepo and lower elsewhere. The old design used no CPU when idle, but it held 88,866 inotify watches.

**The debounce is now almost vestigial.** The poll interval is at least 1s, which is longer than the 300ms debounce, so the debounce rarely collapses two polls. It stays because it keeps `onCacheInvalidate` ordered before the broadcast.

## Related changes

### `validateCommit` no longer scans the working tree

`GitDiffParser.validateCommit` called `git.status()` to answer "am I in a git repository?" for the `.`, `working`, and `staged` arguments. `simple-git` runs that as `git status --porcelain=v2 --branch -z`, a full working tree scan that cost 231ms on the monorepo. `git rev-parse --git-dir` answers the same question in 3ms.

An earlier plan was to run `validateCommit` and the untracked file lookup concurrently. That plan was dropped. `handleUntrackedFiles` can prompt the user and can mutate the index with `git add --intent-to-add`, so overlapping it risks a garbled prompt and a race on the index. Removing the duplicated query was both safer and faster than hiding it behind `Promise.all`.

### difit reports a slow `git status`, but never changes git configuration

When the baseline read costs more than 150ms in a mode that scans the working tree, difit checks `core.untrackedCache` and `core.fsmonitor` and names only the ones that are off:

```
i  git status takes 304ms here, which sets the live reload interval.
   These git settings make it faster:
     git config core.untrackedCache true
     git config core.fsmonitor true
```

difit must not enable these itself. Both settings change how every other git command behaves in that repository, so the choice belongs to the user.

## Notes for future work

- Do not reintroduce a glob in a `@parcel/watcher` `ignore` array and expect it to prune a walk. Only a path prunes.
- Do not create one subscription per directory. Measurements are in the options above.
- `SIGNAL_SEPARATOR` must stay a printable string. An earlier draft used a NUL character, which made the source file count as binary. `grep` returned nothing for it and `git diff` printed `Bin` instead of a readable diff.
