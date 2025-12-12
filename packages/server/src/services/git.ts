import simpleGit, { SimpleGit, StatusResult, LogResult, BranchSummary } from 'simple-git';

export interface RepoStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: number;
  modified: number;
  untracked: number;
  stashes: number;
  isClean: boolean;
  hasRemote: boolean;
}

export interface CommitInfo {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
  timestamp: number;
}

export interface BranchInfo {
  name: string;
  current: boolean;
  tracking?: string;
  ahead?: number;
  behind?: number;
}

export interface GitOpResult {
  success: boolean;
  message: string;
  data?: unknown;
}

export class GitService {
  private getGit(repoPath: string): SimpleGit {
    return simpleGit(repoPath);
  }

  async getStatus(repoPath: string): Promise<RepoStatus> {
    const git = this.getGit(repoPath);
    const status: StatusResult = await git.status();

    let stashCount = 0;
    try {
      const stashList = await git.stashList();
      stashCount = stashList.total;
    } catch {
      // No stash support or empty
    }

    return {
      branch: status.current || 'HEAD',
      ahead: status.ahead,
      behind: status.behind,
      staged: status.staged.length,
      modified: status.modified.length + status.deleted.length,
      untracked: status.not_added.length,
      stashes: stashCount,
      isClean: status.isClean(),
      hasRemote: status.tracking !== null,
    };
  }

  async getLog(repoPath: string, limit: number = 20): Promise<CommitInfo[]> {
    const git = this.getGit(repoPath);
    const log: LogResult = await git.log({ maxCount: limit });

    return log.all.map((commit) => ({
      hash: commit.hash,
      shortHash: commit.hash.slice(0, 7),
      message: commit.message,
      author: commit.author_name,
      date: commit.date,
      timestamp: new Date(commit.date).getTime(),
    }));
  }

  async getBranches(repoPath: string): Promise<BranchInfo[]> {
    const git = this.getGit(repoPath);
    const branches: BranchSummary = await git.branch(['-vv']);

    return Object.entries(branches.branches).map(([name, branch]) => ({
      name,
      current: branch.current,
      tracking: branch.label.includes('[') ? branch.label.match(/\[([^\]]+)\]/)?.[1] : undefined,
    }));
  }

  async getLatestCommit(repoPath: string): Promise<CommitInfo | null> {
    const commits = await this.getLog(repoPath, 1);
    return commits[0] || null;
  }

  async pull(repoPath: string): Promise<GitOpResult> {
    try {
      const git = this.getGit(repoPath);
      const result = await git.pull();
      return {
        success: true,
        message: result.summary.changes
          ? `Pulled ${result.summary.changes} changes`
          : 'Already up to date',
        data: result,
      };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Pull failed',
      };
    }
  }

  async push(repoPath: string): Promise<GitOpResult> {
    try {
      const git = this.getGit(repoPath);
      await git.push();
      return {
        success: true,
        message: 'Pushed successfully',
      };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Push failed',
      };
    }
  }

  async fetch(repoPath: string): Promise<GitOpResult> {
    try {
      const git = this.getGit(repoPath);
      await git.fetch(['--all', '--prune']);
      return {
        success: true,
        message: 'Fetched successfully',
      };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Fetch failed',
      };
    }
  }

  async checkout(repoPath: string, branch: string): Promise<GitOpResult> {
    try {
      const git = this.getGit(repoPath);
      await git.checkout(branch);
      return {
        success: true,
        message: `Checked out ${branch}`,
      };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Checkout failed',
      };
    }
  }

  async rebase(repoPath: string, branch?: string): Promise<GitOpResult> {
    try {
      const git = this.getGit(repoPath);
      if (branch) {
        await git.rebase([branch]);
      } else {
        // Rebase on tracking branch
        await git.rebase();
      }
      return {
        success: true,
        message: branch ? `Rebased onto ${branch}` : 'Rebased successfully',
      };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Rebase failed',
      };
    }
  }

  async rebaseAbort(repoPath: string): Promise<GitOpResult> {
    try {
      const git = this.getGit(repoPath);
      await git.rebase(['--abort']);
      return {
        success: true,
        message: 'Rebase aborted',
      };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Abort failed',
      };
    }
  }

  async stash(repoPath: string, message?: string): Promise<GitOpResult> {
    try {
      const git = this.getGit(repoPath);
      if (message) {
        await git.stash(['push', '-m', message]);
      } else {
        await git.stash(['push']);
      }
      return {
        success: true,
        message: 'Stashed changes',
      };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Stash failed',
      };
    }
  }

  async stashPop(repoPath: string): Promise<GitOpResult> {
    try {
      const git = this.getGit(repoPath);
      await git.stash(['pop']);
      return {
        success: true,
        message: 'Popped stash',
      };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Stash pop failed',
      };
    }
  }

  async stashList(repoPath: string): Promise<{ index: number; message: string }[]> {
    try {
      const git = this.getGit(repoPath);
      const result = await git.stashList();
      return result.all.map((entry, index) => ({
        index,
        message: entry.message,
      }));
    } catch {
      return [];
    }
  }

  async reset(repoPath: string, hard: boolean = false): Promise<GitOpResult> {
    try {
      const git = this.getGit(repoPath);
      if (hard) {
        await git.reset(['--hard', 'HEAD']);
      } else {
        await git.reset(['HEAD']);
      }
      return {
        success: true,
        message: hard ? 'Hard reset to HEAD' : 'Reset to HEAD',
      };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Reset failed',
      };
    }
  }

  async getChangedFiles(repoPath: string): Promise<{
    staged: string[];
    modified: string[];
    untracked: string[];
  }> {
    const git = this.getGit(repoPath);
    const status = await git.status();
    return {
      staged: status.staged,
      modified: [...status.modified, ...status.deleted],
      untracked: status.not_added,
    };
  }

  async stageAll(repoPath: string): Promise<GitOpResult> {
    try {
      const git = this.getGit(repoPath);
      await git.add(['-A']);
      return {
        success: true,
        message: 'Staged all changes',
      };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Stage failed',
      };
    }
  }

  async commit(repoPath: string, message: string): Promise<GitOpResult> {
    try {
      const git = this.getGit(repoPath);
      const result = await git.commit(message);
      return {
        success: true,
        message: `Committed: ${result.commit}`,
        data: result,
      };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Commit failed',
      };
    }
  }

  async stageAndCommit(repoPath: string, message: string): Promise<GitOpResult> {
    try {
      const git = this.getGit(repoPath);
      await git.add(['-A']);
      const result = await git.commit(message);
      return {
        success: true,
        message: `Committed: ${result.commit}`,
        data: result,
      };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Commit failed',
      };
    }
  }

  async getCommitDiff(repoPath: string, commitHash: string): Promise<string> {
    const git = this.getGit(repoPath);
    // Show diff for a specific commit
    const diff = await git.show([commitHash, '--stat', '--patch']);
    return diff;
  }

  async getWorkingDiff(repoPath: string): Promise<string> {
    const git = this.getGit(repoPath);
    // Show diff of working directory (staged + unstaged)
    const stagedDiff = await git.diff(['--cached']);
    const unstagedDiff = await git.diff();
    return stagedDiff + (stagedDiff && unstagedDiff ? '\n' : '') + unstagedDiff;
  }

  async getFileDiff(repoPath: string, filePath: string): Promise<string> {
    const git = this.getGit(repoPath);
    try {
      // Try staged first, then unstaged
      const stagedDiff = await git.diff(['--cached', '--', filePath]);
      if (stagedDiff) return stagedDiff;
      return await git.diff(['--', filePath]);
    } catch {
      return '';
    }
  }
}
