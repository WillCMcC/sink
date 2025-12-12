import { readFileSync, existsSync } from 'node:fs';
import { homedir, hostname } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';

const PeerSchema = z.object({
  name: z.string(),
  host: z.string(),
  port: z.number().default(3847),
});

const ConfigSchema = z.object({
  scanPaths: z.array(z.string()).default(['~/Code']),
  ignorePaths: z.array(z.string()).default(['node_modules', '.git', 'dist', 'build']),
  manualRepos: z.array(z.string()).default([]),
  peers: z.array(PeerSchema).default([]),
  port: z.number().default(3847),
  machineName: z.string().default(''),
});

export type PeerConfig = z.infer<typeof PeerSchema>;

export type Config = z.infer<typeof ConfigSchema>;

function expandPath(path: string): string {
  if (path.startsWith('~/')) {
    return join(homedir(), path.slice(2));
  }
  return path;
}

export function loadConfig(): Config {
  const configPaths = [
    join(process.cwd(), 'sink.config.json'),
    join(homedir(), '.config', 'sink', 'config.json'),
    join(homedir(), '.sink.config.json'),
  ];

  let rawConfig = {};

  for (const configPath of configPaths) {
    if (existsSync(configPath)) {
      try {
        const content = readFileSync(configPath, 'utf-8');
        rawConfig = JSON.parse(content);
        console.log(`Loaded config from ${configPath}`);
        break;
      } catch (err) {
        console.warn(`Failed to parse config at ${configPath}:`, err);
      }
    }
  }

  const config = ConfigSchema.parse(rawConfig);

  // Expand ~ in paths
  config.scanPaths = config.scanPaths.map(expandPath);
  config.manualRepos = config.manualRepos.map(expandPath);

  // Default machine name to hostname
  if (!config.machineName) {
    config.machineName = hostname();
  }

  return config;
}
