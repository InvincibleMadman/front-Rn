<!-- 目标落盘路径：front-Ne/docs/CODEX_AR_API_CONTRACT.md -->
# CODEX_AR_API_CONTRACT.md

## 1. 全局响应格式

所有新增接口统一返回：

```ts
export interface ApiEnvelope<T> {
  ok: boolean;
  message: string;
  data: T;
}
```

错误示例：

```json
{ "ok": false, "message": "unauthorized", "data": null }
```

## 2. API 分层

Web BFF 控制面 API：

```http
POST   /web-api/auth/login
POST   /web-api/auth/logout
GET    /web-api/auth/me
GET    /web-api/csrf
GET    /web-api/users
POST   /web-api/users
DELETE /web-api/users/{username}
GET    /web-api/nodes
POST   /web-api/nodes
PATCH  /web-api/nodes/{node_id}
DELETE /web-api/nodes/{node_id}
POST   /web-api/nodes/{node_id}/ping
GET    /web-api/dashboard/overview
```

节点代理 API：

```http
ANY /node-api/{node_id}/api/v1/*
WS  /node-ws/{node_id}/api/v1/*
```

前端业务接口全部通过 `/node-api/{nodeId}/api/v1/*` 调用，不直接访问后端 `base_url`。

FastAPI 节点业务 API 保持 `/api/v1/*`，但由 BFF 注入短期 node token 和请求签名。

## 3. 用户与节点 API

Login：

```http
POST /web-api/auth/login
```

请求：

```json
{ "username": "admin", "password": "admin123" }
```

响应：

```json
{
  "ok": true,
  "message": "ok",
  "data": {
    "user": { "user_id": "user-abc", "username": "admin", "role": "admin" }
  }
}
```

BFF 设置 HttpOnly session cookie。前端不保存密码，不保存后端节点 token。

Node 类型：

```ts
export interface NodeRecord {
  node_id: string;
  name: string;
  base_url: string;
  description?: string;
  enabled: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  secret_configured: boolean;
}
```

`node_secret` 只在创建/修改时提交，不回显。

## 4. Dashboard Overview

```http
GET /web-api/dashboard/overview
```

响应：

```json
{
  "ok": true,
  "message": "ok",
  "data": {
    "global": {
      "node_count": 3,
      "online_nodes": 2,
      "protocol_count": 8,
      "running_jobs": 1,
      "crash_count": 12,
      "vulnerability_count": 6,
      "debug_session_count": 5,
      "report_count": 3
    },
    "nodes": [
      {
        "node_id": "local",
        "name": "本机后端",
        "status": "online",
        "protocol_count": 4,
        "running_jobs": 1,
        "crash_count": 5,
        "vulnerability_count": 2,
        "last_seen_at": "2026-06-02T10:00:00+09:00"
      }
    ],
    "current_node": {
      "node_id": "local",
      "protocol_graph": { "nodes": [], "edges": [] },
      "job_trend": [],
      "vulnerability_distribution": [],
      "recent_events": []
    }
  }
}
```

某节点失败时：

```json
{ "node_id": "remote", "name": "远端节点", "status": "offline", "error": "connection timeout" }
```

## 5. workspace_ref

格式：

```text
workspace://{protocol}/{scope}/{virtual_path}
```

示例：

```text
workspace://modbus/source/
workspace://modbus/specs/spec.json
workspace://modbus/seeds/bin/
workspace://modbus/binaries/target-afl
workspace://modbus/reports/report.pdf
```

允许 scope：

```text
source specs vuldocs kb seeds risk jobs debug history reports build binaries dicts build_logs build_plans build_runs launch_profiles
```

禁止：`../`、绝对路径、`file://`、真实服务器路径。

## 6. 资产与文件树 API

```http
GET /api/v1/assets/overview-graph
GET /api/v1/assets
GET /api/v1/protocols/{protocol}/assets
GET /api/v1/protocols/{protocol}/assets/summary
GET /api/v1/protocols/{protocol}/workspace/tree?scope=source&path=/
GET /api/v1/protocols/{protocol}/workspace/preview?scope=source&path=/main.c
GET /api/v1/protocols/{protocol}/workspace/download?scope=source&path=/main.c
DELETE /api/v1/protocols/{protocol}
```

`DELETE /api/v1/protocols/{protocol}` 要求 admin。

Tree Response：

```json
{
  "protocol": "modbus",
  "scope": "source",
  "path": "/",
  "items": [
    { "name": "src", "type": "directory", "virtual_path": "/src", "size": null, "updated_at": "2026-06-02T00:00:00Z" },
    { "name": "main.c", "type": "file", "virtual_path": "/main.c", "size": 2048, "mime": "text/x-c", "previewable": true, "downloadable": true, "updated_at": "2026-06-02T00:00:00Z" }
  ]
}
```

Preview text：

```json
{ "preview_type": "text", "truncated": false, "content": "int main() {}", "size": 2048 }
```

Preview hex：

```json
{ "preview_type": "hex", "size": 128, "hex": "00 01 FF", "ascii": "..." }
```

## 7. Source Import

Archive upload：

```http
POST /api/v1/protocols/{protocol}/source/upload-archive
Content-Type: multipart/form-data
```

字段：`file`、`replace_existing:boolean`。

响应：

```json
{
  "ok": true,
  "message": "ok",
  "data": { "protocol": "modbus", "source_ref": "workspace://modbus/source/", "files_count": 128, "warnings": [] }
}
```

GitHub clone：

```http
POST /api/v1/protocols/{protocol}/source/import-git
```

请求：

```json
{ "repo_url": "https://github.com/example/protocol.git", "branch": "main", "replace_existing": true }
```

只允许 GitHub HTTPS URL。不得允许任意 shell 命令。

## 8. BuildPlan

```ts
export interface BuildStep {
  name: string;
  cwd_ref: string;
  argv: string[];
  env: Record<string, string>;
}

export interface BuildPlan {
  plan_id: string;
  plan_hash: string;
  protocol: string;
  source_ref: string;
  compiler: string;
  instrumentation_mode: string;
  use_llm: boolean;
  server_generated: true;
  created_by: string;
  created_at: string;
  steps: BuildStep[];
  warnings: string[];
}
```

API：

```http
GET  /api/v1/protocols/{protocol}/build/probe
POST /api/v1/protocols/{protocol}/build/plans
GET  /api/v1/protocols/{protocol}/build/plans
POST /api/v1/protocols/{protocol}/build/plans/{plan_id}/dry-run
POST /api/v1/protocols/{protocol}/build/plans/{plan_id}/run
```

Create request：

```json
{
  "source_ref": "workspace://modbus/source/",
  "compiler": "afl-clang-fast",
  "instrumentation_mode": "llvm",
  "sanitizers": ["asan", "ubsan"],
  "use_llm": false,
  "user_hint": "build server example target"
}
```

安全：BuildPlan 由后端生成并保存；LLM 只能输出 JSON 候选；执行时必须读取服务端保存的 BuildPlan；前端回传的 `steps` 不得参与正式执行；`plan_hash` 必须重新计算。

## 9. BuildRun / TargetCandidate

```ts
export interface TargetCandidate {
  target_id: string;
  name: string;
  binary_ref: string;
  cwd_ref: string;
  detected_io: "file_or_stdin" | "network_or_server" | "unknown";
  confidence: number;
}

export interface BuildRun {
  build_id: string;
  plan_id: string;
  protocol: string;
  status: "created" | "running" | "success" | "failed";
  log_ref?: string;
  targets: TargetCandidate[];
  dicts: string[];
  compile_database_ref?: string;
}
```

API：

```http
GET /api/v1/protocols/{protocol}/build/runs
GET /api/v1/protocols/{protocol}/build/runs/{build_id}
GET /api/v1/protocols/{protocol}/build/targets
```

## 10. LaunchProfile

```ts
export interface LaunchProfile {
  profile_id: string;
  profile_hash: string;
  protocol: string;
  build_id?: string;
  target_id?: string;
  binary_ref: string;
  cwd_ref?: string;
  input_ref?: string;
  output_ref?: string;
  dict_ref?: string;
  input_mode: "stdin" | "file_argv" | "fixed_file" | "network_desock" | "unknown";
  afl_tool_id: string;
  afl_args: string[];
  target_cmd: string[];
  env: Record<string, string>;
  server_generated: true;
  created_by: string;
  created_at: string;
  warnings: string[];
  explanation: string[];
}
```

API：

```http
POST /api/v1/protocols/{protocol}/fuzz/launch-profiles/predict
GET  /api/v1/protocols/{protocol}/fuzz/launch-profiles
```

Example response：

```json
{
  "profile_id": "launch-profile-abc",
  "profile_hash": "sha256-of-canonical-profile",
  "protocol": "iec61850",
  "target_id": "target-unit-test-server",
  "binary_ref": "workspace://iec61850/binaries/unit-test-server-afl",
  "input_ref": "workspace://iec61850/seeds/bin/",
  "dict_ref": "workspace://iec61850/dicts/auto.dict",
  "input_mode": "file_argv",
  "afl_tool_id": "afl-fuzz",
  "afl_args": ["-m", "none", "-t", "1000+", "-x", "workspace://iec61850/dicts/auto.dict"],
  "target_cmd": ["workspace://iec61850/binaries/unit-test-server-afl", "@@"],
  "env": { "AFL_SKIP_CPUFREQ": "1" },
  "server_generated": true,
  "warnings": [],
  "explanation": ["检测到二进制目标。", "检测到 seeds/bin。", "检测到 auto.dict。"]
}
```

## 11. JobCreate

正式执行模式：

```json
{ "protocol": "iec61850", "launch_profile_id": "launch-profile-abc", "dry_run": false }
```

正式执行模式下，后端必须从服务端保存的 LaunchProfile 读取命令，重新计算 `profile_hash`，重新校验 allowlist，重新解析 workspace_ref，生成 argv 后执行。

Dry-run 草案模式：

```json
{
  "protocol": "iec61850",
  "target_cmd": ["workspace://iec61850/binaries/unit-test-server-afl", "@@"],
  "fuzzer_args": ["-m", "none", "-t", "1000+"],
  "dry_run": true
}
```

`dry_run=true` 可以接收草案字段，但不能真正执行。

## 12. Vulnerabilities / Reports

```http
GET /api/v1/protocols/{protocol}/vulnerabilities/summary
GET /api/v1/protocols/{protocol}/vulnerabilities/records
GET  /api/v1/protocols/{protocol}/reports/summary
POST /api/v1/protocols/{protocol}/reports/generate
GET  /api/v1/protocols/{protocol}/reports
GET  /api/v1/protocols/{protocol}/reports/{report_id}/download
```

Generate request：

```json
{ "title": "modbus 协议安全测试报告", "include_assets": true, "include_debug": true, "include_kb": true, "include_raw_json_appendix": false }
```

## 13. Config YAML Additions

```yaml
control_plane:
  enabled: true
  node_id: "local"
  issuer: "icp-fuzz-web"
  node_secret: "change-me-node-secret"
  token_expire_seconds: 120

workspace:
  expose_real_paths: false
  max_preview_bytes: 200000
  allowed_archive_extensions: [".zip", ".tar", ".tar.gz", ".tgz"]
  max_upload_size_mb: 200
  allowed_git_hosts: ["github.com"]

paths:
  afl_fuzz: "afl-fuzz"
  afl_showmap: "afl-showmap"
  afl_cc: "afl-cc"
  afl_clang_fast: "afl-clang-fast"
  afl_clang_lto: "afl-clang-lto"
  afl_gcc_fast: "afl-gcc-fast"
  cmake: "cmake"
  make: "make"
  ninja: "ninja"
  meson: "meson"
  bear: "bear"
  git: "git"
  preeny_desock: ""

build:
  enabled: true
  allow_llm_assist: true
  default_compiler: "afl-clang-fast"
  allowed_compilers: ["afl-cc", "afl-clang-fast", "afl-clang-lto", "afl-gcc-fast"]
  allowed_tools: ["cmake", "make", "ninja", "meson", "bear", "git"]
  max_build_seconds: 600
  max_log_bytes: 2000000
  allow_shell_scripts: false
```
