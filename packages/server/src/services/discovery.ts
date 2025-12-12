import Bonjour, { Service, Browser } from 'bonjour-service';
import { EventEmitter } from 'node:events';
import type { Config } from '../config.js';

const SERVICE_TYPE = 'sink-git';

export interface Peer {
  id: string;
  name: string;
  host: string;
  port: number;
  addresses: string[];
  lastSeen: number;
}

export class DiscoveryService extends EventEmitter {
  private bonjour: Bonjour;
  private browser: Browser | null = null;
  private service: Service | null = null;
  private config: Config;
  private peers: Map<string, Peer> = new Map();
  private selfId: string;

  constructor(config: Config) {
    super();
    this.config = config;
    this.bonjour = new Bonjour();
    this.selfId = `${config.machineName}-${config.port}`;
  }

  start(): void {
    // Advertise our service
    this.service = this.bonjour.publish({
      name: this.config.machineName,
      type: SERVICE_TYPE,
      port: this.config.port,
      txt: {
        id: this.selfId,
        version: '1',
      },
    });

    console.log(`Advertising as "${this.config.machineName}" on port ${this.config.port}`);

    // Browse for other instances
    this.browser = this.bonjour.find({ type: SERVICE_TYPE });

    this.browser.on('up', (service: Service) => {
      // Skip ourselves
      const serviceId = service.txt?.id || `${service.name}-${service.port}`;
      if (serviceId === this.selfId) {
        return;
      }

      const peer: Peer = {
        id: serviceId,
        name: service.name,
        host: service.host,
        port: service.port,
        addresses: service.addresses || [],
        lastSeen: Date.now(),
      };

      this.peers.set(peer.id, peer);
      console.log(`Peer discovered: ${peer.name} at ${peer.host}:${peer.port}`);
      this.emit('peer:up', peer);
    });

    this.browser.on('down', (service: Service) => {
      const serviceId = service.txt?.id || `${service.name}-${service.port}`;
      const peer = this.peers.get(serviceId);

      if (peer) {
        this.peers.delete(serviceId);
        console.log(`Peer gone: ${peer.name}`);
        this.emit('peer:down', peer);
      }
    });

    console.log('Discovery service started');
  }

  stop(): void {
    if (this.service) {
      this.service.stop?.();
      this.service = null;
    }

    if (this.browser) {
      this.browser.stop?.();
      this.browser = null;
    }

    this.bonjour.destroy();
    console.log('Discovery service stopped');
  }

  getPeers(): Peer[] {
    return Array.from(this.peers.values());
  }

  getPeerById(id: string): Peer | undefined {
    return this.peers.get(id);
  }

  getSelfInfo(): Peer {
    return {
      id: this.selfId,
      name: this.config.machineName,
      host: 'localhost',
      port: this.config.port,
      addresses: [],
      lastSeen: Date.now(),
    };
  }
}
