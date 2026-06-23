# systemd 部署说明

## 1. 适用前提

systemd 仅适用于 Linux 生产/测试环境，不适用于：

- Windows
- 本地前端开发态
- Vite HMR 场景

## 2. 目的

使用 systemd 的主要目标是：

- 守护 `node server.mjs`
- 开机自启
- 异常自动重启
- 统一日志管理

## 3. 推荐运行方式

前端生产态推荐：

```bash
npm run build
NODE_ENV=production FRONTEND_HOST=127.0.0.1 FRONTEND_PORT=8080 node server.mjs
```

在 systemd 中等价写法如下：

```ini
[Unit]
Description=front-Rn web server
After=network.target

[Service]
WorkingDirectory=/opt/front-rn
ExecStart=/usr/bin/node /opt/front-rn/server.mjs
Restart=always
Environment=NODE_ENV=production
Environment=FRONTEND_HOST=127.0.0.1
Environment=FRONTEND_PORT=8080
Environment=LOG_LEVEL=warn

[Install]
WantedBy=multi-user.target
```

## 4. 配置建议

### 4.1 `WorkingDirectory`
设置为前端仓库部署目录。

### 4.2 `ExecStart`
应指向系统实际 `node` 路径与 `server.mjs` 实际路径。

### 4.3 日志
可结合 `journalctl -u <service>` 查看运行日志。

### 4.4 与 Nginx 配合
若使用 Nginx，则建议 Node 仅监听 `127.0.0.1`，由 Nginx 反向代理公开服务。

## 5. 上线流程建议

1. 构建产物部署到目标目录
2. 确认 `dist/` 存在
3. `node --check server.mjs`
4. 写入 systemd service
5. `systemctl daemon-reload`
6. `systemctl enable --now <service>`
7. 配合 `curl` 或浏览器验证首页和 `/node-api/`

## 6. 结论

systemd 是 Linux 环境下推荐的进程守护方式，但它只是前端部署的运维层，不会改变 BFF 架构本身。
