import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

import { loadConfig } from './config.js';
import { RepoScanner } from './services/scanner.js';
import { GitService } from './services/git.js';
import { DiscoveryService } from './services/discovery.js';
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

  // Initial scan
  console.log('Scanning for repositories...');
  const repos = await scanner.scan();
  console.log(`Found ${repos.length} repositories`);

  // Create Fastify app
  const app = Fastify({
    logger: false,
  });

  // CORS for development
  await app.register(cors, {
    origin: true,
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
      if (!request.url.startsWith('/api')) {
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
    discovery.stop();
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
