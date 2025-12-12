import { useState } from 'react';
import type { RepoWithStatus, Peer, CommitInfo } from '../types';
import { useGitOp, useRepoLog } from '../hooks/useApi';

interface RepoOnPeer {
  peer: Peer;
  repo: RepoWithStatus;
}

interface RepoCardProps {
  repo: RepoWithStatus;
  peer?: Peer;
  machineName?: string;
  otherMachines?: RepoOnPeer[];
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Determine the primary status for the left bar indicator
function getStatusType(status: RepoWithStatus['status'], hasNewerElsewhere: boolean): string {
  if (status.conflicted > 0) return 'conflict';
  if (status.mergeInProgress || status.rebaseInProgress) return 'conflict';
  if (status.behind > 0 && status.ahead > 0) return 'conflict';
  if (status.behind > 0) return 'behind';
  if (status.ahead > 0) return 'ahead';
  if (!status.isClean) return 'modified';
  if (hasNewerElsewhere) return 'behind';
  return 'clean';
}

export function RepoCard({ repo, peer, machineName, otherMachines = [] }: RepoCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'actions' | 'history' | 'commit' | 'conflicts'>('actions');
  const [selectedConflictFile, setSelectedConflictFile] = useState<string | null>(null);
  const [conflictContent, setConflictContent] = useState<{ ours: string; theirs: string; merged: string } | null>(null);
  const [opResult, setOpResult] = useState<{ success: boolean; message: string } | null>(null);
  const [commitMessage, setCommitMessage] = useState('');
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null);
  const [diffContent, setDiffContent] = useState<string | null>(null);
  const [loadingDiff, setLoadingDiff] = useState(false);

  const gitOp = useGitOp(peer?.host, peer?.port);
  const { data: commits } = useRepoLog(expanded ? repo.id : '', peer?.host, peer?.port);

  const runOp = async (operation: string, body?: unknown) => {
    setOpResult(null);
    try {
      const result = await gitOp.mutateAsync({ repoId: repo.id, operation, body });
      setOpResult(result);
      if (result.success && operation === 'commit-all') {
        setCommitMessage('');
        setActiveTab('actions');
      }
    } catch (err) {
      setOpResult({ success: false, message: err instanceof Error ? err.message : 'Failed' });
    }
  };

  const loadDiff = async (commitHash: string) => {
    setSelectedCommit(commitHash);
    setLoadingDiff(true);
    try {
      const baseUrl = peer ? `http://${peer.host}:${peer.port}` : '';
      const res = await fetch(`${baseUrl}/api/repos/${repo.id}/commits/${commitHash}/diff`);
      const data = await res.json();
      setDiffContent(data.diff);
    } catch {
      setDiffContent('Failed to load diff');
    } finally {
      setLoadingDiff(false);
    }
  };

  const loadWorkingDiff = async () => {
    setSelectedCommit('working');
    setLoadingDiff(true);
    try {
      const baseUrl = peer ? `http://${peer.host}:${peer.port}` : '';
      const res = await fetch(`${baseUrl}/api/repos/${repo.id}/diff`);
      const data = await res.json();
      setDiffContent(data.diff || 'No changes');
    } catch {
      setDiffContent('Failed to load diff');
    } finally {
      setLoadingDiff(false);
    }
  };

  const loadConflictFile = async (filePath: string) => {
    setSelectedConflictFile(filePath);
    try {
      const baseUrl = peer ? `http://${peer.host}:${peer.port}` : '';
      const res = await fetch(`${baseUrl}/api/repos/${repo.id}/conflicts/file?file=${encodeURIComponent(filePath)}`);
      const data = await res.json();
      setConflictContent(data);
    } catch {
      setConflictContent(null);
    }
  };

  const resolveConflict = async (filePath: string, resolution: 'ours' | 'theirs' | 'mark-resolved') => {
    setOpResult(null);
    try {
      const baseUrl = peer ? `http://${peer.host}:${peer.port}` : '';
      const res = await fetch(`${baseUrl}/api/repos/${repo.id}/conflicts/resolve-${resolution}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: filePath }),
      });
      const data = await res.json();
      setOpResult(data);
      if (data.success) {
        setSelectedConflictFile(null);
        setConflictContent(null);
      }
    } catch (err) {
      setOpResult({ success: false, message: 'Failed to resolve conflict' });
    }
  };

  const { status, latestCommit } = repo;
  const hasConflicts = status.conflicted > 0 || status.mergeInProgress || status.rebaseInProgress;

  // Check if another machine has newer commits
  const newerMachine = otherMachines.find(
    (om) => om.repo.latestCommit && latestCommit &&
    om.repo.latestCommit.timestamp > latestCommit.timestamp
  );
  const hasNewerElsewhere = !!newerMachine;
  const statusType = getStatusType(status, hasNewerElsewhere);

  const statusBarColors: Record<string, string> = {
    clean: 'bg-emerald-500',
    modified: 'bg-amber-500',
    ahead: 'bg-blue-500',
    behind: 'bg-orange-500',
    conflict: 'bg-red-500',
  };

  return (
    <div className="group relative bg-zinc-900/50 border border-zinc-800/50 hover:border-zinc-700/50 transition-colors">
      {/* Status indicator bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${statusBarColors[statusType]}`} />

      {/* Main row - compact */}
      <div
        className="pl-4 pr-3 py-2.5 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          {/* Repo name and path */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-zinc-100 truncate">{repo.name}</span>
              {machineName && (
                <span className="text-[10px] px-1.5 py-0.5 bg-zinc-800 text-zinc-500 rounded font-medium uppercase tracking-wide">
                  {machineName}
                </span>
              )}
            </div>
            <div className="text-xs text-zinc-600 truncate font-mono">{repo.path}</div>
          </div>

          {/* Status indicators - compact pills */}
          <div className="flex items-center gap-1.5 shrink-0">
            {hasConflicts && (
              <span className="text-[10px] px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded font-medium animate-pulse">
                {status.conflicted > 0 ? `${status.conflicted} CONFLICTS` : 'CONFLICT'}
              </span>
            )}
            {status.ahead > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded font-mono font-medium">
                +{status.ahead}
              </span>
            )}
            {status.behind > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 bg-orange-500/20 text-orange-400 rounded font-mono font-medium">
                -{status.behind}
              </span>
            )}
            {status.modified > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded font-mono font-medium">
                {status.modified}M
              </span>
            )}
            {status.untracked > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 bg-zinc-700 text-zinc-400 rounded font-mono font-medium">
                {status.untracked}?
              </span>
            )}
            {status.stashes > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded font-mono font-medium">
                {status.stashes}S
              </span>
            )}
            {hasNewerElsewhere && !hasConflicts && (
              <span className="text-[10px] px-1.5 py-0.5 bg-cyan-500/20 text-cyan-400 rounded font-medium">
                {newerMachine?.peer.name} newer
              </span>
            )}
          </div>

          {/* Branch and time */}
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs font-mono text-zinc-500 bg-zinc-800/50 px-2 py-0.5 rounded">
              {status.branch}
            </span>
            {latestCommit && (
              <span className="text-xs text-zinc-600 tabular-nums w-12 text-right">
                {formatTimeAgo(latestCommit.timestamp)}
              </span>
            )}
            <svg
              className={`w-4 h-4 text-zinc-600 transition-transform ${expanded ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="border-t border-zinc-800/50 animate-in">
          {/* Tabs */}
          <div className="flex gap-0 border-b border-zinc-800/50 text-xs">
            {[
              'actions',
              'history',
              ...(hasConflicts ? ['conflicts'] : []),
              ...(!status.isClean && !hasConflicts ? ['commit'] : []),
            ].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as typeof activeTab)}
                className={`px-4 py-2 font-medium capitalize transition-colors ${
                  activeTab === tab
                    ? tab === 'conflicts'
                      ? 'text-red-400 border-b-2 border-red-500 -mb-px'
                      : 'text-zinc-100 border-b-2 border-blue-500 -mb-px'
                    : tab === 'conflicts'
                    ? 'text-red-400/70 hover:text-red-400'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {tab}
                {tab === 'conflicts' && status.conflicted > 0 && (
                  <span className="ml-1.5 text-[10px] bg-red-500/20 px-1 rounded">
                    {status.conflicted}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="p-4">
            {/* Actions Tab */}
            {activeTab === 'actions' && (
              <div className="space-y-4">
                {/* Latest commit info */}
                {latestCommit && (
                  <div className="flex items-start gap-3 text-sm">
                    <span className="font-mono text-xs text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded shrink-0">
                      {latestCommit.shortHash}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-zinc-300 truncate">{latestCommit.message}</div>
                      <div className="text-xs text-zinc-600 mt-0.5">
                        {latestCommit.author} · {latestCommit.date}
                      </div>
                    </div>
                  </div>
                )}

                {/* Other machines comparison */}
                {otherMachines.length > 0 && (
                  <div className="bg-zinc-800/30 rounded-lg p-3 space-y-2">
                    <div className="text-[10px] uppercase tracking-wider text-zinc-600 font-medium">
                      Other Machines
                    </div>
                    {otherMachines.map((om) => (
                      <div key={om.peer.id} className="flex items-center justify-between text-sm">
                        <span className="text-zinc-400">{om.peer.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-zinc-600">
                            {om.repo.latestCommit?.shortHash || '—'}
                          </span>
                          {om.repo.latestCommit && latestCommit && (
                            om.repo.latestCommit.timestamp > latestCommit.timestamp ? (
                              <span className="text-[10px] px-1.5 py-0.5 bg-cyan-500/20 text-cyan-400 rounded font-medium">
                                NEWER
                              </span>
                            ) : om.repo.latestCommit.timestamp < latestCommit.timestamp ? (
                              <span className="text-[10px] px-1.5 py-0.5 bg-zinc-700 text-zinc-500 rounded font-medium">
                                OLDER
                              </span>
                            ) : (
                              <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded font-medium">
                                SYNCED
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Result message */}
                {opResult && (
                  <div
                    className={`text-sm px-3 py-2 rounded ${
                      opResult.success
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}
                  >
                    {opResult.message}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2">
                  <ActionButton onClick={() => runOp('fetch')} disabled={gitOp.isPending}>
                    Fetch
                  </ActionButton>
                  <ActionButton onClick={() => runOp('pull')} disabled={gitOp.isPending}>
                    Pull
                  </ActionButton>
                  {status.hasRemote && (
                    <ActionButton
                      onClick={() => runOp('push')}
                      disabled={gitOp.isPending}
                      variant={status.ahead > 0 ? 'primary' : 'default'}
                    >
                      Push{status.ahead > 0 && ` (${status.ahead})`}
                    </ActionButton>
                  )}
                  {status.behind > 0 && (
                    <ActionButton onClick={() => runOp('rebase')} disabled={gitOp.isPending} variant="warning">
                      Rebase
                    </ActionButton>
                  )}
                  {!status.isClean && (
                    <ActionButton onClick={() => runOp('stash')} disabled={gitOp.isPending}>
                      Stash
                    </ActionButton>
                  )}
                  {status.stashes > 0 && (
                    <ActionButton onClick={() => runOp('stash/pop')} disabled={gitOp.isPending}>
                      Pop Stash
                    </ActionButton>
                  )}
                </div>
              </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
              <div className="space-y-1">
                {!status.isClean && (
                  <CommitRow
                    label="Uncommitted changes"
                    isWorking
                    selected={selectedCommit === 'working'}
                    onClick={() => loadWorkingDiff()}
                  />
                )}
                {commits?.map((commit: CommitInfo) => (
                  <CommitRow
                    key={commit.hash}
                    hash={commit.shortHash}
                    message={commit.message}
                    author={commit.author}
                    time={formatTimeAgo(commit.timestamp)}
                    selected={selectedCommit === commit.hash}
                    onClick={() => loadDiff(commit.hash)}
                  />
                ))}

                {/* Diff viewer */}
                {selectedCommit && (
                  <div className="mt-4 pt-4 border-t border-zinc-800">
                    <div className="text-xs text-zinc-500 mb-2">
                      {selectedCommit === 'working' ? 'Working changes' : `Commit ${selectedCommit}`}
                    </div>
                    {loadingDiff ? (
                      <div className="text-zinc-600 text-sm">Loading...</div>
                    ) : (
                      <pre className="text-xs bg-zinc-950 p-3 rounded-lg overflow-auto max-h-80 font-mono leading-relaxed">
                        {diffContent?.split('\n').map((line, i) => (
                          <div
                            key={i}
                            className={
                              line.startsWith('+') && !line.startsWith('+++')
                                ? 'text-emerald-400'
                                : line.startsWith('-') && !line.startsWith('---')
                                ? 'text-red-400'
                                : line.startsWith('@@')
                                ? 'text-blue-400'
                                : 'text-zinc-500'
                            }
                          >
                            {line || ' '}
                          </div>
                        ))}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Commit Tab */}
            {activeTab === 'commit' && !status.isClean && (
              <div className="space-y-4">
                <div className="text-xs text-zinc-500">
                  {[
                    status.modified > 0 && `${status.modified} modified`,
                    status.untracked > 0 && `${status.untracked} untracked`,
                    status.staged > 0 && `${status.staged} staged`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </div>

                <textarea
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  placeholder="Commit message..."
                  className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500/50 resize-none font-mono"
                  rows={3}
                />

                {opResult && (
                  <div
                    className={`text-sm px-3 py-2 rounded ${
                      opResult.success
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}
                  >
                    {opResult.message}
                  </div>
                )}

                <div className="flex gap-2">
                  <ActionButton onClick={() => loadWorkingDiff()}>
                    View Diff
                  </ActionButton>
                  <ActionButton
                    onClick={() => runOp('commit-all', { message: commitMessage })}
                    disabled={gitOp.isPending || !commitMessage.trim()}
                    variant="primary"
                  >
                    {gitOp.isPending ? 'Committing...' : 'Commit All'}
                  </ActionButton>
                </div>

                {selectedCommit === 'working' && diffContent && (
                  <pre className="text-xs bg-zinc-950 p-3 rounded-lg overflow-auto max-h-64 font-mono leading-relaxed">
                    {diffContent.split('\n').map((line, i) => (
                      <div
                        key={i}
                        className={
                          line.startsWith('+') && !line.startsWith('+++')
                            ? 'text-emerald-400'
                            : line.startsWith('-') && !line.startsWith('---')
                            ? 'text-red-400'
                            : line.startsWith('@@')
                            ? 'text-blue-400'
                            : 'text-zinc-500'
                        }
                      >
                        {line || ' '}
                      </div>
                    ))}
                  </pre>
                )}
              </div>
            )}

            {/* Conflicts Tab */}
            {activeTab === 'conflicts' && hasConflicts && (
              <div className="space-y-4">
                {/* Conflict status banner */}
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-red-400">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="font-medium">
                      {status.mergeInProgress ? 'Merge in progress' : status.rebaseInProgress ? 'Rebase in progress' : 'Conflicts detected'}
                    </span>
                  </div>
                  {status.conflicted > 0 && (
                    <div className="text-sm text-red-400/70 mt-1">
                      {status.conflicted} file{status.conflicted > 1 ? 's' : ''} with conflicts
                    </div>
                  )}
                </div>

                {/* Conflicted files list */}
                {status.conflictedFiles.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase tracking-wider text-zinc-600 font-medium mb-2">
                      Conflicted Files
                    </div>
                    {status.conflictedFiles.map((file) => (
                      <div
                        key={file}
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                          selectedConflictFile === file
                            ? 'bg-red-500/10 border border-red-500/30'
                            : 'bg-zinc-800/50 hover:bg-zinc-800'
                        }`}
                        onClick={() => loadConflictFile(file)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-red-500" />
                          <span className="text-sm font-mono text-zinc-300">{file}</span>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); resolveConflict(file, 'ours'); }}
                            className="px-2 py-1 text-[10px] font-medium bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
                            title="Keep our version"
                          >
                            Ours
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); resolveConflict(file, 'theirs'); }}
                            className="px-2 py-1 text-[10px] font-medium bg-orange-600 hover:bg-orange-500 text-white rounded transition-colors"
                            title="Keep their version"
                          >
                            Theirs
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); resolveConflict(file, 'mark-resolved'); }}
                            className="px-2 py-1 text-[10px] font-medium bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded transition-colors"
                            title="Mark as manually resolved"
                          >
                            Resolved
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Conflict content viewer */}
                {selectedConflictFile && conflictContent && (
                  <div className="space-y-3">
                    <div className="text-xs text-zinc-500">
                      Viewing: <span className="font-mono text-zinc-400">{selectedConflictFile}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-blue-400 font-medium mb-1">
                          Ours (Current)
                        </div>
                        <pre className="text-xs bg-zinc-950 p-2 rounded max-h-48 overflow-auto font-mono text-zinc-400">
                          {conflictContent.ours || '(empty)'}
                        </pre>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-orange-400 font-medium mb-1">
                          Theirs (Incoming)
                        </div>
                        <pre className="text-xs bg-zinc-950 p-2 rounded max-h-48 overflow-auto font-mono text-zinc-400">
                          {conflictContent.theirs || '(empty)'}
                        </pre>
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium mb-1">
                        Current File Content (with conflict markers)
                      </div>
                      <pre className="text-xs bg-zinc-950 p-2 rounded max-h-48 overflow-auto font-mono">
                        {conflictContent.merged.split('\n').map((line, i) => (
                          <div
                            key={i}
                            className={
                              line.startsWith('<<<<<<<')
                                ? 'text-blue-400 font-bold'
                                : line.startsWith('>>>>>>>')
                                ? 'text-orange-400 font-bold'
                                : line.startsWith('=======')
                                ? 'text-zinc-500 font-bold'
                                : 'text-zinc-400'
                            }
                          >
                            {line || ' '}
                          </div>
                        ))}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Result message */}
                {opResult && (
                  <div
                    className={`text-sm px-3 py-2 rounded ${
                      opResult.success
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}
                  >
                    {opResult.message}
                  </div>
                )}

                {/* Abort/Continue actions */}
                <div className="flex gap-2 pt-2 border-t border-zinc-800">
                  {status.mergeInProgress && (
                    <>
                      <ActionButton onClick={() => runOp('merge/abort')} variant="warning">
                        Abort Merge
                      </ActionButton>
                      {status.conflicted === 0 && (
                        <ActionButton onClick={() => runOp('merge/continue')} variant="primary">
                          Complete Merge
                        </ActionButton>
                      )}
                    </>
                  )}
                  {status.rebaseInProgress && (
                    <>
                      <ActionButton onClick={() => runOp('rebase/abort')} variant="warning">
                        Abort Rebase
                      </ActionButton>
                      {status.conflicted === 0 && (
                        <ActionButton onClick={() => runOp('rebase/continue')} variant="primary">
                          Continue Rebase
                        </ActionButton>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-components
function ActionButton({
  children,
  onClick,
  disabled,
  variant = 'default',
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'primary' | 'warning';
}) {
  const variants = {
    default: 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300',
    primary: 'bg-blue-600 hover:bg-blue-500 text-white',
    warning: 'bg-orange-600 hover:bg-orange-500 text-white',
  };

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      className={`px-3 py-1.5 text-xs font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]}`}
    >
      {children}
    </button>
  );
}

function CommitRow({
  hash,
  message,
  author,
  time,
  label,
  isWorking,
  selected,
  onClick,
}: {
  hash?: string;
  message?: string;
  author?: string;
  time?: string;
  label?: string;
  isWorking?: boolean;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 px-2 py-1.5 rounded cursor-pointer transition-colors ${
        selected
          ? isWorking
            ? 'bg-amber-500/10 border border-amber-500/30'
            : 'bg-blue-500/10 border border-blue-500/30'
          : 'hover:bg-zinc-800/50 border border-transparent'
      }`}
    >
      {isWorking ? (
        <>
          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
          <span className="text-sm text-amber-400">{label}</span>
        </>
      ) : (
        <>
          <span className="font-mono text-[10px] text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded shrink-0">
            {hash}
          </span>
          <span className="text-sm text-zinc-300 truncate flex-1">{message}</span>
          <span className="text-xs text-zinc-600 shrink-0">{author}</span>
          <span className="text-xs text-zinc-600 tabular-nums shrink-0">{time}</span>
        </>
      )}
    </div>
  );
}
