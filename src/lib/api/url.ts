import { makeApiError } from "@/lib/api/errors";
import { useUiStore } from "@/stores/ui-store";

export function getApiBaseUrl(): string {
  return useUiStore.getState().apiBaseUrl.trim().replace(/\/+$/, "");
}

export function getSelectedNodeId(): string | null {
  const nodeId = useUiStore.getState().selectedApiNodeId?.trim();
  return nodeId ? nodeId : null;
}

export function requireSelectedNodeId(path?: string): string {
  const nodeId = getSelectedNodeId();
  if (nodeId) return nodeId;

  throw makeApiError({
    kind: "node_not_selected",
    message: "Backend node is not selected. Select a backend node before sending /api/v1 requests.",
    path,
    hint: "Choose a node from the topbar node selector, then retry the request.",
  });
}

function joinBase(baseUrl: string, path: string): string {
  if (!baseUrl) return path;
  if (!path.startsWith("/")) return `${baseUrl}/${path}`;
  return `${baseUrl}${path}`;
}

export function resolveNodeApiPath(path: string): string {
  const nodeId = requireSelectedNodeId(path);
  const prefix = `/node-api/${encodeURIComponent(nodeId)}/api/v1`;
  if (path === "/api/v1") return prefix;
  if (path.startsWith("/api/v1/")) return `${prefix}${path.slice("/api/v1".length)}`;
  return path;
}

export function resolveNodeWsPath(path: string): string {
  const nodeId = requireSelectedNodeId(path);
  const prefix = `/node-ws/${encodeURIComponent(nodeId)}/api/v1`;
  if (path === "/api/v1") return prefix;
  if (path.startsWith("/api/v1/")) return `${prefix}${path.slice("/api/v1".length)}`;
  return path;
}

function browserWsOrigin(): string {
  if (typeof window === "undefined") return "";
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}`;
}

export function resolveApiUrl(path: string): string {
  const normalizedPath = path.startsWith("/api/v1") ? resolveNodeApiPath(path) : path;
  const baseUrl = getApiBaseUrl();
  return joinBase(baseUrl, normalizedPath);
}

export function resolveWsUrl(path: string): string {
  const wsPath = path.startsWith("/api/v1") ? resolveNodeWsPath(path) : path;
  const baseUrl = getApiBaseUrl();
  const httpUrl = joinBase(baseUrl, wsPath);

  if (httpUrl.startsWith("https://")) return httpUrl.replace("https://", "wss://");
  if (httpUrl.startsWith("http://")) return httpUrl.replace("http://", "ws://");
  if (httpUrl.startsWith("/")) return `${browserWsOrigin()}${httpUrl}`;
  return httpUrl;
}
