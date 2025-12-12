import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  RepoWithStatus,
  PeersResponse,
  GitOpResult,
  BranchInfo,
  CommitInfo,
} from '../types';

// Base URL for API calls - can be overridden for peer queries
function getBaseUrl(peerHost?: string, peerPort?: number): string {
  if (peerHost && peerPort) {
    return `http://${peerHost}:${peerPort}`;
  }
  return '';
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

// Peers
export function usePeers() {
  return useQuery({
    queryKey: ['peers'],
    queryFn: () => fetchJson<PeersResponse>('/api/peers'),
  });
}

// Repos (detailed with status)
export function useRepos(peerHost?: string, peerPort?: number) {
  const baseUrl = getBaseUrl(peerHost, peerPort);
  return useQuery({
    queryKey: ['repos', peerHost, peerPort],
    queryFn: () => fetchJson<RepoWithStatus[]>(`${baseUrl}/api/repos/detailed`),
  });
}

// Single repo branches
export function useBranches(repoId: string, peerHost?: string, peerPort?: number) {
  const baseUrl = getBaseUrl(peerHost, peerPort);
  return useQuery({
    queryKey: ['branches', repoId, peerHost, peerPort],
    queryFn: () => fetchJson<BranchInfo[]>(`${baseUrl}/api/repos/${repoId}/branches`),
    enabled: !!repoId,
  });
}

// Single repo log
export function useRepoLog(repoId: string, peerHost?: string, peerPort?: number) {
  const baseUrl = getBaseUrl(peerHost, peerPort);
  return useQuery({
    queryKey: ['log', repoId, peerHost, peerPort],
    queryFn: () => fetchJson<CommitInfo[]>(`${baseUrl}/api/repos/${repoId}/log`),
    enabled: !!repoId,
  });
}

// Git operations
export function useGitOp(peerHost?: string, peerPort?: number) {
  const queryClient = useQueryClient();
  const baseUrl = getBaseUrl(peerHost, peerPort);

  return useMutation({
    mutationFn: async ({
      repoId,
      operation,
      body,
    }: {
      repoId: string;
      operation: string;
      body?: unknown;
    }) => {
      return postJson<GitOpResult>(`${baseUrl}/api/repos/${repoId}/${operation}`, body);
    },
    onSuccess: () => {
      // Invalidate repos to refresh status
      queryClient.invalidateQueries({ queryKey: ['repos'] });
    },
  });
}

// Force rescan
export function useRescan(peerHost?: string, peerPort?: number) {
  const queryClient = useQueryClient();
  const baseUrl = getBaseUrl(peerHost, peerPort);

  return useMutation({
    mutationFn: async () => {
      return postJson<{ count: number }>(`${baseUrl}/api/repos/scan`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repos'] });
    },
  });
}
