# front-Xe 前端服务器

front-Xe 是 Web 前端和 Node BFF/静态服务入口。开发态使用 Vite，生产态使用构建后的 `dist/` 与 `server.mjs`。浏览器访问后端 API 不应直接请求后端 `/api/v1`，而应通过前端 BFF 的节点代理路径：

```text
/node-api/{selectedNodeId}/api/v1/...
```

## 1. 运行模式概览

| 模式 | 入口 | 用途 | 依赖说明 |
| --- | --- | --- | --- |
| Windows / Linux / macOS 开发态 | `npm run dev` | 本地开发、Vite HMR | 不需要 Nginx，不需要 systemd，不需要 SEA 二进制 |
| 默认跨平台生产态 | `node server.mjs` | Node 服务 `dist/` 静态资源，并提供 BFF `/node-api/` 代理 | 适合 Windows / Linux / macOS |
| Linux 低配服务器推荐生产态 | `NODE_ENV=production FRONTEND_HOST=0.0.0.0 FRONTEND_PORT=8080 node server.mjs` | 2-4 核 / 2-4G Linux 云服务器 | 不要使用 Vite dev server 对外提供生产访问 |
| 可选 Nginx + Node BFF 模式 | Nginx + `node server.mjs` | Nginx 负责静态资源缓存、gzip、SPA fallback，Node 只负责 `/node-api/` | 仅作为 Linux 生产环境可选增强 |
| 可选 Node SEA / 二进制启动模式 | SEA / 单文件启动器 | 只作为部署形态优化 | 不保证明显提升浏览器首屏加载速度，不替代静态资源缓存、拆包、懒加载和 BFF keep-alive |

## 2. Windows 开发态

```powershell
npm install
npm run dev
```

说明：

- Windows 开发态不需要 Nginx。
- Windows 开发态不需要 systemd。
- Windows 开发态不需要生成 SEA 二进制。
- 不要使用 `NODE_ENV=production xxx` 这种 Linux shell 写法作为 Windows 默认命令。
- 如需设置环境变量，应使用 PowerShell 语法，例如：

```powershell
$env:FRONTEND_PORT="8080"
$env:FRONTEND_HOST="0.0.0.0"
node server.mjs
```

## 3. Linux / macOS 开发态

```bash
npm install
npm run dev
```

说明：

- 该模式是开发模式，不建议公网部署。
- Vite dev server 适合开发调试，不适合作为生产静态资源服务器。

## 4. 默认跨平台生产部署

```bash
npm run build
NODE_ENV=production FRONTEND_HOST=0.0.0.0 FRONTEND_PORT=8080 node server.mjs
```

Windows PowerShell 版本：

```powershell
npm run build
$env:NODE_ENV="production"
$env:FRONTEND_HOST="0.0.0.0"
$env:FRONTEND_PORT="8080"
node server.mjs
```

说明：

- `server.mjs` 会服务 `dist/` 静态文件。
- `index.html` 使用 no-cache，避免前端版本更新后入口文件缓存不刷新。
- `dist/assets/*` 使用长期缓存，例如 immutable。
- `/node-api/` 请求不会被 SPA fallback 吃掉。
- 生产环境不要使用 `npm run dev`。

## 5. 低配 Linux 云服务器建议

建议：

- 使用生产构建后的 `dist/`。
- 使用 `NODE_ENV=production`。
- 关闭 debug 级别日志。
- 不要让 Vite dev server 对外服务。
- 不要每次访问动态构建。
- 如果机器只有 2-4 核 / 2-4G，优先保证：
  - 前端按路由懒加载。
  - 资产中心图表、搜索、索引、文件预览按需加载。
  - 静态资源缓存生效。
  - BFF 到后端启用 keep-alive。
  - 页面不可见时不轮询重接口。

systemd 仅示例，不是项目强依赖：

```ini
[Unit]
Description=front-Xe web server
After=network.target

[Service]
WorkingDirectory=/opt/front-xe
ExecStart=/usr/bin/node /opt/front-xe/server.mjs
Restart=always
Environment=NODE_ENV=production
Environment=FRONTEND_HOST=127.0.0.1
Environment=FRONTEND_PORT=8080
Environment=LOG_LEVEL=warn

[Install]
WantedBy=multi-user.target
```

## 6. 可选 Nginx + Node BFF 部署

说明：

- Nginx 不是必须依赖。
- 只有在 Linux 生产环境需要更高静态资源性能、TLS、gzip、缓存控制时才考虑。
- Nginx 可以服务 `dist/`，Node 继续处理 `/node-api/`。
- 如果项目存在 `deploy/nginx/front-xe.conf.example`，可以参考它。
- Nginx 配置中的 `root` 路径必须改成真实部署路径。
- `/node-api/` 必须代理到 Node BFF，不能 fallback 到 `index.html`。

## 7. 可选 Node SEA / 二进制启动

说明：

- SEA / 二进制模式只是可选部署形态。
- 它可能减少运行环境依赖或冷启动文件加载成本，但不会解决浏览器下载 JS 慢、chunk 过大、静态缓存无效等问题。
- 如果存在 `scripts/build-node-sea.mjs`，它只是准备模板，不会自动生成最终二进制。
- 不建议把 SEA 作为默认部署方式。
- Windows 开发态不需要 SEA。

## 8. API 代理与节点选择

必须通过前端 BFF 访问后端，不要直连后端 `/api/v1`。

```text
/node-api/{selectedNodeId}/api/v1/...
```

说明：

- 这样可以保留多节点切换、BFF 代理、统一错误处理、认证/CSRF/签名等逻辑。
- 新增前端 API service 时，不要绕过该代理路径。
- `/node-api/` 不能被静态资源路由或 SPA fallback 接管。

## 9. 资产中心性能实现说明

- 资产中心页面不应在进入首页时加载。
- 资产中心内部的总览、文件、搜索、关系、索引子页应按需加载。
- UML 图、ECharts 图、搜索索引、文件预览、JSON Viewer 等重模块不得在首屏同步加载。
- 搜索索引只在搜索页/索引页按需构建。
- 内容搜索默认关闭。
- 文件预览只读取当前文件。
- 关系图和总览图只在对应子页渲染。
- 非当前 tab 不应请求重数据。
- 大列表需要分页、限制首屏数量或“显示更多”。

## 10. 静态资源缓存策略

- `index.html` 不应长期缓存。
- 带 hash 的 `/assets/*` 可以长期缓存。
- 其他静态资源可以短期缓存。
- 生产环境更新后，如果用户仍看到旧页面，优先检查 `index.html` 缓存策略。
- 不要让 API 响应被当作静态资源缓存。

## 11. 常见问题

### Windows 上还能运行开发态吗？

可以。默认开发态仍然是：

```powershell
npm run dev
```

Nginx、systemd、SEA 都不是 Windows 开发态必需项。

### 生产环境能不能直接用 npm run dev？

不建议。`npm run dev` 是 Vite 开发服务器，适合本地调试，不适合生产部署。

### 为什么浏览器不能直接请求后端 API？

项目需要通过前端 BFF 处理节点选择、代理、认证/CSRF/错误处理等逻辑，直接绕过会导致多节点和统一错误处理失效。

### Nginx 是否必须？

不是。默认 Node server 可以跨平台运行。Nginx 只是 Linux 生产部署的可选增强。

### SEA 二进制是否必须？

不是。SEA 主要优化部署形态，不是首屏加载性能的核心手段。

## 12. 检查命令

```bash
npm exec tsc -- -p tsconfig.app.json --noEmit
```

如果项目存在 `tsconfig.node.json`，再运行：

```bash
npm exec tsc -- -p tsconfig.node.json --noEmit
```

如果修改了 `server.mjs`，可检查：

```bash
node --check server.mjs
```

## 13. 参考文档

- `docs/performance-deployment.md`
- `deploy/nginx/front-xe.conf.example`
- `scripts/build-node-sea.mjs`
