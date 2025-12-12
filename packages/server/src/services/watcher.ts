import { watch, FSWatcher } from 'node:fs';
import { join } from 'node:path';
import { EventEmitter } from 'node:events';
import type { RepoInfo } from './scanner.js';

// Files/dirs in .git that indicate state changes
const WATCH_PATTERNS = [
  'HEAD',           // Branch changes
  'index',          // Staging area changes
  'COMMIT_EDITMSG', // Commit in progress
  'MERGE_HEAD',     // Merge in progress
  'REBASE_HEAD',    // Rebase in progress
  'refs',           // Branch/tag updates
  'logs',           // Reflog updates
];

export class GitWatcher extends EventEmitter {
  private watchers: Map<string, FSWatcher[]> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private debounceMs = 300; // Debounce rapid changes

  watchRepo(repo: RepoInfo): void {
    if (this.watchers.has(repo.id)) {
      return; // Already watching
    }

    const gitDir = join(repo.path, '.git');
    const repoWatchers: FSWatcher[] = [];

    try {
      // Watch main .git directory for key files
      const mainWatcher = watch(gitDir, (eventType, filename) => {
        if (filename && WATCH_PATTERNS.some(p => filename.startsWith(p))) {
          this.emitChange(repo);
        }
      });
      repoWatchers.push(mainWatcher);

      // Watch refs directory for branch updates
      try {
        const refsWatcher = watch(join(gitDir, 'refs'), { recursive: true }, () => {
          this.emitChange(repo);
        });
        repoWatchers.push(refsWatcher);
      } catch {
        // refs dir might not exist yet
      }

      this.watchers.set(repo.id, repoWatchers);
      console.log(`Watching: ${repo.name}`);
    } catch (err) {
      console.warn(`Failed to watch ${repo.name}:`, err);
    }
  }

  unwatchRepo(repoId: string): void {
    const watchers = this.watchers.get(repoId);
    if (watchers) {
      watchers.forEach(w => w.close());
      this.watchers.delete(repoId);
    }
    const timer = this.debounceTimers.get(repoId);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(repoId);
    }
  }

  watchRepos(repos: RepoInfo[]): void {
    // Unwatch repos that are no longer in the list
    const currentIds = new Set(repos.map(r => r.id));
    for (const id of this.watchers.keys()) {
      if (!currentIds.has(id)) {
        this.unwatchRepo(id);
      }
    }

    // Watch new repos
    for (const repo of repos) {
      this.watchRepo(repo);
    }
  }

  private emitChange(repo: RepoInfo): void {
    // Debounce rapid changes (e.g., during rebase)
    const existing = this.debounceTimers.get(repo.id);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      this.debounceTimers.delete(repo.id);
      this.emit('change', repo);
    }, this.debounceMs);

    this.debounceTimers.set(repo.id, timer);
  }

  stopAll(): void {
    for (const id of this.watchers.keys()) {
      this.unwatchRepo(id);
    }
  }
}
