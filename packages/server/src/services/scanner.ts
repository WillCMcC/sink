import { readdir, stat } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { createHash } from 'node:crypto';
import type { Config } from '../config.js';

export interface RepoInfo {
  id: string;
  name: string;
  path: string;
}

function generateRepoId(path: string): string {
  return createHash('sha256').update(path).digest('hex').slice(0, 12);
}

async function isGitRepo(dirPath: string): Promise<boolean> {
  try {
    const gitPath = join(dirPath, '.git');
    const stats = await stat(gitPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

async function scanDirectory(
  dirPath: string,
  ignorePaths: string[],
  maxDepth: number = 4,
  currentDepth: number = 0
): Promise<RepoInfo[]> {
  const repos: RepoInfo[] = [];

  if (currentDepth > maxDepth) {
    return repos;
  }

  try {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (ignorePaths.includes(entry.name)) continue;
      if (entry.name.startsWith('.') && entry.name !== '.git') continue;

      const fullPath = join(dirPath, entry.name);

      if (await isGitRepo(fullPath)) {
        repos.push({
          id: generateRepoId(fullPath),
          name: basename(fullPath),
          path: fullPath,
        });
        // Don't scan inside git repos for nested repos
        continue;
      }

      // Recursively scan subdirectories
      const subRepos = await scanDirectory(fullPath, ignorePaths, maxDepth, currentDepth + 1);
      repos.push(...subRepos);
    }
  } catch (err) {
    // Directory might not be readable, skip it
    console.warn(`Could not scan ${dirPath}:`, err);
  }

  return repos;
}

export class RepoScanner {
  private config: Config;
  private cachedRepos: RepoInfo[] = [];
  private lastScan: number = 0;
  private scanInterval: number = 30000; // 30 seconds cache

  constructor(config: Config) {
    this.config = config;
  }

  async scan(force: boolean = false): Promise<RepoInfo[]> {
    const now = Date.now();

    if (!force && this.cachedRepos.length > 0 && now - this.lastScan < this.scanInterval) {
      return this.cachedRepos;
    }

    const allRepos: RepoInfo[] = [];

    // Scan configured paths
    for (const scanPath of this.config.scanPaths) {
      const repos = await scanDirectory(scanPath, this.config.ignorePaths);
      allRepos.push(...repos);
    }

    // Add manually configured repos
    for (const repoPath of this.config.manualRepos) {
      if (await isGitRepo(repoPath)) {
        allRepos.push({
          id: generateRepoId(repoPath),
          name: basename(repoPath),
          path: repoPath,
        });
      }
    }

    // Deduplicate by path
    const seen = new Set<string>();
    this.cachedRepos = allRepos.filter((repo) => {
      if (seen.has(repo.path)) return false;
      seen.add(repo.path);
      return true;
    });

    this.lastScan = now;
    return this.cachedRepos;
  }

  getRepoById(id: string): RepoInfo | undefined {
    return this.cachedRepos.find((r) => r.id === id);
  }

  getRepoByPath(path: string): RepoInfo | undefined {
    return this.cachedRepos.find((r) => r.path === path);
  }
}
