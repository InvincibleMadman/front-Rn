<!-- 目标落盘路径：front-Ne/docs/CODEX_AR_SNIPPETS_BFF.md -->
# CODEX_AR_SNIPPETS_BFF.md

本文件提供 Web BFF 控制面实现原型。Codex 不应逐字复制为最终代码，而应结合当前项目结构实现。

## 1. Fastify BFF Server Skeleton

```js
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyCookie from "@fastify/cookie";
import fastifyJwt from "@fastify/jwt";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");

const app = Fastify({ logger: true, trustProxy: true });

await app.register(fastifyCookie);
await app.register(fastifyJwt, {
  secret: process.env.FUZZ_WEB_SESSION_SECRET || "change-me-at-least-32-chars",
});

await app.register(fastifyStatic, {
  root: distDir,
  prefix: "/",
  index: false,
  decorateReply: true,
  maxAge: "1h",
});

app.addHook("onSend", async (_req, reply, payload) => {
  reply.header("X-Content-Type-Options", "nosniff");
  reply.header("Referrer-Policy", "no-referrer");
  reply.header("X-Frame-Options", "DENY");
  return payload;
});

app.get("/healthz", async () => ({ ok: true, service: "icp-fuzz-web" }));

app.setNotFoundHandler(async (request, reply) => {
  if (
    request.raw.method === "GET" &&
    !request.url.startsWith("/web-api") &&
    !request.url.startsWith("/node-api") &&
    !request.url.startsWith("/node-ws")
  ) {
    return reply.type("text/html").sendFile("index.html");
  }
  return reply.code(404).send({ ok: false, message: "not found", data: null });
});

await app.listen({
  host: process.env.FUZZ_WEB_HOST || "0.0.0.0",
  port: Number(process.env.FUZZ_WEB_PORT || 8080),
});
```

## 2. Session Helpers

```js
async function requireWebSession(request, reply) {
  const token = request.cookies?.icp_fuzz_session;
  if (!token) return reply.code(401).send({ ok: false, message: "unauthorized", data: null });
  try {
    request.user = app.jwt.verify(token);
  } catch {
    return reply.code(401).send({ ok: false, message: "unauthorized", data: null });
  }
}

function setSessionCookie(reply, sessionToken) {
  reply.setCookie("icp_fuzz_session", sessionToken, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

function clearSessionCookie(reply) {
  reply.clearCookie("icp_fuzz_session", { path: "/" });
}
```

## 3. CSRF Helpers

```js
function createCsrfToken() {
  return crypto.randomBytes(24).toString("hex");
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

app.get("/web-api/csrf", { preHandler: requireWebSession }, async (_request, reply) => {
  const token = createCsrfToken();
  reply.setCookie("icp_fuzz_csrf", token, {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return { ok: true, message: "ok", data: { csrf_token: token } };
});
```

## 4. Node Token Signing

```js
function signNodeToken({ app, user, node }) {
  const jti = crypto.randomUUID();
  const token = app.jwt.sign(
    {
      iss: "icp-fuzz-web",
      aud: `node:${node.node_id}`,
      sub: user.user_id,
      username: user.username,
      role: user.role,
      node_id: node.node_id,
      jti,
    },
    { secret: node.node_secret, expiresIn: "120s" }
  );
  return { token, jti };
}
```

## 5. BFF → Node Request Signing

```js
function sha256Hex(input) {
  return crypto.createHash("sha256").update(input ?? Buffer.alloc(0)).digest("hex");
}

function randomNonce() {
  return crypto.randomBytes(16).toString("hex");
}

function signNodeRequest({ method, pathWithQuery, bodyBuffer, node, nodeTokenJti }) {
  const timestamp = new Date().toISOString();
  const nonce = randomNonce();
  const bodyHash = sha256Hex(bodyBuffer || Buffer.alloc(0));
  const canonical = [
    method.toUpperCase(),
    pathWithQuery,
    timestamp,
    nonce,
    bodyHash,
    node.node_id,
    nodeTokenJti,
  ].join("\n");
  const signature = crypto.createHmac("sha256", node.node_secret).update(canonical).digest("hex");
  return { timestamp, nonce, bodyHash, signature };
}
```

## 6. Manual Proxy Skeleton

手动代理更容易做 body hash 和签名。Codex 可以用 Node fetch 实现。

```js
async function proxyNodeRequest(request, reply) {
  const { nodeId } = request.params;
  const node = await nodeRepo.getNode(nodeId);
  if (!node || !node.enabled) {
    return reply.code(404).send({ ok: false, message: "node not found", data: null });
  }

  const user = request.user;
  const { token, jti } = signNodeToken({ app, user, node });

  const rawUrl = request.url;
  const prefix = `/node-api/${encodeURIComponent(nodeId)}`;
  const apiPath = rawUrl.startsWith(prefix) ? rawUrl.slice(prefix.length) : rawUrl;
  const pathWithQuery = apiPath || "/";

  const bodyBuffer = ["GET", "HEAD"].includes(request.method.toUpperCase())
    ? Buffer.alloc(0)
    : Buffer.from(JSON.stringify(request.body ?? {}));

  const sig = signNodeRequest({ method: request.method, pathWithQuery, bodyBuffer, node, nodeTokenJti: jti });
  const targetUrl = new URL(pathWithQuery, node.base_url).toString();

  const upstream = await fetch(targetUrl, {
    method: request.method,
    headers: {
      "content-type": request.headers["content-type"] || "application/json",
      "authorization": `Bearer ${token}`,
      "x-icp-timestamp": sig.timestamp,
      "x-icp-nonce": sig.nonce,
      "x-icp-body-sha256": sig.bodyHash,
      "x-icp-signature": sig.signature,
    },
    body: ["GET", "HEAD"].includes(request.method.toUpperCase()) ? undefined : bodyBuffer,
  });

  reply.code(upstream.status);
  const contentType = upstream.headers.get("content-type");
  if (contentType) reply.header("content-type", contentType);
  const arrayBuffer = await upstream.arrayBuffer();
  return reply.send(Buffer.from(arrayBuffer));
}
```

注意：multipart 上传不能 JSON.stringify body；大文件下载/上传应 stream 转发。初版可先处理 JSON API，上传/下载用专门函数。

## 7. Dashboard Aggregation Skeleton

```js
async function nodeFetchJson(node, path, user) {
  const { token, jti } = signNodeToken({ app, user, node });
  const bodyBuffer = Buffer.alloc(0);
  const sig = signNodeRequest({ method: "GET", pathWithQuery: path, bodyBuffer, node, nodeTokenJti: jti });
  const res = await fetch(new URL(path, node.base_url).toString(), {
    method: "GET",
    headers: {
      "authorization": `Bearer ${token}`,
      "x-icp-timestamp": sig.timestamp,
      "x-icp-nonce": sig.nonce,
      "x-icp-body-sha256": sig.bodyHash,
      "x-icp-signature": sig.signature,
    },
  });
  if (!res.ok) throw new Error(`node ${node.node_id} ${path} ${res.status}`);
  return await res.json();
}

app.get("/web-api/dashboard/overview", { preHandler: requireWebSession }, async (request) => {
  const nodes = await nodeRepo.listEnabledNodes();
  const summaries = [];
  for (const node of nodes) {
    try {
      const [sys, protocols, jobs, graph] = await Promise.all([
        nodeFetchJson(node, "/api/v1/system/info", request.user),
        nodeFetchJson(node, "/api/v1/protocols", request.user),
        nodeFetchJson(node, "/api/v1/jobs/summary", request.user),
        nodeFetchJson(node, "/api/v1/assets/overview-graph", request.user),
      ]);
      summaries.push({ node_id: node.node_id, name: node.name, status: "online", system: sys.data, protocols: protocols.data, jobs: jobs.data, graph: graph.data });
    } catch (err) {
      summaries.push({ node_id: node.node_id, name: node.name, status: "offline", error: String(err?.message || err) });
    }
  }
  return { ok: true, message: "ok", data: buildDashboardOverview(summaries) };
});
```

## 8. package.json Dependencies

```json
{
  "dependencies": {
    "@fastify/cookie": "^11.0.0",
    "@fastify/jwt": "^9.0.0",
    "@fastify/static": "^8.0.0",
    "fastify": "^5.0.0",
    "argon2": "^0.41.0"
  },
  "engines": {
    "node": ">=22.5.0"
  },
  "scripts": {
    "build": "tsc -b && vite build",
    "serve": "node server/server.mjs",
    "start": "node server/server.mjs"
  }
}
```

如果 Windows 上 native 包安装困难，Codex 可以使用 Node 22+ 内置 `node:sqlite` 避免额外 native SQLite 包；密码哈希可选择 `bcryptjs` 或 Node `crypto.scrypt`，但必须说明取舍。
