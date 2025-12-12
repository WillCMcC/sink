import { usePeers } from '../hooks/useApi';
import type { Peer } from '../types';

interface PeerSelectorProps {
  selectedPeer: Peer | null;
  onSelectPeer: (peer: Peer | null) => void;
}

export function PeerSelector({ selectedPeer, onSelectPeer }: PeerSelectorProps) {
  const { data, isLoading, error } = usePeers();

  if (isLoading) {
    return <div className="text-gray-500">Discovering peers...</div>;
  }

  if (error) {
    return <div className="text-red-400">Failed to load peers</div>;
  }

  // Deduplicate peers by host:port (manual config + mDNS might overlap)
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
    <div className="flex gap-2 flex-wrap">
      <button
        onClick={() => onSelectPeer(null)}
        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
          selectedPeer === null
            ? 'bg-blue-600 text-white'
            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
        }`}
      >
        All Machines
      </button>
      {uniquePeers.map((peer) => (
        <button
          key={peer.id}
          onClick={() => onSelectPeer(peer)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            selectedPeer?.id === peer.id
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          {peer.name}
          {peer.id === data?.self.id && (
            <span className="ml-1.5 text-xs opacity-60">(this)</span>
          )}
        </button>
      ))}
    </div>
  );
}
