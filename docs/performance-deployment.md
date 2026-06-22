# Performance Deployment

## Default Recommendation

1. Run `npm run build`.
2. Start the production server with Node:

```bash
NODE_ENV=production FRONTEND_HOST=0.0.0.0 FRONTEND_PORT=8080 node server.mjs
```

This mode serves `dist/` directly, keeps `/assets/*` cached for one year, and serves `index.html` with `no-cache`.
The BFF proxy reuses upstream connections with keep-alive.

## Low-End Linux Recommendation

Use the same Node production server, but run it as a background service:

```bash
NODE_ENV=production FRONTEND_HOST=127.0.0.1 FRONTEND_PORT=8080 node server.mjs
```

Recommended environment:

- `NODE_ENV=production`
- `FRONTEND_HOST=127.0.0.1`
- `FRONTEND_PORT=8080`
- `LOG_LEVEL=warn`

Notes:

- Do not use `npm run dev` in production.
- Do not rebuild on each request.
- `npm ci --omit=dev` is sufficient if you want a smaller production install.
- `systemd` or `pm2` can supervise the process, but are optional.

## Optional SEA Template

Single Executable Application is optional only.

- It can reduce deployment shape and startup file reading.
- It does not replace static caching, chunk splitting, or browser-side lazy loading.
- This repository does not ship a binary packager or `postject`.

Template helper:

```bash
npm run sea
```

The script only writes `sea-config.json` and prints next-step guidance.
It does not patch binaries.

## Optional Nginx Layer

Use Nginx only if you need extra static throughput, TLS handling, or gzip on Linux.
Node still serves `/node-api/` and can still serve static assets without Nginx.

See `deploy/nginx/front-xe.conf.example`.

## Modes

### Mode 1: Default Cross-Platform Node

```bash
npm run build
NODE_ENV=production FRONTEND_HOST=0.0.0.0 FRONTEND_PORT=8080 node server.mjs
```

### Mode 2: Low-End Linux Node Background Service

Example systemd values:

```ini
ExecStart=/usr/bin/node /opt/front-xe/server.mjs
Environment=NODE_ENV=production
Environment=FRONTEND_HOST=127.0.0.1
Environment=FRONTEND_PORT=8080
```

### Mode 3: Nginx + Node BFF

- Nginx serves `/assets/` and SPA fallback.
- Node serves `/node-api/` and can still serve `dist/` directly.
- Update the `root` path in `front-xe.conf.example` to match your deployment.

## Performance Checklist

- Production does not use `npm run dev`.
- First paint does not load assets search/index/UML lineage chunks.
- `/assets/*.js` returns `Cache-Control: public, max-age=31536000, immutable`.
- `index.html` returns `Cache-Control: no-cache`.
- `/node-api/` never falls back to SPA HTML.
- Assets chunk loads only after entering Asset Center.
- UML chunks load only after entering overview or lineage tabs.
- ECharts or graph code loads only on chart pages.
- Upstream proxy connections are reused.
- Home page requests only necessary APIs.


## Verified Deployment Experiment (Container, 2026-06-22)

I performed a live Nginx validation in the container using the same routing model as `deploy/nginx/front-xe.conf.example`:

- Static root served `index.html` successfully and returned `Cache-Control: no-cache`.
- `/assets/*` returned `Cache-Control: public, max-age=31536000, immutable`.
- `/node-api/*` proxied correctly to an upstream HTTP service without falling back to SPA HTML.
- `nginx -t` passed for the adapted config before the runtime verification.

Observed deployment pitfall:

- If the deployed `dist/` directory sits inside a path that Nginx workers cannot traverse, Nginx returns `404` for `/` and `/assets/*` even when the files exist.
- In my first run, a temporary directory with restrictive permissions caused false `404/502` symptoms.
- Fix: ensure the deployed static root and every parent directory are readable and executable by the Nginx worker user, or place the build under a normal application path such as `/opt/front-rn/dist`.

Recommended preflight checks for Linux production:

```bash
nginx -t
namei -l /opt/front-rn/dist/index.html
curl -I http://127.0.0.1/
curl -I http://127.0.0.1/assets/<real-built-chunk>.js
curl http://127.0.0.1/node-api/health
```
