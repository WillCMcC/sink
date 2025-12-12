import { FastifyInstance } from 'fastify';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { RepoScanner, RepoInfo } from '../services/scanner.js';
import { GitService, RepoStatus, CommitInfo, BranchInfo } from '../services/git.js';

export interface RepoWithStatus extends RepoInfo {
  status: RepoStatus;
  latestCommit: CommitInfo | null;
  hasCaprover?: boolean;
}

function hasCaproverConfig(repoPath: string): boolean {
  return existsSync(join(repoPath, 'captain-definition'));
}

export function registerRepoRoutes(
  app: FastifyInstance,
  scanner: RepoScanner,
  gitService: GitService
): void {
  // List all repos
  app.get('/api/repos', async () => {
    const repos = await scanner.scan();
    return repos;
  });

  // List repos with status (more data, slower)
  app.get('/api/repos/detailed', async () => {
    const repos = await scanner.scan();
    const detailed: RepoWithStatus[] = [];

    for (const repo of repos) {
      try {
        const [status, latestCommit] = await Promise.all([
          gitService.getStatus(repo.path),
          gitService.getLatestCommit(repo.path),
        ]);
        detailed.push({
          ...repo,
          status,
          latestCommit,
          hasCaprover: hasCaproverConfig(repo.path),
        });
      } catch (err) {
        // Skip repos that error
        console.warn(`Error getting status for ${repo.path}:`, err);
      }
    }

    return detailed;
  });

  // Get single repo
  app.get<{ Params: { id: string } }>('/api/repos/:id', async (request, reply) => {
    const repo = scanner.getRepoById(request.params.id);
    if (!repo) {
      return reply.status(404).send({ error: 'Repo not found' });
    }
    return repo;
  });

  // Get repo status
  app.get<{ Params: { id: string } }>('/api/repos/:id/status', async (request, reply) => {
    const repo = scanner.getRepoById(request.params.id);
    if (!repo) {
      return reply.status(404).send({ error: 'Repo not found' });
    }

    try {
      const status = await gitService.getStatus(repo.path);
      return status;
    } catch (err) {
      return reply.status(500).send({
        error: err instanceof Error ? err.message : 'Failed to get status',
      });
    }
  });

  // Get repo log
  app.get<{ Params: { id: string }; Querystring: { limit?: string } }>(
    '/api/repos/:id/log',
    async (request, reply) => {
      const repo = scanner.getRepoById(request.params.id);
      if (!repo) {
        return reply.status(404).send({ error: 'Repo not found' });
      }

      try {
        const limit = parseInt(request.query.limit || '20', 10);
        const log = await gitService.getLog(repo.path, limit);
        return log;
      } catch (err) {
        return reply.status(500).send({
          error: err instanceof Error ? err.message : 'Failed to get log',
        });
      }
    }
  );

  // Get repo branches
  app.get<{ Params: { id: string } }>('/api/repos/:id/branches', async (request, reply) => {
    const repo = scanner.getRepoById(request.params.id);
    if (!repo) {
      return reply.status(404).send({ error: 'Repo not found' });
    }

    try {
      const branches = await gitService.getBranches(repo.path);
      return branches;
    } catch (err) {
      return reply.status(500).send({
        error: err instanceof Error ? err.message : 'Failed to get branches',
      });
    }
  });

  // Force rescan
  app.post('/api/repos/scan', async () => {
    const repos = await scanner.scan(true);
    return { count: repos.length, repos };
  });

  // Deploy to CapRover
  app.post<{ Params: { id: string } }>('/api/repos/:id/deploy', async (request, reply) => {
    const repo = scanner.getRepoById(request.params.id);
    if (!repo) {
      return reply.status(404).send({ error: 'Repo not found' });
    }

    if (!hasCaproverConfig(repo.path)) {
      return reply.status(400).send({ error: 'No captain-definition found in repo' });
    }

    return new Promise((resolve) => {
      const proc = spawn('caprover', ['deploy', '--default'], {
        cwd: repo.path,
        env: { ...process.env },
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, message: 'Deploy completed', output: stdout });
        } else {
          resolve({
            success: false,
            message: `Deploy failed with code ${code}`,
            output: stdout + stderr,
          });
        }
      });

      proc.on('error', (err) => {
        resolve({
          success: false,
          message: `Failed to run caprover: ${err.message}`,
          output: '',
        });
      });
    });
  });
}
