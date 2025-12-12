import { useState } from 'react';
import { PeerSelector } from './components/PeerSelector';
import { RepoList } from './components/RepoList';
import { useWebSocket } from './hooks/useWebSocket';
import type { Peer } from './types';

function App() {
  const [selectedPeer, setSelectedPeer] = useState<Peer | null>(null);

  // Connect to WebSocket for live updates
  useWebSocket(selectedPeer?.host, selectedPeer?.port);

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/50">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-6">
              {/* Logo */}
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>
                <span className="font-semibold text-zinc-100 tracking-tight">Sink</span>
              </div>

              {/* Peer selector */}
              <PeerSelector selectedPeer={selectedPeer} onSelectPeer={setSelectedPeer} />
            </div>

            {/* Status legend */}
            <div className="hidden sm:flex items-center gap-4 text-[10px] text-zinc-500">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm bg-emerald-500" />
                <span>Clean</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm bg-amber-500" />
                <span>Modified</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm bg-blue-500" />
                <span>Ahead</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm bg-orange-500" />
                <span>Behind</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        <RepoList selectedPeer={selectedPeer} />
      </main>
    </div>
  );
}

export default App;
