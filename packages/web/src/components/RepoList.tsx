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

    if (localRepos.data) {
      for (const repo of localRepos.data) {
        const existing = map.get(repo.name) || [];
        existing.push({ peer: undefined, repo, machineName: peersData.self.name });
        map.set(repo.name, existing);
      }
    }

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
    if (localRepos.data && (!selectedPeer || selectedPeer.id === peersData.self.id)) {
      for (const repo of localRepos.data) {
        aggregatedRepos.push({
          ...repo,
          machineName: peersData.self.name,
          peer: undefined,
        });
      }
    }

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

  // Sort by latest commit timestamp
  aggregatedRepos.sort((a, b) => {
    const aTime = a.latestCommit?.timestamp ?? 0;
    const bTime = b.latestCommit?.timestamp ?? 0;
    return bTime - aTime;
  });

  const getOtherMachines = (repo: AggregatedRepo): RepoOnPeer[] => {
    const allVersions = reposByName.get(repo.name) || [];
    return allVersions
      .filter((v) => v.machineName !== repo.machineName && v.peer)
      .map((v) => ({ peer: v.peer!, repo: v.repo }));
  };

  // Stats
  const stats = useMemo(() => {
    let clean = 0, modified = 0, ahead = 0, behind = 0;
    for (const repo of aggregatedRepos) {
      if (repo.status.isClean) clean++;
      else modified++;
      if (repo.status.ahead > 0) ahead++;
      if (repo.status.behind > 0) behind++;
    }
    return { clean, modified, ahead, behind, total: aggregatedRepos.length };
  }, [aggregatedRepos]);

  if (isLoading && aggregatedRepos.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-zinc-500">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">Loading repositories...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-red-400 text-sm">Failed to load repositories</div>
      </div>
    );
  }

  if (aggregatedRepos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="text-zinc-500 text-sm">No repositories found</div>
        <button
          onClick={() => rescan.mutate()}
          disabled={rescan.isPending}
          className="px-4 py-2 text-sm font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors disabled:opacity-50"
        >
          {rescan.isPending ? 'Scanning...' : 'Rescan'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs">
          <span className="text-zinc-400 font-medium">{stats.total} repos</span>
          {stats.modified > 0 && (
            <span className="text-amber-400">{stats.modified} modified</span>
          )}
          {stats.ahead > 0 && (
            <span className="text-blue-400">{stats.ahead} ahead</span>
          )}
          {stats.behind > 0 && (
            <span className="text-orange-400">{stats.behind} behind</span>
          )}
          {isLoading && (
            <span className="text-zinc-500">Loading...</span>
          )}
        </div>
        <button
          onClick={() => rescan.mutate()}
          disabled={rescan.isPending}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-50"
        >
          {rescan.isPending ? 'Scanning...' : 'Rescan'}
        </button>
      </div>

      {/* Repo list */}
      <div className="space-y-px rounded-lg overflow-hidden border border-zinc-800/50">
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
    </div>
  );
}
