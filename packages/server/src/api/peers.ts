import { FastifyInstance } from 'fastify';
import { DiscoveryService } from '../services/discovery.js';
import type { Config } from '../config.js';

export function registerPeerRoutes(
  app: FastifyInstance,
  discovery: DiscoveryService,
  config: Config
): void {
  // List all discovered peers
  app.get('/api/peers', async () => {
    const peers = discovery.getPeers();
    const self = discovery.getSelfInfo();
    return {
      self,
      peers,
    };
  });

  // Health check (used by other peers)
  app.get('/api/health', async () => {
    return {
      status: 'ok',
      name: config.machineName,
      timestamp: Date.now(),
    };
  });

  // Get info about this machine
  app.get('/api/self', async () => {
    return discovery.getSelfInfo();
  });
}
