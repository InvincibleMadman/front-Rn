# Nginx 扩展部署说明

## 1. 定位

Nginx 在本项目中是**可选增强层**，不是必须依赖。默认情况下，`node server.mjs` 已可直接提供：

- `dist/` 静态资源
- SPA fallback
- `/node-api/` 与 `/node-ws/` BFF 能力

引入 Nginx 的主要目标是：

- 承担 TLS
- 提供更成熟的静态资源缓存与 gzip
- 作为 Linux 生产环境的前置反向代理

## 2. 推荐拓扑

```text
Browser
  -> Nginx
     -> /assets/*  静态缓存
     -> /           SPA 入口
     -> /node-api/  反代到 Node BFF
```

## 3. 参考配置

仓库中已有示例：

- `deploy/nginx/front-xe.conf.example`

其基本设计是：

- `root /opt/front-xe/dist;`
- `/assets/` 长缓存
- `/index.html` no-cache
- `/node-api/` 转发到 Node
- `/` 做 SPA fallback

## 4. 部署步骤建议

1. 执行 `npm run build`
2. 将 `dist/` 与 `server.mjs` 部署到目标目录
3. 启动 Node BFF，例如监听 `127.0.0.1:8080`
4. 将 Nginx 配置中的 `root` 改成实际 `dist/` 路径
5. 将 `/node-api/` 代理指向 Node BFF
6. `nginx -t` 校验后上线

## 5. 注意事项

### 5.1 不能让 `/node-api/` 落入 SPA fallback
否则浏览器会收到 HTML，而不是 API 响应。

### 5.2 不能长期缓存 `index.html`
否则新版本前端入口文件无法及时刷新。

### 5.3 `/assets/*` 应该可以长期缓存
因为构建产物通常带 hash。

### 5.4 目录权限必须正确
Nginx worker 必须能够读取 `dist/` 及其父目录。

## 6. 适用场景

适合以下部署场景：

- Linux 服务器生产环境
- 需要 HTTPS / TLS 终结
- 需要较强静态资源吞吐
- 需要与其他 Web 服务统一接入

## 7. 不适用场景

以下场景通常不需要 Nginx：

- Windows 本地开发
- 小范围内网测试
- 直接由 Node 提供生产访问且访问量很小

## 8. 结论

Nginx 是本项目的扩展部署层，不改变系统访问模型。即便引入 Nginx，核心原则仍然是：

- 浏览器访问 BFF
- BFF 代理后端节点
- 节点 secret 不暴露到浏览器
