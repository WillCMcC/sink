import { useState } from 'react';
import { PeerSelector } from './components/PeerSelector';
import { RepoList } from './components/RepoList';
import type { Peer } from './types';

function App() {
  const [selectedPeer, setSelectedPeer] = useState<Peer | null>(null);

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">
              <span className="text-blue-400">Sink</span>
            </h1>
          </div>
          <PeerSelector selectedPeer={selectedPeer} onSelectPeer={setSelectedPeer} />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <RepoList selectedPeer={selectedPeer} />
      </main>
    </div>
  );
}

export default App;
