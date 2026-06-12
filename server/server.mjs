import path from "node:path";
import crypto from "node:crypto";
import net from "node:net";
import tls from "node:tls";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyCookie from "@fastify/cookie";
import fastifyJwt from "@fastify/jwt";
import { cleanMessage, logError, logInfo, logReady, logWarn } from "./logger.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const indexHtml = path.join(distDir, "index.html");
const isProduction = process.env.NODE_ENV === "production";
const sessionSecret = process.env.FUZZ_WEB_SESSION_SECRET || "dev-only-change-me-at-least-32-chars";
const configuredProxyTimeoutMs = Number(process.env.FUZZ_WEB_PROXY_TIMEOUT_MS || 120_000);
const proxyTimeoutMs = Number.isFinite(configuredProxyTimeoutMs) && configuredProxyTimeoutMs >= 1_000 ? configuredProxyTimeoutMs : 120_000;
const defaultNodeId = process.env.FUZZ_WEB_DEFAULT_NODE_ID || "local";
const defaultNodeName = process.env.FUZZ_WEB_DEFAULT_NODE_NAME || "本机后端";
const defaultNodeBaseUrl = process.env.FUZZ_WEB_DEFAULT_NODE_BASE_URL || "http://127.0.0.1:18000";
const defaultNodeSecret = process.env.FUZZ_WEB_DEFAULT_NODE_SECRET || process.env.FUZZ_CORE_NODE_SECRET || "change-me-node-secret";

if (isProduction && (!process.env.FUZZ_WEB_SESSION_SECRET || sessionSecret.startsWith("dev-only"))) {
  throw new Error("FUZZ_WEB_SESSION_SECRET must be set to a strong random value in production");
}

const dataDir = (() => {
  const configured = process.env.FUZZ_WEB_DATA_DIR;
  if (!configured) return path.join(rootDir, ".bff-data");
  return path.isAbsolute(configured) ? configured : path.join(rootDir, configured);
})();
const dbPath = path.join(dataDir, "web-bff.sqlite3");
await mkdir(dataDir, { recursive: true });

const app = Fastify({ logger: false, trustProxy: true, bodyLimit: 32 * 1024 * 1024 });
app.addContentTypeParser(/^multipart\/form-data\b/i, { parseAs: "buffer" }, (request, body, done) => {
  request.rawBody = body;
  done(null, body);
});
await app.register(fastifyCookie);
await app.register(fastifyJwt, { secret: sessionSecret });

if (!existsSync(indexHtml)) {
  logWarn("bff", "warn", "dist/index.html missing", "Run npm run build before npm run serve.");
}

await app.register(fastifyStatic, {
  root: distDir,
  prefix: "/",
  index: ["index.html"],
  decorateReply: true,
  maxAge: isProduction ? "1h" : 0,
});

const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");
db.exec(`
CREATE TABLE IF NOT EXISTS users(
  user_id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS nodes(
  node_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  description TEXT DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1,
  node_secret TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_logs(
  log_id TEXT PRIMARY KEY,
  actor_user_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  details_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`);

function nowIso() {
  return new Date().toISOString();
}

function randomId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function normalizeNodeId(value) {
  const text = String(value || "").trim().toLowerCase().replace(/[^a-z0-9_.-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!text || text.length > 64) throw new Error("node_id must be 1-64 chars: a-z 0-9 _ . -");
  return text;
}

function normalizeBaseUrl(value) {
  const url = new URL(String(value || "").trim());
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("base_url must use http or https");
  if (url.username || url.password) throw new Error("base_url must not contain credentials");
  if (url.hash) throw new Error("base_url must not contain a fragment");
  url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  url.search = "";
  return url.toString().replace(/\/+$/, "");
}

function normalizeNodeSecret(value) {
  const text = String(value || "");
  if (text.length < 12) throw new Error("node_secret must be at least 12 characters");
  if (/\r|\n|\x00/.test(text)) throw new Error("node_secret contains invalid characters");
  return text;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

function verifyPassword(password, salt, expectedHash) {
  const actual = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHash, "hex");
  return expected.length === actual.length && crypto.timingSafeEqual(actual, expected);
}

function sanitizeUser(row) {
  if (!row) return null;
  return { user_id: row.user_id, username: row.username, role: row.role };
}

function sanitizeNode(row) {
  return {
    node_id: row.node_id,
    name: row.name,
    base_url: row.base_url,
    description: row.description || "",
    enabled: Boolean(row.enabled),
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    secret_configured: Boolean(row.node_secret),
  };
}

function audit(actorUserId, action, targetType, targetId, details = {}) {
  db.prepare(
    "INSERT INTO audit_logs(log_id, actor_user_id, action, target_type, target_id, details_json, created_at) VALUES(?,?,?,?,?,?,?)",
  ).run(randomId("audit"), actorUserId ?? null, action, targetType, targetId, JSON.stringify(details), nowIso());
}

function bootstrapAdmin() {
  const count = db.prepare("SELECT COUNT(*) AS c FROM users").get().c;
  if (count > 0) return;
  const password = process.env.FUZZ_WEB_BOOTSTRAP_PASSWORD || "admin123";
  const { salt, hash } = hashPassword(password);
  const now = nowIso();
  db.prepare(
    "INSERT INTO users(user_id, username, password_hash, password_salt, role, created_at, updated_at) VALUES(?,?,?,?,?,?,?)",
  ).run(randomId("user"), "admin", hash, salt, "admin", now, now);
  logWarn("auth", "warn", "Bootstrap admin created", "username=admin password=<redacted>");
}

function bootstrapDefaultNode() {
  const count = db.prepare("SELECT COUNT(*) AS c FROM nodes").get().c;
  if (count > 0) return;
  const now = nowIso();
  const nodeId = normalizeNodeId(defaultNodeId);
  const baseUrl = normalizeBaseUrl(defaultNodeBaseUrl);
  const secret = normalizeNodeSecret(defaultNodeSecret);
  db.prepare(
    "INSERT INTO nodes(node_id, name, base_url, description, enabled, node_secret, created_by, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?,?)",
  ).run(nodeId, defaultNodeName, baseUrl, "Auto-created default FastAPI backend node", 1, secret, "system", now, now);
  logInfo("node", "ready", `default node ${nodeId}`, baseUrl);
}

bootstrapAdmin();
bootstrapDefaultNode();

app.addHook("onSend", async (_req, reply, payload) => {
  reply.header("X-Content-Type-Options", "nosniff");
  reply.header("Referrer-Policy", "no-referrer");
  reply.header("X-Frame-Options", "DENY");
  return payload;
});

app.addHook("onRequest", async (request) => {
  request.startTime = performance.now();
});

app.addHook("onResponse", async (request, reply) => {
  const elapsed = Math.round(performance.now() - (request.startTime ?? performance.now()));
  const message = `${request.method} ${request.url} ${reply.statusCode} ${elapsed}ms`;

  if (reply.statusCode >= 500) {
    logError("bff", "http", message);
  } else if (reply.statusCode >= 400) {
    logWarn("bff", "http", message);
  } else {
    logInfo("bff", "http", message);
  }
});

app.setErrorHandler((error, request, reply) => {
  const statusCode = Number(error?.statusCode || error?.status || 500);
  const safeStatus = statusCode >= 400 && statusCode < 600 ? statusCode : 500;
  const safeMessage = safeStatus >= 500 ? "Internal BFF error" : cleanMessage(error);

  logError("bff", "error", `${request.method} ${request.url} ${safeStatus}`, error);

  reply.code(safeStatus).send({
    ok: false,
    message: safeMessage,
    data: null,
  });
});

async function requireWebSession(request, reply) {
  const token = request.cookies?.icp_fuzz_session;
  if (!token) return reply.code(401).send({ ok: false, message: "unauthorized", data: null });
  try {
    request.user = app.jwt.verify(token);
  } catch {
    return reply.code(401).send({ ok: false, message: "unauthorized", data: null });
  }
}

async function requireAdmin(request, reply) {
  const denied = await requireWebSession(request, reply);
  if (denied) return denied;
  if (request.user?.role !== "admin") {
    return reply.code(403).send({ ok: false, message: "admin required", data: null });
  }
}

async function requireCsrf(request, reply) {
  const safe = ["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase());
  if (safe) return;
  const header = request.headers["x-csrf-token"];
  const cookie = request.cookies?.icp_fuzz_csrf;
  if (!header || !cookie || header !== cookie) {
    return reply.code(403).send({ ok: false, message: "csrf token invalid", data: null });
  }
}

function setSessionCookie(reply, sessionToken) {
  reply.setCookie("icp_fuzz_session", sessionToken, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
  });
}

function clearSessionCookie(reply) {
  reply.clearCookie("icp_fuzz_session", { path: "/" });
  reply.clearCookie("icp_fuzz_csrf", { path: "/" });
}

function createCsrfToken() {
  return crypto.randomBytes(24).toString("hex");
}

function base64Url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function signHs256Jwt(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedPayload = base64Url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(signingInput)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return `${signingInput}.${signature}`;
}

function signNodeToken({ user, node }) {
  const jti = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const token = signHs256Jwt(
    {
      iss: "icp-fuzz-web",
      aud: `node:${node.node_id}`,
      sub: user.user_id,
      username: user.username,
      role: user.role,
      node_id: node.node_id,
      jti,
      iat: now,
      exp: now + 120,
    },
    node.node_secret,
  );
  return { token, jti };
}

function sha256Hex(input) {
  return crypto.createHash("sha256").update(input ?? Buffer.alloc(0)).digest("hex");
}

function signNodeRequest({ method, pathWithQuery, bodyBuffer, node, nodeTokenJti }) {
  const timestamp = new Date().toISOString();
  const nonce = crypto.randomBytes(16).toString("hex");
  const bodyHash = sha256Hex(bodyBuffer || Buffer.alloc(0));
  const canonical = [method.toUpperCase(), pathWithQuery, timestamp, nonce, bodyHash, node.node_id, nodeTokenJti].join("\n");
  const signature = crypto.createHmac("sha256", node.node_secret).update(canonical).digest("hex");
  return { timestamp, nonce, bodyHash, signature };
}

function nodeRowById(nodeId) {
  return db.prepare("SELECT * FROM nodes WHERE node_id = ?").get(nodeId);
}

function parseCookies(cookieHeader = "") {
  const cookies = {};
  for (const part of String(cookieHeader || "").split(";")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    cookies[key] = decodeURIComponent(value);
  }
  return cookies;
}

function userFromUpgradeRequest(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  const token = cookies.icp_fuzz_session;
  if (!token) throw new Error("unauthorized");
  return app.jwt.verify(token);
}

async function nodeFetchJson(node, pathWithQuery, user) {
  const { token, jti } = signNodeToken({ user, node });
  const bodyBuffer = Buffer.alloc(0);
  const sig = signNodeRequest({ method: "GET", pathWithQuery, bodyBuffer, node, nodeTokenJti: jti });
  const response = await fetch(new URL(pathWithQuery, node.base_url).toString(), {
    method: "GET",
    signal: AbortSignal.timeout(proxyTimeoutMs),
    headers: {
      authorization: `Bearer ${token}`,
      "x-icp-timestamp": sig.timestamp,
      "x-icp-nonce": sig.nonce,
      "x-icp-body-sha256": sig.bodyHash,
      "x-icp-signature": sig.signature,
    },
  });
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) throw new Error(`${pathWithQuery} ${response.status}`);
  return payload;
}

function sendSocketHttpError(socket, statusCode, message) {
  try {
    socket.write(`HTTP/1.1 ${statusCode} ${message}\r\nConnection: close\r\nContent-Type: text/plain\r\nContent-Length: ${Buffer.byteLength(message)}\r\n\r\n${message}`);
  } finally {
    socket.destroy();
  }
}

function buildWsProxyRequest({ req, node, user, pathWithQuery }) {
  const { token, jti } = signNodeToken({ user, node });
  const sig = signNodeRequest({ method: "GET", pathWithQuery, bodyBuffer: Buffer.alloc(0), node, nodeTokenJti: jti });
  const base = new URL(node.base_url);
  const hostHeader = `${base.hostname}${base.port ? `:${base.port}` : ""}`;
  const headers = [
    `GET ${pathWithQuery} HTTP/1.1`,
    `Host: ${hostHeader}`,
    "Connection: Upgrade",
    "Upgrade: websocket",
    `Sec-WebSocket-Key: ${req.headers["sec-websocket-key"] || ""}`,
    `Sec-WebSocket-Version: ${req.headers["sec-websocket-version"] || "13"}`,
    `Authorization: Bearer ${token}`,
    `X-ICP-Timestamp: ${sig.timestamp}`,
    `X-ICP-Nonce: ${sig.nonce}`,
    `X-ICP-Body-SHA256: ${sig.bodyHash}`,
    `X-ICP-Signature: ${sig.signature}`,
  ];
  if (req.headers["sec-websocket-protocol"]) headers.push(`Sec-WebSocket-Protocol: ${req.headers["sec-websocket-protocol"]}`);
  if (req.headers["sec-websocket-extensions"]) headers.push(`Sec-WebSocket-Extensions: ${req.headers["sec-websocket-extensions"]}`);
  if (req.headers.origin) headers.push(`Origin: ${req.headers.origin}`);
  return { base, requestText: `${headers.join("\r\n")}\r\n\r\n` };
}

async function handleNodeWsUpgrade(req, socket, head) {
  const url = new URL(req.url || "/", "http://localhost");
  if (!url.pathname.startsWith("/node-ws/")) {
    sendSocketHttpError(socket, 404, "not found");
    return;
  }
  const rest = url.pathname.slice("/node-ws/".length);
  const slash = rest.indexOf("/");
  if (slash <= 0) {
    sendSocketHttpError(socket, 400, "invalid node websocket path");
    return;
  }
  const nodeId = decodeURIComponent(rest.slice(0, slash));
  const upstreamPath = `/${rest.slice(slash + 1)}${url.search}`;
  if (!upstreamPath.startsWith("/api/v1/")) {
    sendSocketHttpError(socket, 400, "invalid upstream websocket path");
    return;
  }
  const user = userFromUpgradeRequest(req);
  const node = nodeRowById(nodeId);
  if (!node || !node.enabled) {
    sendSocketHttpError(socket, 404, "node not found");
    return;
  }
  const { base, requestText } = buildWsProxyRequest({ req, node, user, pathWithQuery: upstreamPath });
  const port = Number(base.port || (base.protocol === "https:" ? 443 : 80));
  const connectOptions = { host: base.hostname, port, servername: base.hostname };
  const upstream = base.protocol === "https:" ? tls.connect(connectOptions) : net.connect(connectOptions);
  upstream.setTimeout(proxyTimeoutMs, () => upstream.destroy(new Error("websocket proxy timeout")));
  upstream.once("connect", () => {
    upstream.write(requestText);
    if (head?.length) upstream.write(head);
    upstream.pipe(socket);
    socket.pipe(upstream);
  });
  upstream.once("error", (error) => {
    logWarn("ws", "warn", "node websocket proxy failed", error);
    if (!socket.destroyed) sendSocketHttpError(socket, 502, "node websocket proxy failed");
  });
  socket.once("error", () => upstream.destroy());
  socket.once("close", () => upstream.destroy());
}

app.server.on("upgrade", (req, socket, head) => {
  if (!String(req.url || "").startsWith("/node-ws/")) return;
  handleNodeWsUpgrade(req, socket, head).catch((error) => {
    logWarn("ws", "error", "node websocket upgrade rejected", error);
    if (!socket.destroyed) sendSocketHttpError(socket, 401, "websocket unauthorized");
  });
});

app.get("/healthz", async () => ({ ok: true, message: "ok", data: { service: "icp-fuzz-web", dist_ready: existsSync(indexHtml) } }));

function publicNode(row) {
  if (!row) return null;
  return {
    node_id: row.node_id,
    name: row.name,
    base_url: row.base_url,
    enabled: Boolean(row.enabled),
  };
}

function toSafeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toPlainRecord(value) {
  if (!isRecord(value)) return {};
  return value;
}

function toRecordOfNumbers(value) {
  const record = toPlainRecord(value);
  return Object.fromEntries(
    Object.entries(record).map(([key, item]) => [key, toSafeNumber(item, 0)]).filter(([, item]) => item >= 0),
  );
}

function normalizeRecentArray(value) {
  return Array.isArray(value) ? value.filter((item) => isRecord(item)).map((item) => ({ ...item })) : [];
}

function recordEntriesByValue(record) {
  return Object.entries(record).sort((left, right) => right[1] - left[1]);
}

function pushCount(record, key, increment = 1) {
  const normalizedKey = String(key || "").trim();
  if (!normalizedKey) return;
  record[normalizedKey] = (record[normalizedKey] ?? 0) + increment;
}

function bucketIso(input) {
  if (!input) return null;
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 16);
}

function makeTrendFromJobs(recentJobs) {
  const buckets = new Map();
  for (const job of recentJobs) {
    const bucket = bucketIso(job?.updated_at ?? job?.created_at ?? null);
    if (!bucket) continue;
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
  }
  return Array.from(buckets.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-12)
    .map(([time, value]) => ({ time, value }));
}

function makeCrashTrend(metricsSeries, artifacts) {
  const buckets = new Map();

  for (const metric of metricsSeries) {
    const bucket = bucketIso(metric?.timestamp ?? metric?.at ?? null);
    if (!bucket) continue;
    const entry = buckets.get(bucket) ?? { crashes: 0, hangs: 0 };
    entry.crashes = Math.max(entry.crashes, toSafeNumber(metric?.unique_crashes ?? 0, 0));
    entry.hangs = Math.max(entry.hangs, toSafeNumber(metric?.unique_hangs ?? 0, 0));
    buckets.set(bucket, entry);
  }

  if (buckets.size === 0) {
    for (const artifact of artifacts) {
      const bucket = bucketIso(artifact?.mtime ?? artifact?.discovered_at ?? null);
      if (!bucket) continue;
      const entry = buckets.get(bucket) ?? { crashes: 0, hangs: 0 };
      if (artifact?.kind === "hang") entry.hangs += 1;
      else entry.crashes += 1;
      buckets.set(bucket, entry);
    }
  }

  return Array.from(buckets.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-12)
    .map(([time, value]) => ({ time, crashes: value.crashes, hangs: value.hangs }));
}

function reportKindName(report) {
  return String(
    report?.kind ??
      report?.report_kind ??
      report?.type ??
      report?.category ??
      "report",
  );
}

app.get("/web-api/public/default-node", async () => {
  bootstrapDefaultNode();

  const preferredNodeId = normalizeNodeId(defaultNodeId);
  const node =
    nodeRowById(preferredNodeId) ??
    db.prepare("SELECT * FROM nodes WHERE enabled = 1 ORDER BY created_at ASC LIMIT 1").get();

  if (!node) {
    return {
      ok: true,
      message: "ok",
      data: {
        node: null,
        status: "missing",
        latency_ms: null,
        error: "no backend node configured",
      },
    };
  }

  if (!node.enabled) {
    return {
      ok: true,
      message: "ok",
      data: {
        node: publicNode(node),
        status: "offline",
        latency_ms: null,
        error: "backend node is disabled",
      },
    };
  }

  const started = Date.now();
  try {
    await nodeFetchJson(node, "/api/v1/system/info", {
      user_id: "system-public-home",
      username: "public-home",
      role: "system",
    });

    return {
      ok: true,
      message: "ok",
      data: {
        node: publicNode(node),
        status: "online",
        latency_ms: Date.now() - started,
        error: null,
      },
    };
    } catch (error) {
      logWarn("bff", "node", `${node.node_id} offline`, error);

      return {
        ok: true,
        message: "ok",
        data: {
          node: publicNode(node),
          status: "offline",
          latency_ms: Date.now() - started,
          error: cleanMessage(error),
        },
      };
    }
});

app.post("/web-api/auth/login", { preHandler: [requireCsrf] }, async (request, reply) => {
  const { username, password } = request.body ?? {};
  if (!username || !password) return reply.code(400).send({ ok: false, message: "username and password required", data: null });
  const row = db.prepare("SELECT * FROM users WHERE username = ?").get(String(username));
  if (!row || !verifyPassword(String(password), row.password_salt, row.password_hash)) {
    return reply.code(401).send({ ok: false, message: "invalid credentials", data: null });
  }
  const user = sanitizeUser(row);
  const sessionToken = app.jwt.sign(user, { expiresIn: "7d" });
  setSessionCookie(reply, sessionToken);
  audit(user.user_id, "auth.login", "user", user.username);
  return { ok: true, message: "ok", data: { user } };
});

app.post("/web-api/auth/logout", { preHandler: [requireWebSession, requireCsrf] }, async (request, reply) => {
  audit(request.user.user_id, "auth.logout", "user", request.user.username);
  clearSessionCookie(reply);
  return { ok: true, message: "ok", data: null };
});

app.get("/web-api/auth/me", { preHandler: [requireWebSession] }, async (request) => ({ ok: true, message: "ok", data: { user: request.user } }));

app.get("/web-api/csrf", async (_request, reply) => {
  const token = createCsrfToken();
  reply.setCookie("icp_fuzz_csrf", token, { path: "/", sameSite: "lax", secure: isProduction });
  return { ok: true, message: "ok", data: { csrf_token: token } };
});

app.get("/web-api/users", { preHandler: [requireAdmin] }, async () => {
  const users = db.prepare("SELECT user_id, username, role, created_at, updated_at FROM users ORDER BY created_at ASC").all();
  return { ok: true, message: "ok", data: { items: users } };
});

app.post("/web-api/users", { preHandler: [requireAdmin, requireCsrf] }, async (request, reply) => {
  const { username, password, role } = request.body ?? {};
  if (!username || !password || !["admin", "user"].includes(String(role))) {
    return reply.code(400).send({ ok: false, message: "invalid user payload", data: null });
  }
  const existing = db.prepare("SELECT username FROM users WHERE username = ?").get(String(username));
  if (existing) return reply.code(409).send({ ok: false, message: "username already exists", data: null });
  const { salt, hash } = hashPassword(String(password));
  const now = nowIso();
  const userId = randomId("user");
  db.prepare("INSERT INTO users(user_id, username, password_hash, password_salt, role, created_at, updated_at) VALUES(?,?,?,?,?,?,?)").run(userId, String(username), hash, salt, String(role), now, now);
  audit(request.user.user_id, "users.create", "user", String(username), { role });
  return reply.code(201).send({ ok: true, message: "ok", data: { user: { user_id: userId, username, role } } });
});

app.delete("/web-api/users/:username", { preHandler: [requireAdmin, requireCsrf] }, async (request, reply) => {
  const { username } = request.params;
  if (username === "admin") {
    const count = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin'").get().c;
    if (count <= 1) return reply.code(400).send({ ok: false, message: "cannot delete last admin", data: null });
  }
  const result = db.prepare("DELETE FROM users WHERE username = ?").run(username);
  if (!result.changes) return reply.code(404).send({ ok: false, message: "user not found", data: null });
  audit(request.user.user_id, "users.delete", "user", username);
  return { ok: true, message: "ok", data: null };
});

app.get("/web-api/nodes", { preHandler: [requireWebSession] }, async () => {
  bootstrapDefaultNode();
  const rows = db.prepare("SELECT * FROM nodes ORDER BY created_at ASC").all();
  return { ok: true, message: "ok", data: { items: rows.map(sanitizeNode) } };
});

app.post("/web-api/nodes", { preHandler: [requireWebSession, requireCsrf] }, async (request, reply) => {
  try {
    const { node_id, name, base_url, description, enabled, node_secret } = request.body ?? {};
    if (!node_id || !name || !base_url || !node_secret) return reply.code(400).send({ ok: false, message: "invalid node payload", data: null });
    const nodeId = normalizeNodeId(node_id);
    const baseUrl = normalizeBaseUrl(base_url);
    const secret = normalizeNodeSecret(node_secret);
    const now = nowIso();
    db.prepare("INSERT INTO nodes(node_id, name, base_url, description, enabled, node_secret, created_by, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?,?)").run(
      nodeId,
      String(name),
      baseUrl,
      String(description ?? ""),
      enabled === false ? 0 : 1,
      secret,
      request.user.user_id,
      now,
      now,
    );
    audit(request.user.user_id, "nodes.create", "node", nodeId, { name, base_url: baseUrl });
    return reply.code(201).send({ ok: true, message: "ok", data: { node: sanitizeNode(nodeRowById(nodeId)) } });
  } catch (error) {
    return reply.code(400).send({ ok: false, message: error instanceof Error ? error.message : "invalid node payload", data: null });
  }
});

app.patch("/web-api/nodes/:nodeId", { preHandler: [requireWebSession, requireCsrf] }, async (request, reply) => {
  const { nodeId } = request.params;
  const current = nodeRowById(nodeId);
  if (!current) return reply.code(404).send({ ok: false, message: "node not found", data: null });
  const isAdmin = request.user.role === "admin";
  if (!isAdmin && current.created_by !== request.user.user_id) return reply.code(403).send({ ok: false, message: "forbidden", data: null });
  try {
    const body = request.body ?? {};
    const next = {
      name: body.name === undefined ? current.name : String(body.name),
      base_url: body.base_url === undefined ? current.base_url : normalizeBaseUrl(body.base_url),
      description: body.description === undefined ? current.description : String(body.description ?? ""),
      enabled: body.enabled === undefined ? current.enabled : (body.enabled ? 1 : 0),
      node_secret: body.node_secret ? normalizeNodeSecret(body.node_secret) : current.node_secret,
      updated_at: nowIso(),
    };
    db.prepare("UPDATE nodes SET name=?, base_url=?, description=?, enabled=?, node_secret=?, updated_at=? WHERE node_id=?").run(next.name, next.base_url, next.description, next.enabled, next.node_secret, next.updated_at, nodeId);
    audit(request.user.user_id, "nodes.update", "node", nodeId, { name: next.name, base_url: next.base_url, enabled: Boolean(next.enabled) });
    return { ok: true, message: "ok", data: { node: sanitizeNode(nodeRowById(nodeId)) } };
  } catch (error) {
    return reply.code(400).send({ ok: false, message: error instanceof Error ? error.message : "invalid node patch", data: null });
  }
});

app.delete("/web-api/nodes/:nodeId", { preHandler: [requireAdmin, requireCsrf] }, async (request, reply) => {
  const { nodeId } = request.params;
  const result = db.prepare("DELETE FROM nodes WHERE node_id = ?").run(nodeId);
  if (!result.changes) return reply.code(404).send({ ok: false, message: "node not found", data: null });
  audit(request.user.user_id, "nodes.delete", "node", nodeId);
  return { ok: true, message: "ok", data: null };
});

app.post("/web-api/nodes/:nodeId/ping", { preHandler: [requireWebSession, requireCsrf] }, async (request, reply) => {
  const { nodeId } = request.params;
  const node = nodeRowById(nodeId);
  if (!node) return reply.code(404).send({ ok: false, message: "node not found", data: null });
  const started = Date.now();
  try {
    const data = await nodeFetchJson(node, "/api/v1/system/info", request.user);
    return { ok: true, message: "ok", data: { status: "online", latency_ms: Date.now() - started, response: data } };
    } catch (error) {
      logWarn("bff", "node", `ping failed ${nodeId}`, error);

      return reply.code(502).send({
        ok: false,
        message: "node ping failed",
        data: {
          error: cleanMessage(error),
          latency_ms: Date.now() - started,
        },
      });
    }
});

app.get("/web-api/dashboard/overview", { preHandler: [requireWebSession] }, async (request) => {
  const nodes = db.prepare("SELECT * FROM nodes WHERE enabled = 1 ORDER BY created_at ASC").all();
  const summaries = await Promise.all(nodes.map(async (node) => {
    try {
      const [sys, protocols, jobs, graph, assets, jobList] = await Promise.all([
        nodeFetchJson(node, "/api/v1/system/info", request.user),
        nodeFetchJson(node, "/api/v1/protocols", request.user),
        nodeFetchJson(node, "/api/v1/jobs/summary", request.user),
        nodeFetchJson(node, "/api/v1/assets/overview-graph", request.user),
        nodeFetchJson(node, "/api/v1/assets", request.user).catch(() => null),
        nodeFetchJson(node, "/api/v1/jobs", request.user).catch(() => null),
      ]);
      const protocolItems = Array.isArray(protocols?.data?.protocols) ? protocols.data.protocols : [];
      const jobItems = Array.isArray(jobList?.data?.jobs)
        ? jobList.data.jobs
        : Array.isArray(jobList?.data?.items)
          ? jobList.data.items
          : Array.isArray(jobList?.data)
            ? jobList.data
            : [];
      const assetItems = Array.isArray(assets?.data?.items)
        ? assets.data.items
        : Array.isArray(assets?.data?.assets)
          ? assets.data.assets
          : Array.isArray(assets?.data)
            ? assets.data
            : [];
      const protocolSummaries = await Promise.all(protocolItems.map(async (protocol) => {
        try {
          const [vulnerabilities, debug, reports] = await Promise.all([
            nodeFetchJson(node, `/api/v1/protocols/${encodeURIComponent(protocol)}/vulnerabilities/summary`, request.user).catch(() => null),
            nodeFetchJson(node, `/api/v1/protocols/${encodeURIComponent(protocol)}/debug/summary`, request.user).catch(() => null),
            nodeFetchJson(node, `/api/v1/protocols/${encodeURIComponent(protocol)}/reports/summary`, request.user).catch(() => null),
          ]);

          const runningJobIds = jobItems
            .filter((job) => String(job?.protocol ?? "") === String(protocol) && String(job?.status ?? "") === "running")
            .map((job) => String(job?.job_id ?? "").trim())
            .filter(Boolean);

          const [metricsHistorySeries, artifactsSeries] = await Promise.all([
            Promise.all(runningJobIds.map(async (jobId) => {
              try {
                const metricsHistory = await nodeFetchJson(node, `/api/v1/jobs/${encodeURIComponent(jobId)}/metrics/history`, request.user);
                const historyItems = Array.isArray(metricsHistory?.data?.items)
                  ? metricsHistory.data.items
                  : Array.isArray(metricsHistory?.data?.history)
                    ? metricsHistory.data.history
                    : Array.isArray(metricsHistory?.data)
                      ? metricsHistory.data
                      : [];
                return historyItems.filter((item) => isRecord(item));
              } catch {
                return [];
              }
            })),
            Promise.all(jobItems.slice(0, 24).map(async (job) => {
              const jobId = String(job?.job_id ?? "").trim();
              if (!jobId) return [];
              try {
                const artifactsPayload = await nodeFetchJson(node, `/api/v1/jobs/${encodeURIComponent(jobId)}/artifacts`, request.user);
                const artifactItems = Array.isArray(artifactsPayload?.data?.items)
                  ? artifactsPayload.data.items
                  : Array.isArray(artifactsPayload?.data?.artifacts)
                    ? artifactsPayload.data.artifacts
                    : Array.isArray(artifactsPayload?.data)
                      ? artifactsPayload.data
                      : [];
                return artifactItems
                  .filter((item) => isRecord(item))
                  .map((item) => ({ ...item, protocol: item.protocol ?? job.protocol, job_id: item.job_id ?? jobId }));
              } catch {
                return [];
              }
            })),
          ]);

          const vulnerabilitiesData = toPlainRecord(vulnerabilities?.data);
          const debugData = toPlainRecord(debug?.data);
          const reportsData = toPlainRecord(reports?.data);

          return {
            protocol: String(protocol),
            vulnerabilities: toSafeNumber(vulnerabilitiesData.total ?? vulnerabilitiesData.count, 0),
            vulnerabilitySummary: {
              high_confidence: toSafeNumber(vulnerabilitiesData.high_confidence ?? vulnerabilitiesData.highConfidence, 0),
              by_coarse_type: toRecordOfNumbers(vulnerabilitiesData.by_coarse_type ?? vulnerabilitiesData.byCoarseType),
              by_cwe: toRecordOfNumbers(vulnerabilitiesData.by_cwe ?? vulnerabilitiesData.byCwe),
              recent_records: normalizeRecentArray(vulnerabilitiesData.recent_records ?? vulnerabilitiesData.recentRecords),
            },
            debugSessions: toSafeNumber(debugData.active_sessions ?? debugData.session_count ?? debugData.total, 0),
            debugSummary: {
              by_status: toRecordOfNumbers(debugData.by_status ?? debugData.byStatus),
              by_coarse_type: toRecordOfNumbers(debugData.by_coarse_type ?? debugData.byCoarseType),
              recent_sessions: normalizeRecentArray(debugData.recent_sessions ?? debugData.recentSessions),
            },
            reports: toSafeNumber(reportsData.reports_count ?? reportsData.total ?? reportsData.count, 0),
            reportSummary: {
              by_kind: toRecordOfNumbers(reportsData.by_kind ?? reportsData.byKind),
              recent_reports: normalizeRecentArray(reportsData.recent_reports ?? reportsData.recentReports),
            },
            metricsHistory: metricsHistorySeries.flat(),
            artifacts: artifactsSeries.flat(),
          };
        } catch {
          return {
            protocol: String(protocol),
            vulnerabilities: 0,
            vulnerabilitySummary: { high_confidence: 0, by_coarse_type: {}, by_cwe: {}, recent_records: [] },
            debugSessions: 0,
            debugSummary: { by_status: {}, by_coarse_type: {}, recent_sessions: [] },
            reports: 0,
            reportSummary: { by_kind: {}, recent_reports: [] },
            metricsHistory: [],
            artifacts: [],
          };
        }
      }));
      const vulnerabilityCount = protocolSummaries.reduce((sum, item) => sum + item.vulnerabilities, 0);
      const debugSessionCount = protocolSummaries.reduce((sum, item) => sum + item.debugSessions, 0);
      const reportCount = protocolSummaries.reduce((sum, item) => sum + item.reports, 0);

      return {
        node_id: node.node_id,
        name: node.name,
        status: "online",
        protocol_count: protocolItems.length,
        running_jobs: Number(jobs?.data?.running ?? 0),
        crash_count: Number(jobs?.data?.crash_count ?? 0),
        vulnerability_count: vulnerabilityCount,
        debug_session_count: debugSessionCount,
        report_count: reportCount,
        last_seen_at: nowIso(),
        system: sys?.data ?? {},
        jobs: jobs?.data ?? {},
        graph: graph?.data ?? { nodes: [], edges: [] },
        protocols: protocolItems,
        assets: assetItems,
        job_items: jobItems,
        protocol_summaries: protocolSummaries,
      };
    } catch (error) {
      logWarn("bff", "proxy", `dashboard summary degraded for ${node.node_id}`, error);
      return {
        node_id: node.node_id,
        name: node.name,
        status: "offline",
        protocol_count: 0,
        running_jobs: 0,
        crash_count: 0,
        vulnerability_count: 0,
        debug_session_count: 0,
        report_count: 0,
        last_seen_at: null,
        error: cleanMessage(error),
        system: {},
        jobs: { by_status: {}, recent_jobs: [] },
        graph: { nodes: [], edges: [] },
        protocols: [],
        assets: [],
        job_items: [],
        protocol_summaries: [],
      };
    }
  }));
  const onlineNodes = summaries.filter((item) => item.status === "online");
  const selectedId = request.headers["x-selected-node-id"] || defaultNodeId;
  const currentNode = summaries.find((item) => item.node_id === selectedId) ?? onlineNodes[0] ?? summaries[0] ?? null;
  const allAssets = summaries.flatMap((item) => (Array.isArray(item.assets) ? item.assets : []));
  const allProtocolSummaries = summaries.flatMap((item) => (Array.isArray(item.protocol_summaries) ? item.protocol_summaries : []));
  const recentJobsAll = summaries.flatMap((item) => {
    const recentJobs = Array.isArray(item.jobs?.recent_jobs) ? item.jobs.recent_jobs : [];
    return recentJobs.map((job) => ({
      job_id: job?.job_id,
      status: job?.status,
      protocol: job?.protocol,
      target: job?.target,
      updated_at: job?.updated_at ?? job?.created_at ?? null,
    }));
  });
  const runningJobsByStatus = summaries.reduce((accumulator, item) => {
    for (const [status, count] of Object.entries(toRecordOfNumbers(item.jobs?.by_status))) {
      accumulator[status] = (accumulator[status] ?? 0) + count;
    }
    return accumulator;
  }, {});
  const protocolAssetsByScope = {};
  const protocolAssetsByKind = {};
  const vulnerabilityByCoarseType = {};
  const vulnerabilityByCwe = {};
  const debugByStatus = {};
  const debugByCoarseType = {};
  const reportsByKind = {};

  for (const asset of allAssets) {
    pushCount(protocolAssetsByScope, asset?.scope, 1);
    pushCount(protocolAssetsByKind, asset?.kind, 1);
  }

  for (const item of allProtocolSummaries) {
    for (const [name, count] of Object.entries(item.vulnerabilitySummary?.by_coarse_type ?? {})) {
      pushCount(vulnerabilityByCoarseType, name, count);
    }
    for (const [name, count] of Object.entries(item.vulnerabilitySummary?.by_cwe ?? {})) {
      pushCount(vulnerabilityByCwe, name, count);
    }
    for (const [name, count] of Object.entries(item.debugSummary?.by_status ?? {})) {
      pushCount(debugByStatus, name, count);
    }
    for (const [name, count] of Object.entries(item.debugSummary?.by_coarse_type ?? {})) {
      pushCount(debugByCoarseType, name, count);
    }
    for (const [name, count] of Object.entries(item.reportSummary?.by_kind ?? {})) {
      pushCount(reportsByKind, name, count);
    }
  }

  const crashArtifacts = allProtocolSummaries
    .flatMap((item) => item.artifacts ?? [])
    .filter((artifact) => artifact?.kind === "crash" || artifact?.kind === "hang");
  const crashCount = summaries.reduce((sum, item) => sum + toSafeNumber(item.crash_count, 0), 0);
  const hangCount = crashArtifacts.filter((artifact) => artifact.kind === "hang").length;
  const crashTrend = makeCrashTrend(
    allProtocolSummaries.flatMap((item) => item.metricsHistory ?? []),
    crashArtifacts,
  );
  const nodeStatusTotal = nodes.length;
  const nodeStatusOnline = onlineNodes.length;
  const nodeStatusOffline = Math.max(nodeStatusTotal - nodeStatusOnline, 0);
  const protocolCountTotal = summaries.reduce((sum, item) => sum + toSafeNumber(item.protocol_count, 0), 0);
  const reportsRecent = allProtocolSummaries
    .flatMap((item) => item.reportSummary?.recent_reports ?? [])
    .slice(0, 18);
  const vulnerabilitiesRecent = allProtocolSummaries
    .flatMap((item) => item.vulnerabilitySummary?.recent_records ?? [])
    .slice(0, 18);
  const recentEvents = summaries.flatMap((item) =>
    (item.jobs?.recent_jobs ?? []).slice(0, 3).map((job) => ({
      type: "job",
      node_id: item.node_id,
      node_name: item.name,
      status: job.status ?? "unknown",
      label: job.name ?? job.job_id ?? "job",
      updated_at: job.updated_at ?? job.created_at ?? null,
    })),
  ).sort((left, right) => String(right.updated_at ?? "").localeCompare(String(left.updated_at ?? ""))).slice(0, 12);

  return {
    ok: true,
    message: "ok",
      data: {
        global: {
        node_count: nodeStatusTotal,
        online_nodes: nodeStatusOnline,
        protocol_count: protocolCountTotal,
        running_jobs: summaries.reduce((sum, item) => sum + Number(item.running_jobs ?? 0), 0),
        crash_count: crashCount,
        vulnerability_count: summaries.reduce((sum, item) => sum + Number(item.vulnerability_count ?? 0), 0),
        debug_session_count: summaries.reduce((sum, item) => sum + Number(item.debug_session_count ?? 0), 0),
        report_count: summaries.reduce((sum, item) => sum + Number(item.report_count ?? 0), 0),
        },
        nodeStatus: {
          total: nodeStatusTotal,
          online: nodeStatusOnline,
          offline: nodeStatusOffline,
          checking: 0,
          onlineRate: nodeStatusTotal > 0 ? nodeStatusOnline / nodeStatusTotal : 0,
          onlinePercent: nodeStatusTotal > 0 ? Math.round((nodeStatusOnline / nodeStatusTotal) * 100) : 0,
        },
        protocolAssets: {
          total: allAssets.length || protocolCountTotal,
          byScope: protocolAssetsByScope,
          byKind: protocolAssetsByKind,
          protocolCount: protocolCountTotal,
        },
        runningJobs: {
          running: summaries.reduce((sum, item) => sum + toSafeNumber(item.jobs?.running ?? item.running_jobs, 0), 0),
          total: summaries.reduce((sum, item) => sum + toSafeNumber(item.jobs?.total, 0), 0),
          byStatus: runningJobsByStatus,
          recentJobs: recentJobsAll
            .sort((left, right) => String(right.updated_at ?? "").localeCompare(String(left.updated_at ?? "")))
            .slice(0, 18),
          trend: makeTrendFromJobs(recentJobsAll),
        },
        crashFindings: {
          crashes: crashCount,
          hangs: hangCount,
          totalFindings: crashCount + hangCount,
          byKind: {
            crash: crashCount,
            hang: hangCount,
          },
          recentFindings: crashArtifacts
            .map((artifact) => ({
              job_id: artifact?.job_id,
              artifact_id: artifact?.artifact_id,
              name: artifact?.name,
              kind: artifact?.kind === "hang" ? "hang" : "crash",
              protocol: artifact?.protocol,
              size: toSafeNumber(artifact?.size, 0),
              mtime: artifact?.mtime ?? artifact?.discovered_at ?? null,
            }))
            .sort((left, right) => String(right.mtime ?? "").localeCompare(String(left.mtime ?? "")))
            .slice(0, 18),
          trend: crashTrend,
        },
        vulnerabilities: {
          total: summaries.reduce((sum, item) => sum + toSafeNumber(item.vulnerability_count, 0), 0),
          highConfidence: allProtocolSummaries.reduce((sum, item) => sum + toSafeNumber(item.vulnerabilitySummary?.high_confidence, 0), 0),
          byCoarseType: vulnerabilityByCoarseType,
          byCwe: vulnerabilityByCwe,
          recentRecords: vulnerabilitiesRecent,
        },
        debugSessions: {
          total: summaries.reduce((sum, item) => sum + toSafeNumber(item.debug_session_count, 0), 0),
          byStatus: debugByStatus,
          byCoarseType: debugByCoarseType,
        },
        reports: {
          total: summaries.reduce((sum, item) => sum + toSafeNumber(item.report_count, 0), 0),
          byKind: reportsByKind,
          recentReports: reportsRecent,
        },
      nodes: summaries.map((item) => ({
        node_id: item.node_id,
        name: item.name,
        status: item.status,
        protocol_count: item.protocol_count,
        running_jobs: item.running_jobs,
        crash_count: item.crash_count,
        vulnerability_count: item.vulnerability_count,
        debug_session_count: item.debug_session_count,
        report_count: item.report_count,
        last_seen_at: item.last_seen_at,
        error: item.error,
      })),
      current_node: {
        node_id: currentNode?.node_id ?? null,
        protocol_graph: currentNode?.graph ?? { nodes: [], edges: [] },
        job_trend: Object.entries(currentNode?.jobs?.by_status ?? {}).map(([status, value]) => ({ status, value })),
        vulnerability_distribution: [],
        recent_events: recentEvents.filter((item) => item.node_id === currentNode?.node_id),
      },
      cross_node: {
        task_distribution: summaries.map((item) => ({ name: item.name, value: Number(item.running_jobs ?? 0) })),
        vulnerability_distribution: summaries.map((item) => ({ name: item.name, value: Number(item.vulnerability_count ?? 0) })),
        crash_distribution: summaries.map((item) => ({ name: item.name, value: Number(item.crash_count ?? 0) })),
        recent_events: recentEvents,
      },
    },
  };
});

app.all("/node-api/:nodeId/api/v1/*", { preHandler: [requireWebSession, requireCsrf] }, async (request, reply) => {
  const { nodeId } = request.params;
  const node = nodeRowById(nodeId);
  if (!node || !node.enabled) return reply.code(404).send({ ok: false, message: "node not found", data: null });
  const user = request.user;
  const { token, jti } = signNodeToken({ user, node });
  const prefix = `/node-api/${encodeURIComponent(nodeId)}`;
  const pathWithQuery = request.url.startsWith(prefix) ? request.url.slice(prefix.length) : request.url;
  const rawBody = ["GET", "HEAD"].includes(request.method.toUpperCase())
    ? Buffer.alloc(0)
    : Buffer.isBuffer(request.body)
      ? request.body
      : request.rawBody
        ? Buffer.from(request.rawBody)
        : Buffer.from(JSON.stringify(request.body ?? {}));
  const sig = signNodeRequest({ method: request.method, pathWithQuery, bodyBuffer: rawBody, node, nodeTokenJti: jti });
  const targetUrl = new URL(pathWithQuery, node.base_url).toString();
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (!value) continue;
    const lower = key.toLowerCase();
    if (["host", "cookie", "content-length", "expect", "authorization", "x-csrf-token", "x-icp-timestamp", "x-icp-nonce", "x-icp-body-sha256", "x-icp-signature"].includes(lower)) continue;
    headers.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }
  headers.set("authorization", `Bearer ${token}`);
  headers.set("x-icp-timestamp", sig.timestamp);
  headers.set("x-icp-nonce", sig.nonce);
  headers.set("x-icp-body-sha256", sig.bodyHash);
  headers.set("x-icp-signature", sig.signature);
  if (!headers.has("content-type") && rawBody.length > 0) headers.set("content-type", "application/json");

    let upstream;

    try {
      upstream = await fetch(targetUrl, {
        method: request.method,
        headers,
        signal: AbortSignal.timeout(proxyTimeoutMs),
        body: ["GET", "HEAD"].includes(request.method.toUpperCase()) ? undefined : rawBody,
      });
    } catch (error) {
      logWarn("bff", "proxy", `${request.method} ${pathWithQuery} -> ${node.node_id} 502`, error);

      return reply.code(502).send({
        ok: false,
        message: "Backend node unavailable",
        data: {
          node_id: node.node_id,
          status: "offline",
          error: cleanMessage(error),
        },
      });
    }

  reply.code(upstream.status);
  for (const header of ["content-type", "content-disposition", "content-length", "cache-control"]) {
    const value = upstream.headers.get(header);
    if (value) reply.header(header, value);
  }

  const body = Buffer.from(await upstream.arrayBuffer());

  if (upstream.status >= 500) {
    logWarn("bff", "proxy", `${request.method} ${pathWithQuery} -> ${node.node_id} ${upstream.status}`);
  } else {
    logInfo("bff", "proxy", `${request.method} ${pathWithQuery} -> ${node.node_id} ${upstream.status}`);
  }

  return reply.send(body);
});

app.get("/node-ws/:nodeId/api/v1/*", async (_request, reply) => {
  return reply.code(426).send({ ok: false, message: "websocket upgrade required", data: null });
});

app.setNotFoundHandler(async (request, reply) => {
  if (request.raw.method === "GET" && !request.url.startsWith("/web-api") && !request.url.startsWith("/node-api") && !request.url.startsWith("/node-ws")) {
    if (!existsSync(indexHtml)) return reply.code(503).type("text/plain").send("dist/index.html missing; run npm run build first");
    return reply.type("text/html").sendFile("index.html");
  }
  return reply.code(404).send({ ok: false, message: "not found", data: null });
});

await app.listen({ host: process.env.FUZZ_WEB_HOST || "0.0.0.0", port: Number(process.env.FUZZ_WEB_PORT || 8080) });
logReady("web bff listening", `http://${process.env.FUZZ_WEB_HOST || "0.0.0.0"}:${Number(process.env.FUZZ_WEB_PORT || 8080)}`);
