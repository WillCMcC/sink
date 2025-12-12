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

  // Get changed files
  app.get<{ Params: { id: string } }>('/api/repos/:id/changes', async (request, reply) => {
    const repo = getRepo(request.params.id);
    if (!repo) {
      return reply.status(404).send({ error: 'Repo not found' });
    }
    return gitService.getChangedFiles(repo.path);
  });

  // Stage all
  app.post<{ Params: { id: string } }>('/api/repos/:id/stage', async (request, reply) => {
    const repo = getRepo(request.params.id);
    if (!repo) {
      return reply.status(404).send({ error: 'Repo not found' });
    }
    return gitService.stageAll(repo.path);
  });

  // Commit
  app.post<{ Params: { id: string }; Body: { message: string } }>(
    '/api/repos/:id/commit',
    async (request, reply) => {
      const repo = getRepo(request.params.id);
      if (!repo) {
        return reply.status(404).send({ error: 'Repo not found' });
      }

      const { message } = request.body || {};
      if (!message) {
        return reply.status(400).send({ error: 'Commit message required' });
      }

      return gitService.commit(repo.path, message);
    }
  );

  // Stage all and commit
  app.post<{ Params: { id: string }; Body: { message: string } }>(
    '/api/repos/:id/commit-all',
    async (request, reply) => {
      const repo = getRepo(request.params.id);
      if (!repo) {
        return reply.status(404).send({ error: 'Repo not found' });
      }

      const { message } = request.body || {};
      if (!message) {
        return reply.status(400).send({ error: 'Commit message required' });
      }

      return gitService.stageAndCommit(repo.path, message);
    }
  );

  // Get working directory diff
  app.get<{ Params: { id: string } }>('/api/repos/:id/diff', async (request, reply) => {
    const repo = getRepo(request.params.id);
    if (!repo) {
      return reply.status(404).send({ error: 'Repo not found' });
    }
    const diff = await gitService.getWorkingDiff(repo.path);
    return { diff };
  });

  // Get commit diff
  app.get<{ Params: { id: string; hash: string } }>(
    '/api/repos/:id/commits/:hash/diff',
    async (request, reply) => {
      const repo = getRepo(request.params.id);
      if (!repo) {
        return reply.status(404).send({ error: 'Repo not found' });
      }
      const diff = await gitService.getCommitDiff(repo.path, request.params.hash);
      return { diff };
    }
  );

  // Conflict resolution endpoints

  // Get conflicted file content (ours, theirs, merged)
  app.get<{ Params: { id: string }; Querystring: { file: string } }>(
    '/api/repos/:id/conflicts/file',
    async (request, reply) => {
      const repo = getRepo(request.params.id);
      if (!repo) {
        return reply.status(404).send({ error: 'Repo not found' });
      }
      const { file } = request.query;
      if (!file) {
        return reply.status(400).send({ error: 'File path required' });
      }
      return gitService.getConflictedFileContent(repo.path, file);
    }
  );

  // Resolve conflict using "ours" (our version)
  app.post<{ Params: { id: string }; Body: { file: string } }>(
    '/api/repos/:id/conflicts/resolve-ours',
    async (request, reply) => {
      const repo = getRepo(request.params.id);
      if (!repo) {
        return reply.status(404).send({ error: 'Repo not found' });
      }
      const { file } = request.body || {};
      if (!file) {
        return reply.status(400).send({ error: 'File path required' });
      }
      return gitService.resolveConflictOurs(repo.path, file);
    }
  );

  // Resolve conflict using "theirs" (their version)
  app.post<{ Params: { id: string }; Body: { file: string } }>(
    '/api/repos/:id/conflicts/resolve-theirs',
    async (request, reply) => {
      const repo = getRepo(request.params.id);
      if (!repo) {
        return reply.status(404).send({ error: 'Repo not found' });
      }
      const { file } = request.body || {};
      if (!file) {
        return reply.status(400).send({ error: 'File path required' });
      }
      return gitService.resolveConflictTheirs(repo.path, file);
    }
  );

  // Mark file as resolved (after manual edit)
  app.post<{ Params: { id: string }; Body: { file: string } }>(
    '/api/repos/:id/conflicts/mark-resolved',
    async (request, reply) => {
      const repo = getRepo(request.params.id);
      if (!repo) {
        return reply.status(404).send({ error: 'Repo not found' });
      }
      const { file } = request.body || {};
      if (!file) {
        return reply.status(400).send({ error: 'File path required' });
      }
      return gitService.markResolved(repo.path, file);
    }
  );

  // Abort merge
  app.post<{ Params: { id: string } }>('/api/repos/:id/merge/abort', async (request, reply) => {
    const repo = getRepo(request.params.id);
    if (!repo) {
      return reply.status(404).send({ error: 'Repo not found' });
    }
    return gitService.abortMerge(repo.path);
  });

  // Continue/complete merge (after resolving all conflicts)
  app.post<{ Params: { id: string } }>('/api/repos/:id/merge/continue', async (request, reply) => {
    const repo = getRepo(request.params.id);
    if (!repo) {
      return reply.status(404).send({ error: 'Repo not found' });
    }
    return gitService.continueMerge(repo.path);
  });

  // Continue rebase (after resolving conflicts)
  app.post<{ Params: { id: string } }>('/api/repos/:id/rebase/continue', async (request, reply) => {
    const repo = getRepo(request.params.id);
    if (!repo) {
      return reply.status(404).send({ error: 'Repo not found' });
    }
    return gitService.continueRebase(repo.path);
  });
}
