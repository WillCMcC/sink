import { useEffect, useState, useMemo } from 'react';
import { useRepos, usePeers, useRescan } from '../hooks/useApi';
import { RepoCard } from './RepoCard';
import type { Peer, RepoWithStatus } from '../types';

interface RepoListProps {
  selectedPeer: Peer | null;
}

interface AggregatedRepo extends RepoWithStatus {
  machineName: string;
  peer?: Peer;
}

interface RepoOnPeer {
  peer: Peer;
  repo: RepoWithStatus;
}

export function RepoList({ selectedPeer }: RepoListProps) {
  const { data: peersData } = usePeers();
  const localRepos = useRepos();
  const rescan = useRescan();
  const [peerRepos, setPeerRepos] = useState<Map<string, RepoWithStatus[]>>(new Map());
  const [loadingPeers, setLoadingPeers] = useState<Set<string>>(new Set());

  // Fetch repos from peers
  useEffect(() => {
    if (!peersData?.peers) return;

    const fetchPeerRepos = async (peer: Peer) => {
      // Skip if already loading or loaded
      if (loadingPeers.has(peer.id) || peerRepos.has(peer.id)) return;

      setLoadingPeers((prev) => new Set(prev).add(peer.id));

      try {
        const res = await fetch(`http://${peer.host}:${peer.port}/api/repos/detailed`);
        if (res.ok) {
          const repos: RepoWithStatus[] = await res.json();
          setPeerRepos((prev) => new Map(prev).set(peer.id, repos));
        }
      } catch (err) {
        console.warn(`Failed to fetch repos from ${peer.name}:`, err);
        setPeerRepos((prev) => new Map(prev).set(peer.id, []));
      } finally {
        setLoadingPeers((prev) => {
          const next = new Set(prev);
          next.delete(peer.id);
          return next;
        });
      }
    };

    // Deduplicate peers by host:port (manual config + mDNS might overlap)
    const seenHostPorts = new Set<string>();
    const uniquePeers = peersData.peers.filter((peer) => {
      const key = `${peer.host}:${peer.port}`;
      if (seenHostPorts.has(key)) return false;
      seenHostPorts.add(key);
      return true;
    });

    uniquePeers.forEach(fetchPeerRepos);
  }, [peersData?.peers]);

  // Build a map of repo name -> all machines that have it
  const reposByName = useMemo(() => {
    const map = new Map<string, { peer?: Peer; repo: RepoWithStatus; machineName: string }[]>();

    if (!peersData) return map;

    // Add local repos
    if (localRepos.data) {
      for (const repo of localRepos.data) {
        const existing = map.get(repo.name) || [];
        existing.push({ peer: undefined, repo, machineName: peersData.self.name });
        map.set(repo.name, existing);
      }
    }

    // Add peer repos (deduplicated by host:port)
    const seenHostPorts = new Set<string>();
    for (const peer of peersData.peers) {
      const hostPort = `${peer.host}:${peer.port}`;
      if (seenHostPorts.has(hostPort)) continue;
      seenHostPorts.add(hostPort);

      const repos = peerRepos.get(peer.id) || [];
      for (const repo of repos) {
        const existing = map.get(repo.name) || [];
        existing.push({ peer, repo, machineName: peer.name });
        map.set(repo.name, existing);
      }
    }

    return map;
  }, [peersData, localRepos.data, peerRepos]);

  const isLoading = localRepos.isLoading || loadingPeers.size > 0;
  const error = localRepos.error;

  const aggregatedRepos: AggregatedRepo[] = [];

  if (peersData) {
    // Add local repos
    if (localRepos.data && (!selectedPeer || selectedPeer.id === peersData.self.id)) {
      for (const repo of localRepos.data) {
        aggregatedRepos.push({
          ...repo,
          machineName: peersData.self.name,
          peer: undefined,
        });
      }
    }

    // Add peer repos (deduplicated)
    const seenHostPorts = new Set<string>();
    for (const peer of peersData.peers) {
      const hostPort = `${peer.host}:${peer.port}`;
      if (seenHostPorts.has(hostPort)) continue;
      seenHostPorts.add(hostPort);

      if (selectedPeer && selectedPeer.id !== peer.id) continue;

      const repos = peerRepos.get(peer.id) || [];
      for (const repo of repos) {
        aggregatedRepos.push({
          ...repo,
          machineName: peer.name,
          peer,
        });
      }
    }
  }

  // Sort by latest commit timestamp (most recent first)
  aggregatedRepos.sort((a, b) => {
    const aTime = a.latestCommit?.timestamp ?? 0;
    const bTime = b.latestCommit?.timestamp ?? 0;
    return bTime - aTime;
  });

  // Helper to get other machines for a repo
  const getOtherMachines = (repo: AggregatedRepo): RepoOnPeer[] => {
    const allVersions = reposByName.get(repo.name) || [];
    return allVersions
      .filter((v) => v.machineName !== repo.machineName && v.peer)
      .map((v) => ({ peer: v.peer!, repo: v.repo }));
  };

  if (isLoading && aggregatedRepos.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading repositories...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-red-400">Failed to load repositories</div>
      </div>
    );
  }

  if (aggregatedRepos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <div className="text-gray-500">No repositories found</div>
        <button
          onClick={() => rescan.mutate()}
          disabled={rescan.isPending}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors disabled:opacity-50"
        >
          {rescan.isPending ? 'Scanning...' : 'Rescan'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          {aggregatedRepos.length} repositor{aggregatedRepos.length === 1 ? 'y' : 'ies'}
          {isLoading && ' (loading more...)'}
        </div>
        <button
          onClick={() => rescan.mutate()}
          disabled={rescan.isPending}
          className="text-sm px-3 py-1 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
        >
          {rescan.isPending ? 'Scanning...' : 'Rescan'}
        </button>
      </div>
      {aggregatedRepos.map((repo) => (
        <RepoCard
          key={`${repo.machineName}-${repo.id}`}
          repo={repo}
          peer={repo.peer}
          machineName={selectedPeer === null ? repo.machineName : undefined}
          otherMachines={getOtherMachines(repo)}
        />
      ))}
    </div>
  );
}
