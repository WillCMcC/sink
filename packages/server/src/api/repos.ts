import { FastifyInstance } from 'fastify';
import { RepoScanner, RepoInfo } from '../services/scanner.js';
import { GitService, RepoStatus, CommitInfo, BranchInfo } from '../services/git.js';

export interface RepoWithStatus extends RepoInfo {
  status: RepoStatus;
  latestCommit: CommitInfo | null;
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
        detailed.push({ ...repo, status, latestCommit });
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
}
