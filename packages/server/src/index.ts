import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import websocket from '@fastify/websocket';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { WebSocket } from 'ws';

import { loadConfig } from './config.js';
import { RepoScanner } from './services/scanner.js';
import { GitService } from './services/git.js';
import { DiscoveryService } from './services/discovery.js';
import { GitWatcher } from './services/watcher.js';
import { registerRepoRoutes } from './api/repos.js';
import { registerGitRoutes } from './api/git.js';
import { registerPeerRoutes } from './api/peers.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const config = loadConfig();

  console.log('Starting Sink...');
  console.log(`Machine: ${config.machineName}`);
  console.log(`Port: ${config.port}`);
  console.log(`Scan paths: ${config.scanPaths.join(', ')}`);

  // Initialize services
  const scanner = new RepoScanner(config);
  const gitService = new GitService();
  const discovery = new DiscoveryService(config);
  const watcher = new GitWatcher();

  // Track connected WebSocket clients
  const clients = new Set<WebSocket>();

  // Initial scan
  console.log('Scanning for repositories...');
  const repos = await scanner.scan();
  console.log(`Found ${repos.length} repositories`);

  // Start watching repos
  watcher.watchRepos(repos);

  // When a repo changes, notify all connected clients
  watcher.on('change', async (repo) => {
    console.log(`Change detected: ${repo.name}`);

    // Get updated status for this repo
    try {
      const status = await gitService.getStatus(repo.path);
      const latestCommit = await gitService.getLatestCommit(repo.path);

      const message = JSON.stringify({
        type: 'repo-changed',
        repo: {
          ...repo,
          status,
          latestCommit,
        },
      });

      // Broadcast to all clients
      for (const client of clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      }
    } catch (err) {
      console.warn(`Failed to get status for ${repo.name}:`, err);
    }
  });

  // Create Fastify app
  const app = Fastify({
    logger: false,
  });

  // CORS for development
  await app.register(cors, {
    origin: true,
  });

  // WebSocket support
  await app.register(websocket);

  // WebSocket endpoint for live updates
  app.get('/ws', { websocket: true }, (socket) => {
    clients.add(socket);
    console.log(`WebSocket client connected (${clients.size} total)`);

    socket.on('close', () => {
      clients.delete(socket);
      console.log(`WebSocket client disconnected (${clients.size} total)`);
    });

    socket.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'ping') {
          socket.send(JSON.stringify({ type: 'pong' }));
        }
      } catch {
        // Ignore invalid messages
      }
    });

    // Send initial connection confirmation
    socket.send(JSON.stringify({ type: 'connected', machine: config.machineName }));
  });

  // Serve static frontend files if they exist
  const webDistPath = join(__dirname, '../../web/dist');
  if (existsSync(webDistPath)) {
    await app.register(fastifyStatic, {
      root: webDistPath,
      prefix: '/',
    });

    // SPA fallback
    app.setNotFoundHandler((request, reply) => {
      if (!request.url.startsWith('/api') && !request.url.startsWith('/ws')) {
        return reply.sendFile('index.html');
      }
      reply.status(404).send({ error: 'Not found' });
    });
  }

  // Register API routes
  registerRepoRoutes(app, scanner, gitService);
  registerGitRoutes(app, scanner, gitService);
  registerPeerRoutes(app, discovery, config);

  // Start discovery
  discovery.start();

  // Handle shutdown
  const shutdown = () => {
    console.log('\nShutting down...');
    watcher.stopAll();
    discovery.stop();
    for (const client of clients) {
      client.close();
    }
    app.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Start server
  try {
    await app.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`\nSink is running at http://localhost:${config.port}`);
    console.log('Press Ctrl+C to stop\n');
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

main();
