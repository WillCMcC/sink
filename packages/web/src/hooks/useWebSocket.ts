import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { RepoWithStatus } from '../types';

interface WebSocketMessage {
  type: 'connected' | 'repo-changed' | 'pong';
  machine?: string;
  repo?: RepoWithStatus;
}

export function useWebSocket(peerHost?: string, peerPort?: number) {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const connect = useCallback(() => {
    // Build WebSocket URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = peerHost ?? window.location.hostname;
    const port = peerPort ?? (window.location.port || (protocol === 'wss:' ? '443' : '80'));
    const wsUrl = `${protocol}//${host}:${port}/ws`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log(`WebSocket connected to ${host}:${port}`);
      };

      ws.onmessage = (event) => {
        try {
          const msg: WebSocketMessage = JSON.parse(event.data);

          if (msg.type === 'repo-changed' && msg.repo) {
            // Update the repo in the cache
            queryClient.setQueryData<RepoWithStatus[]>(
              ['repos', peerHost, peerPort],
              (oldData) => {
                if (!oldData) return oldData;
                return oldData.map((repo) =>
                  repo.id === msg.repo!.id ? msg.repo! : repo
                );
              }
            );
          }
        } catch {
          // Ignore invalid messages
        }
      };

      ws.onclose = () => {
        console.log(`WebSocket disconnected from ${host}:${port}`);
        wsRef.current = null;
        // Reconnect after 3 seconds
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connect();
        }, 3000);
      };

      ws.onerror = (error) => {
        console.warn('WebSocket error:', error);
      };
    } catch (err) {
      console.warn('Failed to connect WebSocket:', err);
      // Retry after 3 seconds
      reconnectTimeoutRef.current = window.setTimeout(() => {
        connect();
      }, 3000);
    }
  }, [peerHost, peerPort, queryClient]);

  useEffect(() => {
    connect();

    // Ping to keep connection alive
    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);

    return () => {
      clearInterval(pingInterval);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return {
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
  };
}
