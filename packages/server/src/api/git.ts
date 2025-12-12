import { FastifyInstance } from 'fastify';
import { RepoScanner } from '../services/scanner.js';
import { GitService } from '../services/git.js';

export function registerGitRoutes(
  app: FastifyInstance,
  scanner: RepoScanner,
  gitService: GitService
): void {
  // Helper to get repo or 404
  const getRepo = (id: string) => {
    const repo = scanner.getRepoById(id);
    return repo;
  };

  // Pull
  app.post<{ Params: { id: string } }>('/api/repos/:id/pull', async (request, reply) => {
    const repo = getRepo(request.params.id);
    if (!repo) {
      return reply.status(404).send({ error: 'Repo not found' });
    }
    return gitService.pull(repo.path);
  });

  // Push
  app.post<{ Params: { id: string } }>('/api/repos/:id/push', async (request, reply) => {
    const repo = getRepo(request.params.id);
    if (!repo) {
      return reply.status(404).send({ error: 'Repo not found' });
    }
    return gitService.push(repo.path);
  });

  // Fetch
  app.post<{ Params: { id: string } }>('/api/repos/:id/fetch', async (request, reply) => {
    const repo = getRepo(request.params.id);
    if (!repo) {
      return reply.status(404).send({ error: 'Repo not found' });
    }
    return gitService.fetch(repo.path);
  });

  // Checkout
  app.post<{ Params: { id: string }; Body: { branch: string } }>(
    '/api/repos/:id/checkout',
    async (request, reply) => {
      const repo = getRepo(request.params.id);
      if (!repo) {
        return reply.status(404).send({ error: 'Repo not found' });
      }

      const { branch } = request.body || {};
      if (!branch) {
        return reply.status(400).send({ error: 'Branch name required' });
      }

      return gitService.checkout(repo.path, branch);
    }
  );

  // Rebase
  app.post<{ Params: { id: string }; Body: { branch?: string } }>(
    '/api/repos/:id/rebase',
    async (request, reply) => {
      const repo = getRepo(request.params.id);
      if (!repo) {
        return reply.status(404).send({ error: 'Repo not found' });
      }

      const { branch } = request.body || {};
      return gitService.rebase(repo.path, branch);
    }
  );

  // Rebase abort
  app.post<{ Params: { id: string } }>('/api/repos/:id/rebase/abort', async (request, reply) => {
    const repo = getRepo(request.params.id);
    if (!repo) {
      return reply.status(404).send({ error: 'Repo not found' });
    }
    return gitService.rebaseAbort(repo.path);
  });

  // Stash
  app.post<{ Params: { id: string }; Body: { message?: string } }>(
    '/api/repos/:id/stash',
    async (request, reply) => {
      const repo = getRepo(request.params.id);
      if (!repo) {
        return reply.status(404).send({ error: 'Repo not found' });
      }

      const { message } = request.body || {};
      return gitService.stash(repo.path, message);
    }
  );

  // Stash pop
  app.post<{ Params: { id: string } }>('/api/repos/:id/stash/pop', async (request, reply) => {
    const repo = getRepo(request.params.id);
    if (!repo) {
      return reply.status(404).send({ error: 'Repo not found' });
    }
    return gitService.stashPop(repo.path);
  });

  // Stash list
  app.get<{ Params: { id: string } }>('/api/repos/:id/stash', async (request, reply) => {
    const repo = getRepo(request.params.id);
    if (!repo) {
      return reply.status(404).send({ error: 'Repo not found' });
    }
    return gitService.stashList(repo.path);
  });

  // Reset
  app.post<{ Params: { id: string }; Body: { hard?: boolean } }>(
    '/api/repos/:id/reset',
    async (request, reply) => {
      const repo = getRepo(request.params.id);
      if (!repo) {
        return reply.status(404).send({ error: 'Repo not found' });
      }

      const { hard } = request.body || {};
      return gitService.reset(repo.path, hard);
    }
  );
}
