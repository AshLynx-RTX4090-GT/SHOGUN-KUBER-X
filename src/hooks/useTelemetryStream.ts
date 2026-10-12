import { useState, useEffect, useCallback, useRef } from 'react';
import { LiveTelemetryStreamData } from '../types';

interface UseTelemetryStreamOptions {
  enabled?: boolean;
  onUpdate?: (data: LiveTelemetryStreamData) => void;
}

export function useTelemetryStream(options: UseTelemetryStreamOptions = {}) {
  const { enabled = true, onUpdate } = options;
  const [data, setData] = useState<LiveTelemetryStreamData | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const reconnectAttemptsRef = useRef<number>(0);

  const connect = useCallback(() => {
    if (!enabled || typeof window === 'undefined') return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    try {
      const es = new EventSource('/api/telemetry/stream');
      eventSourceRef.current = es;

      es.addEventListener('connected', () => {
        setIsConnected(true);
        setIsReconnecting(false);
        setError(null);
        reconnectAttemptsRef.current = 0;
      });

      es.addEventListener('telemetry', (event: MessageEvent) => {
        try {
          const parsed: LiveTelemetryStreamData = JSON.parse(event.data);
          setData(parsed);
          setIsConnected(true);
          setIsReconnecting(false);
          setError(null);
          if (onUpdate) {
            onUpdate(parsed);
          }
        } catch (err: any) {
          console.warn('Failed to parse SSE telemetry event:', err);
        }
      });

      es.onerror = () => {
        setIsConnected(false);
        es.close();
        eventSourceRef.current = null;

        // Auto-reconnect with exponential backoff capped at 10s
        const backoffMs = Math.min(1000 * Math.pow(1.5, reconnectAttemptsRef.current), 10000);
        reconnectAttemptsRef.current += 1;
        setIsReconnecting(true);
        setError(`Connection lost. Reconnecting in ${Math.round(backoffMs / 1000)}s...`);

        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, backoffMs);
      };
    } catch (err: any) {
      setError(err.message || 'Failed to establish SSE stream');
      setIsConnected(false);
    }
  }, [enabled, onUpdate]);

  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setIsConnected(false);
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [enabled, connect]);

  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    connect();
  }, [connect]);

  return {
    data,
    isConnected,
    isReconnecting,
    error,
    reconnect,
  };
}
