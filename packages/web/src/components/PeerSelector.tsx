import { usePeers } from '../hooks/useApi';
import type { Peer } from '../types';

interface PeerSelectorProps {
  selectedPeer: Peer | null;
  onSelectPeer: (peer: Peer | null) => void;
}

export function PeerSelector({ selectedPeer, onSelectPeer }: PeerSelectorProps) {
  const { data, isLoading, error } = usePeers();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <span className="w-2 h-2 rounded-full bg-zinc-600 animate-pulse" />
        Discovering peers...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-xs text-red-400">
        <span className="w-2 h-2 rounded-full bg-red-500" />
        Connection error
      </div>
    );
  }

  // Deduplicate peers by host:port
  const seenHostPorts = new Set<string>();
  const uniquePeers = data
    ? [data.self, ...data.peers].filter((peer) => {
        const key = `${peer.host}:${peer.port}`;
        if (seenHostPorts.has(key)) return false;
        seenHostPorts.add(key);
        return true;
      })
    : [];

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onSelectPeer(null)}
        className={`px-3 py-1.5 text-xs font-medium rounded transition-all ${
          selectedPeer === null
            ? 'bg-zinc-100 text-zinc-900'
            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
        }`}
      >
        All
      </button>
      <span className="w-px h-4 bg-zinc-800 mx-1" />
      {uniquePeers.map((peer) => {
        const isLocal = peer.id === data?.self.id;
        const isSelected = selectedPeer?.id === peer.id;

        return (
          <button
            key={peer.id}
            onClick={() => onSelectPeer(peer)}
            className={`group flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-all ${
              isSelected
                ? 'bg-zinc-100 text-zinc-900'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isLocal ? 'bg-emerald-500' : 'bg-blue-500'
              }`}
            />
            {peer.name.replace('.local', '')}
          </button>
        );
      })}
    </div>
  );
}
