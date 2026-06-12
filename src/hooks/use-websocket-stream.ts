import { useEffect, useRef, useState } from "react";

export type WsConnectionState = "idle" | "connecting" | "open" | "closed" | "error";

interface UseWebSocketStreamOptions<T> {
  url?: string;
  enabled?: boolean;
  parse: (raw: string) => T;
  onMessage: (data: T) => void;
  reconnect?: boolean;
  maxReconnectAttempts?: number;
}

export function useWebSocketStream<T>({
  url,
  enabled = true,
  parse,
  onMessage,
  reconnect = true,
  maxReconnectAttempts = 3,
}: UseWebSocketStreamOptions<T>): WsConnectionState {
  const reconnectTimerRef = useRef<number | undefined>(undefined);
  const parseRef = useRef(parse);
  const onMessageRef = useRef(onMessage);
  const [state, setState] = useState<WsConnectionState>("idle");

  useEffect(() => {
    parseRef.current = parse;
  }, [parse]);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!enabled || !url) {
      setState("idle");
      return;
    }

    let active = true;
    let socket: WebSocket | null = null;
    let attempt = 0;
    let openedOnce = false;

    const clearReconnect = (): void => {
      if (reconnectTimerRef.current !== undefined) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = undefined;
      }
    };

    const connect = (): void => {
      if (!active) return;
      clearReconnect();
      setState((current) => (current === "open" ? current : "connecting"));
      socket = new WebSocket(url);

      socket.onopen = () => {
        openedOnce = true;
        attempt = 0;
        setState("open");
      };

      socket.onmessage = (event) => {
        try {
          onMessageRef.current(parseRef.current(String(event.data)));
        } catch (error) {
          console.error("Failed to parse WS message", error);
        }
      };

      socket.onerror = () => {
        if (!active) return;
        setState("error");
      };

      socket.onclose = (event) => {
        if (!active) return;
        const normalClose = event.code === 1000 || event.code === 1001;
        setState(normalClose || openedOnce ? "closed" : "error");

        if (!reconnect || normalClose || attempt >= maxReconnectAttempts) return;
        attempt += 1;
        const delay = Math.min(1000 * 2 ** (attempt - 1), 8000);
        reconnectTimerRef.current = window.setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      active = false;
      clearReconnect();
      const current = socket;
      socket = null;
      if (current && current.readyState !== WebSocket.CLOSED && current.readyState !== WebSocket.CLOSING) {
        current.close(1000, "component unmounted");
      }
    };
  }, [enabled, maxReconnectAttempts, reconnect, url]);

  return state;
}
