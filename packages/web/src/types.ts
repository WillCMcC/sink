export interface RepoInfo {
  id: string;
  name: string;
  path: string;
}

export interface RepoStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: number;
  modified: number;
  untracked: number;
  stashes: number;
  isClean: boolean;
  hasRemote: boolean;
  conflicted: number;
  conflictedFiles: string[];
  mergeInProgress: boolean;
  rebaseInProgress: boolean;
}

export interface CommitInfo {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
  timestamp: number;
}

export interface RepoWithStatus extends RepoInfo {
  status: RepoStatus;
  latestCommit: CommitInfo | null;
}

export interface Peer {
  id: string;
  name: string;
  host: string;
  port: number;
  addresses: string[];
  lastSeen: number;
}

export interface PeersResponse {
  self: Peer;
  peers: Peer[];
}

export interface GitOpResult {
  success: boolean;
  message: string;
  data?: unknown;
}

export interface BranchInfo {
  name: string;
  current: boolean;
  tracking?: string;
}
