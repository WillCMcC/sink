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

export function RepoList({ selectedPeer }: RepoListProps) {
  const { data: peersData } = usePeers();
  const localRepos = useRepos();
  const rescan = useRescan();

  // For simplicity, we'll just show local repos for now
  // In a full implementation, we'd query each peer
  const isLoading = localRepos.isLoading;
  const error = localRepos.error;

  const aggregatedRepos: AggregatedRepo[] = [];

  if (localRepos.data && peersData) {
    // Add local repos
    if (!selectedPeer || selectedPeer.id === peersData.self.id) {
      for (const repo of localRepos.data) {
        aggregatedRepos.push({
          ...repo,
          machineName: peersData.self.name,
          peer: undefined, // Local
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

  if (isLoading) {
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
        />
      ))}
    </div>
  );
}
