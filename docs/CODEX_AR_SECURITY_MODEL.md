<!-- 目标落盘路径：front-Ne/docs/CODEX_AR_SECURITY_MODEL.md -->
# CODEX_AR_SECURITY_MODEL.md

> 后端项目也需要一个同名安全文档，下载文件中提供 `backend_docs_CODEX_AR_SECURITY_MODEL.md`。

## 1. 安全总目标

本系统包含上传源码、git clone、构建、运行 AFL++、GDB 调试、下载产物等高风险能力，因此安全边界必须放在后端/BFF，不能只依赖前端 UI。

核心原则：

```text
Browser 不保存 node_secret
Browser 不保存后端 node token
Browser 不提交任意系统命令
BFF 统一登录与节点代理
BFF→FastAPI 节点请求必须签名
FastAPI 节点必须验证 token + 请求签名 + nonce
所有命令执行都通过服务端保存的计划 ID
```

## 2. Browser → Web BFF

使用：HttpOnly session cookie、SameSite=Lax、Secure（生产 HTTPS 时开启）、CSRF token。

非 GET/HEAD/OPTIONS 请求必须带：

```http
X-CSRF-Token: <token>
```

BFF 校验后再处理。

禁止：localStorage 保存密码、node_secret、FastAPI node token。

可以保存：selectedNodeId、UI preference、theme。

## 3. Web BFF → FastAPI Node

每次代理业务请求时，BFF 生成短期 node JWT：

```json
{
  "iss": "icp-fuzz-web",
  "aud": "node:local",
  "sub": "user_id",
  "username": "alice",
  "role": "user",
  "node_id": "local",
  "jti": "uuid",
  "iat": 1710000000,
  "exp": 1710000120
}
```

同时签名请求：

```http
Authorization: Bearer <short-lived-node-token>
X-ICP-Timestamp: 2026-06-02T12:34:56Z
X-ICP-Nonce: <random-128-bit-hex>
X-ICP-Body-SHA256: <hex>
X-ICP-Signature: <hmac-sha256>
```

签名 canonical string：

```text
METHOD + "\n" +
PATH_WITH_QUERY + "\n" +
TIMESTAMP + "\n" +
NONCE + "\n" +
BODY_SHA256 + "\n" +
NODE_ID + "\n" +
JWT_JTI
```

后端节点验证：JWT signature、issuer、audience、exp、jti、timestamp 时间窗 <= 60 秒、body hash、HMAC signature、nonce 未使用。nonce TTL 至少 180 秒。

## 4. 防篡改与防重放

改包篡改命令：正式执行只接受 `launch_profile_id`，后端从服务端保存的 LaunchProfile 读取命令，重新校验 `profile_hash`；`afl_tool_id` 必须在 allowed_tools；target binary 必须是 workspace_ref；禁止 `shell=True`。

BFF→Node 请求体被改：body hash 被 HMAC 覆盖，后端重新计算 body hash，signature 不匹配则 401。

原样重放：nonce cache + timestamp 时间窗 + JWT jti；重复 nonce 401。

截获 node token 后单独访问节点：节点不仅验证 JWT，还验证 X-ICP-* request signature；攻击者没有 node_secret，不能伪造 signature。

## 5. 命令执行安全

禁止请求格式：

```json
{ "command": "afl-fuzz -i in -o out -- target @@" }
```

禁止正式执行时使用前端传来的：

```json
{ "afl_tool": "/bin/bash", "fuzzer_args": ["-c", "..."], "target_cmd": ["..."] }
```

正式执行只允许：

```json
{ "protocol": "iec61850", "launch_profile_id": "launch-profile-abc", "dry_run": false }
```

`dry_run=true` 可接受草案字段，但不能真正执行。

## 6. 工具 allowlist

后端配置允许工具：

```yaml
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

build:
  allowed_tools: ["cmake", "make", "ninja", "meson", "bear", "git"]
```

拒绝：rm、mv、curl、wget、ssh、scp、sudo、chmod、chown、systemctl、docker、mount、dd、mkfs、bash -c、sh -c、python -c、perl -e。除非后续明确做沙箱隔离，否则不允许开放 shell script 执行。

## 7. workspace_ref 安全

必须满足：scope 在允许列表；virtual_path 不能包含 `..`；virtual_path 不能是绝对路径；resolve 后必须在 scope_root 内；不跟随 symlink 逃逸；默认隐藏 `.git`、`.ssh`、`.env`、`*.pem`、`*.key`。

## 8. 上传与解压

源码上传支持 `.zip`、`.tar`、`.tar.gz`、`.tgz`。必须限制大小、检查扩展名、检查解压后路径、防 Zip Slip、禁止 symlink 逃逸、替换 source/ 前做备份或清空、上传内容不直接执行。

## 9. GitHub clone

只允许：

```text
https://github.com/{owner}/{repo}.git
https://github.com/{owner}/{repo}
```

禁止 ssh://、git@、file://、非 HTTPS、任意 shell 字符。

后端使用 argv：

```python
["git", "clone", "--depth", "1", "--branch", branch, repo_url, target_dir]
```

不得 `shell=True`。

## 10. 前端显示规则

可以显示“命令预览”，但必须标注“预览由后端生成，执行时后端重新校验”。不显示服务器绝对路径、node_secret、后端 node token。报告不包含服务器绝对路径。
