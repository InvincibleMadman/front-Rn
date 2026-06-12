<!-- 目标落盘路径：front-Ne/docs/CODEX_AR_TECH_REFERENCES.md -->
# CODEX_AR_TECH_REFERENCES.md

## 1. BFF / Web 控制面

### Azure Architecture Center：Backends for Frontends Pattern

URL:

```text
https://learn.microsoft.com/en-us/azure/architecture/patterns/backends-for-frontends
```

用途：前端 Web 体验对应一个专门控制面；Web BFF 统一管理用户、节点、会话、代理、聚合，避免浏览器直接与多个后端节点交互。

### Auth0：Backend for Frontend Pattern

URL:

```text
https://auth0.com/blog/the-backend-for-frontend-pattern-bff/
```

用途：BFF 模式可以避免 SPA 直接持有后端 token；浏览器只持有 HttpOnly session，Web BFF 才保存和签发下游访问凭据。

## 2. Fastify

### Fastify

URL:

```text
https://github.com/fastify/fastify
```

用途：Node BFF 服务器、高性能 HTTP API、托管 dist、提供 `/web-api` 和 `/node-api`。

### @fastify/static

URL:

```text
https://github.com/fastify/fastify-static
```

用途：服务 React/Vite build 后的 `dist/`。不要使用已废弃的 `fastify-static` 包名。

### @fastify/http-proxy

URL:

```text
https://github.com/fastify/fastify-http-proxy
```

用途：将 `/node-api/:nodeId/*` 代理到对应 FastAPI 后端。也可以不用该插件，手动用 `fetch` 转发，以便更精细地做 body hash 和 request signing。

### @fastify/jwt / @fastify/cookie

URL:

```text
https://github.com/fastify/fastify-jwt
https://github.com/fastify/fastify-cookie
```

用途：Web BFF session、node token 签发、HttpOnly cookie。

## 3. FastAPI / JWT

### FastAPI OAuth2 with Password Hashing and JWT

URL:

```text
https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/
```

用途：参考 JWT 与密码哈希的基本实现方式。本项目最终账户保存在 Web BFF，不保存在 FastAPI 节点；但 FastAPI 节点仍需验证 BFF 签发的 node token。

## 4. OWASP 安全参考

### CSRF Prevention Cheat Sheet

URL:

```text
https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
```

用途：Web BFF 使用 HttpOnly cookie session 时，非 GET 请求要校验 CSRF token。可使用 `X-CSRF-Token` 自定义 header。

### Session Management Cheat Sheet

URL:

```text
https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
```

用途：session ID / token 应高熵、无意义、不泄露敏感数据；cookie 要设置 HttpOnly、SameSite，生产环境设置 Secure。

### File Upload Cheat Sheet

URL:

```text
https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
```

用途：源码压缩包上传要限制扩展名、大小、内容类型；解压前后做安全校验；上传内容不得直接执行。

### Path Traversal

URL:

```text
https://owasp.org/www-community/attacks/Path_Traversal
```

用途：虚拟文件树、workspace_ref 解析、防止 `../` 和绝对路径逃逸；解压 zip/tar 时防 Zip Slip。

### JWT Testing

URL:

```text
https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/06-Session_Management_Testing/10-Testing_JSON_Web_Tokens
```

用途：检查 JWT issuer/audience/expiration/signature；不接受 unsigned token；不接受错误 algorithm。

## 5. 构建与 Fuzz

### OSS-Fuzz New Project Guide

URL:

```text
https://google.github.io/oss-fuzz/getting-started/new-project-guide/
```

用途：参考 `build.sh` 模式：构建脚本负责生成 fuzz target。本项目用 BuildPlan / BuildRun 抽象替代 OSS-Fuzz 的项目构建脚本。

### OSS-Fuzz agent-based build generation

URL:

```text
https://blog.oss-fuzz.com/posts/oss-fuzz-integrations-via-agent-based-build-generation/
```

用途：说明“辅助生成构建脚本 / fuzz harness”是可借鉴方向。本项目可选 LLM 辅助构建命令，但必须服务端校验。

### CMake CMAKE_EXPORT_COMPILE_COMMANDS

URL:

```text
https://cmake.org/cmake/help/latest/variable/CMAKE_EXPORT_COMPILE_COMMANDS.html
```

用途：CMake 项目可生成 `compile_commands.json`。构建助手可用于提取 include、宏定义、源文件上下文。

### Bear

URL:

```text
https://github.com/rizsotto/Bear
```

用途：对 Makefile 等项目捕获编译数据库。Build Assistant 可选使用。

### Clang JSON Compilation Database

URL:

```text
https://clang.llvm.org/docs/JSONCompilationDatabase.html
```

用途：`compile_commands.json` 的格式依据，可用于后续风险分析上下文增强。

### AFL++ Documentation

URL:

```text
https://aflplus.plus/docs/
https://aflplus.plus/docs/fuzzing_in_depth/
```

用途：`afl-fuzz -i input -o output -- target ...`、文件输入常用 `@@`、字典 `-x`、多实例 `-M/-S`、网络服务通常需要改造或 desock/preeny。

### AFL++ networking note

URL:

```text
https://android.googlesource.com/platform/external/AFLplusplus/+/HEAD/docs/best_practices.md
```

用途：网络服务 fuzzing 往往需要共享库或改造输入通道。LaunchProfile Predictor 对 network/server 目标必须给 warning。

## 6. PDF 报告

### ReportLab Platypus

URL:

```text
https://docs.reportlab.com/reportlab/userguide/ch5_platypus/
```

用途：后端生成 PDF 报告；适合程序化安全报告；中文字体需要系统字体支持，不要把字体文件分享给用户。
