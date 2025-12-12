import { useState } from 'react';
import type { RepoWithStatus, Peer } from '../types';
import { useGitOp } from '../hooks/useApi';

interface RepoCardProps {
  repo: RepoWithStatus;
  peer?: Peer;
  machineName?: string;
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function RepoCard({ repo, peer, machineName }: RepoCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [opResult, setOpResult] = useState<{ success: boolean; message: string } | null>(null);
  const gitOp = useGitOp(peer?.host, peer?.port);

  const runOp = async (operation: string, body?: unknown) => {
    setOpResult(null);
    try {
      const result = await gitOp.mutateAsync({ repoId: repo.id, operation, body });
      setOpResult(result);
    } catch (err) {
      setOpResult({ success: false, message: err instanceof Error ? err.message : 'Failed' });
    }
  };

  const { status, latestCommit } = repo;

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <div
        className="p-4 cursor-pointer hover:bg-gray-800/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg truncate">{repo.name}</h3>
              {machineName && (
                <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-400">
                  {machineName}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 truncate mt-0.5">{repo.path}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono bg-gray-800 px-2 py-0.5 rounded">
                {status.branch}
              </span>
              {status.isClean ? (
                <span className="w-2 h-2 rounded-full bg-green-500" title="Clean" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-yellow-500" title="Has changes" />
              )}
            </div>
            {latestCommit && (
              <span className="text-xs text-gray-500">
                {formatTimeAgo(latestCommit.timestamp)}
              </span>
            )}
          </div>
        </div>

        {/* Status badges */}
        <div className="flex flex-wrap gap-2 mt-3">
          {status.ahead > 0 && (
            <span className="text-xs px-2 py-0.5 rounded bg-green-900/50 text-green-400">
              {status.ahead} ahead
            </span>
          )}
          {status.behind > 0 && (
            <span className="text-xs px-2 py-0.5 rounded bg-orange-900/50 text-orange-400">
              {status.behind} behind
            </span>
          )}
          {status.staged > 0 && (
            <span className="text-xs px-2 py-0.5 rounded bg-blue-900/50 text-blue-400">
              {status.staged} staged
            </span>
          )}
          {status.modified > 0 && (
            <span className="text-xs px-2 py-0.5 rounded bg-yellow-900/50 text-yellow-400">
              {status.modified} modified
            </span>
          )}
          {status.untracked > 0 && (
            <span className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-400">
              {status.untracked} untracked
            </span>
          )}
          {status.stashes > 0 && (
            <span className="text-xs px-2 py-0.5 rounded bg-purple-900/50 text-purple-400">
              {status.stashes} stash{status.stashes > 1 ? 'es' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Expanded section with actions */}
      {expanded && (
        <div className="border-t border-gray-800 p-4 bg-gray-900/50">
          {latestCommit && (
            <div className="mb-4 text-sm">
              <div className="text-gray-400 mb-1">Latest commit:</div>
              <div className="font-mono text-xs text-gray-500 mb-1">{latestCommit.shortHash}</div>
              <div className="text-gray-200">{latestCommit.message}</div>
              <div className="text-gray-500 text-xs mt-1">
                by {latestCommit.author} &middot; {latestCommit.date}
              </div>
            </div>
          )}

          {opResult && (
            <div
              className={`mb-4 p-3 rounded-lg text-sm ${
                opResult.success
                  ? 'bg-green-900/30 text-green-400 border border-green-800'
                  : 'bg-red-900/30 text-red-400 border border-red-800'
              }`}
            >
              {opResult.message}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                runOp('fetch');
              }}
              disabled={gitOp.isPending}
              className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
            >
              Fetch
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                runOp('pull');
              }}
              disabled={gitOp.isPending}
              className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
            >
              Pull
            </button>
            {status.ahead > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  runOp('push');
                }}
                disabled={gitOp.isPending}
                className="px-3 py-1.5 text-sm bg-green-800 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
              >
                Push
              </button>
            )}
            {status.behind > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  runOp('rebase');
                }}
                disabled={gitOp.isPending}
                className="px-3 py-1.5 text-sm bg-orange-800 hover:bg-orange-700 rounded-lg transition-colors disabled:opacity-50"
              >
                Rebase
              </button>
            )}
            {!status.isClean && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  runOp('stash');
                }}
                disabled={gitOp.isPending}
                className="px-3 py-1.5 text-sm bg-purple-800 hover:bg-purple-700 rounded-lg transition-colors disabled:opacity-50"
              >
                Stash
              </button>
            )}
            {status.stashes > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  runOp('stash/pop');
                }}
                disabled={gitOp.isPending}
                className="px-3 py-1.5 text-sm bg-purple-800 hover:bg-purple-700 rounded-lg transition-colors disabled:opacity-50"
              >
                Pop Stash
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
