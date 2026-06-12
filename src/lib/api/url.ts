import { useUiStore } from "@/stores/ui-store";

export function getApiBaseUrl(): string {
  return useUiStore.getState().apiBaseUrl.trim().replace(/\/+$/, "");
}

function currentNodeId(): string {
  return useUiStore.getState().selectedApiNodeId || "local";
}

function joinBase(baseUrl: string, path: string): string {
  if (!baseUrl) return path;
  if (!path.startsWith("/")) return `${baseUrl}/${path}`;
  return `${baseUrl}${path}`;
}

function resolveNodeApiPath(path: string): string {
  const prefix = `/node-api/${encodeURIComponent(currentNodeId())}/api/v1`;
  if (path === "/api/v1") return prefix;
  if (path.startsWith("/api/v1/")) return `${prefix}${path.slice("/api/v1".length)}`;
  return path;
}

function resolveNodeWsPath(path: string): string {
  const prefix = `/node-ws/${encodeURIComponent(currentNodeId())}/api/v1`;
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
