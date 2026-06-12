# fuzz-core-web-ui

面向 `InvincibleMadman/fuzz-core` 的 React + TypeScript + Vite 前端。

## 安装

```bash
npm install
npm run dev
```

默认 API Base URL 建议设置为：

```text
http://127.0.0.1:18000
```

## 说明

- 仅对接仓库里已经存在的 HTTP API。
- 优先使用 `/api/v1/*`。
- WebSocket 仅使用：
  - `/api/v1/jobs/{job_id}/events/ws`
  - `/api/v1/jobs/{job_id}/metrics/ws`
  - `/api/v1/jobs/{job_id}/artifacts/ws`
- Offline Studio 使用“路径型工作流”，不会把服务端路径错误地当作浏览器本地文件。
- `Risk Upload` 是唯一明确使用 `multipart/form-data` 文件上传的离线模块。
