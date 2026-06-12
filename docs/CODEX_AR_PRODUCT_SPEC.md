<!-- 目标落盘路径：front-Ne/docs/CODEX_AR_PRODUCT_SPEC.md -->
# CODEX_AR_PRODUCT_SPEC.md

## 0. Codex 路径确认

```bash
pwd
ls -la
ls -la ..
BACKEND_DIR="../fuzz-server-Ne"
if [ ! -d "$BACKEND_DIR" ]; then BACKEND_DIR="../fuzz-server-He"; fi
echo "$BACKEND_DIR"
test -d "$BACKEND_DIR"
```

不要重命名 `front-Ne`、`fuzz-server-Ne`、`fuzz-server-He`。Codex 当前会话运行在 `front-Ne`，改名会影响 AGENTS.md、相对路径、后续阶段提示词和后端 sibling 路径定位。

## 1. 最终系统定位

将当前 ICP Fuzz 改造成：

```text
面向工业协议实现的智能模糊测试与漏洞验证平台
```

产品主线：

```text
Web BFF 登录认证
  ↓
仪表盘总览
  ↓
资产中心
  ↓
协议准备工作台
  ↓
构建 Fuzz 目标
  ↓
Fuzz 任务
  ↓
漏洞中心
  ↓
GDB 智能调试
  ↓
产物中心
  ↓
报告中心
```

## 2. 总体架构

前端 Node 服务器不是纯静态服务器，而是 Web BFF 控制面：

```text
Browser
  ↓ HttpOnly Session Cookie + CSRF
Web BFF / Control Plane, Node + Fastify
  ├─ 托管 React dist/
  ├─ 统一用户数据库
  ├─ 统一节点数据库
  ├─ HttpOnly 会话
  ├─ /web-api/* 控制面 API
  ├─ /node-api/:nodeId/* 节点代理
  ├─ 节点短期 token 签发
  ├─ BFF→节点请求签名
  └─ 跨节点仪表盘聚合
        ↓ short-lived node JWT + HMAC request signature
FastAPI Backend Node
  ├─ 本节点 workspace/protocols/*
  ├─ 本节点 offline/jobs/debug/assets/reports/config
  └─ 只验证 BFF 签发的 node token，不保存统一用户账户
```

数据隔离：Web BFF 只保存统一账户、节点列表、会话和聚合摘要缓存；各 FastAPI 后端节点只保存本节点协议资产、任务、漏洞、产物、报告。节点 A 的业务数据不得写入节点 B。

## 3. 用户与权限模型

只有 `admin` 和 `user` 两种角色。Web BFF 保存统一账户，FastAPI 节点不保存统一账户。

| 功能 | admin | user |
|---|---:|---:|
| 登录使用 | 是 | 是 |
| 上传协议源码压缩包 | 是 | 是 |
| GitHub URL 导入源码 | 是 | 是 |
| 增加后端节点 | 是 | 是 |
| 修改自己创建的节点 | 是 | 是 |
| 修改所有节点 | 是 | 否 |
| 删除节点 | 是 | 否 |
| 新增用户 | 是 | 否 |
| 删除用户 | 是 | 否 |
| 删除整个协议资产项目 | 是 | 否 |
| 使用协议准备工作台 | 是 | 是 |
| 使用构建助手 | 是 | 是 |
| 使用 Fuzz/GDB/报告 | 是 | 是 |
| 修改当前节点后端配置 | 是 | 是 |

关键规则：普通用户可新增节点，但不能删除节点；普通用户可修改自己新增节点；管理员可修改/删除所有节点。管理员可删除协议项目，普通用户不可删除协议项目。

## 4. 页面结构

最终导航顺序：

```text
仪表盘
资产中心
协议准备工作台
Fuzz 任务
漏洞中心
GDB 调试
产物中心
报告中心
节点管理
系统设置
```

必须保留现有仪表盘总览页，并在现有设计上增强。不得用资产中心替换仪表盘。

## 5. 仪表盘总览页

仪表盘作为全局总览入口，展示跨节点状态、跨协议状态、当前节点重点信息、最近任务 / 漏洞 / GDB / 报告 / 日志。

第一行全局 KPI：节点总数、在线节点、协议资产数、运行中任务、Crash 总数、漏洞总数、GDB 会话数、报告数。

第二行跨节点态势：节点健康表、节点任务分布图、节点 Crash/漏洞分布图。

第三行当前节点详情：协议资产图、Fuzz 指标趋势、漏洞类型分布、最近风险事件。

第四行事件和操作流：最近任务、最近 Crash、最近 GDB 调试、最近报告、系统操作日志。

仪表盘前端只调用：

```http
GET /web-api/dashboard/overview
```

BFF 负责遍历 enabled nodes，并代理请求各节点摘要 API。

## 6. 资产中心

资产中心不替代仪表盘。它是某个节点内的协议项目空间。

每个协议工作目录：

```text
workspace/protocols/{protocol}/
  source/
  specs/
  vuldocs/raw/
  vuldocs/distilled/
  vuldocs/chunks/
  kb/
  seeds/text/
  seeds/bin/
  risk/analyses/
  risk/previews/
  risk/instrumented/
  jobs/
  debug/sessions/
  debug/poc/
  debug/reports/
  history/vulns/
  reports/
  build/
  binaries/
  dicts/
  build_logs/
  build_plans/
  build_runs/
  launch_profiles/
```

页面功能：当前节点选择、协议列表、协议资产图、Github-like 虚拟文件树、文件预览 text/json/hex、下载、上传源码压缩包、GitHub HTTPS URL clone、管理员删除整个协议项目。

禁止：单文件新增/删除/编辑；浏览服务器任意路径；展示服务器绝对路径；前端向文件 API 传真实路径。

## 7. 协议准备工作台

原“离线工作台”升级为“协议准备工作台”，但保留现有分析功能：协议上下文条、协议规范提取、VulDoc/KB、初始种子生成、风险路径分析、风险预览、风险上传、插桩处理、构建 Fuzz 目标。

现有字段继续兼容：`source_path/spec_path/analysis_path/output_path`。

新增安全引用字段：`source_ref/spec_ref/analysis_ref/output_ref`。

示例：

```text
workspace://modbus/source/
workspace://modbus/specs/spec.json
workspace://modbus/risk/analyses/risk.json
```

后端只在路由层把 `*_ref` 解析为真实路径，然后调用原核心服务。不得重写协议提取、种子生成、风险分析、插桩等核心逻辑。

## 8. 构建 Fuzz 目标

作为协议准备工作台的最后一个子功能：

```text
source/ → Build Probe → BuildPlan → BuildRun → TargetCandidate → LaunchProfile → JobCreate
```

构建命令策略：本地规则优先；可选 LLM 辅助补全构建命令；LLM 只输出 JSON BuildPlan，不能直接执行；`afl-fuzz` 启动参数必须本地规则预测，不调用 LLM；用户不能手动输入系统命令名；编译器/工具只能从后端配置 allowlist 选择。

支持构建系统：CMakeLists.txt、Makefile/GNUmakefile、configure/autotools、meson.build、compile_commands.json、build.sh（仅在明确开启 allow_shell_scripts 时允许）。

产物传递：BuildRun 产出 `binary_ref/dict_ref/compile_database_ref/target_id`；LaunchProfile 引用这些产物；JobCreate 正式执行只提交：

```json
{
  "protocol": "iec61850",
  "launch_profile_id": "launch-profile-abc123",
  "dry_run": false
}
```

## 9. Fuzz 任务

侧边栏只保留一个“Fuzz 任务”入口。页面内部 Tabs：创建任务、任务列表、实时监控、任务产物。

任务创建新增“应用构建产物 / 本地预测启动参数”卡片：选择协议、选择 BuildRun target、选择 seeds、选择 dict、生成 LaunchProfile、应用到 JobCreate 表单。

正式执行必须使用 `launch_profile_id`。`target_cmd/fuzzer_args` 只允许作为 dry-run 草案，不得在正式执行中直接使用。

## 10. 漏洞中心 / GDB / 产物中心 / 报告中心

漏洞中心由历史漏洞页升级：协议选择、漏洞总数、高置信度、Crash 关联数、GDB 关联数、CWE 分布、漏洞类型分布、漏洞记录表、证据详情。

GDB 调试保留独立页面。GDB 输出必须汇总到漏洞中心、产物中心、报告中心。

产物中心是跨协议证据搜索器，不是第二个文件管理器。展示节点、协议、scope、kind、name、virtual_path、workspace_ref、size、updated_at、预览/下载/跳转。

报告中心按协议生成 PDF，汇总协议资产、VulDoc/KB、风险分析、插桩结果、Fuzz 任务、Crash/Hang、GDB 调试、漏洞中心记录、产物索引。报告不得包含服务器绝对路径。

## 11. 设置页

设置页连接当前选中节点的后端配置。减少不必要输入框，true/false 使用 Switch，工具路径、LLM、高级配置分组折叠。管理员和普通用户都可修改后端配置。

分组建议：Web 控制面状态（只读）、当前节点基础配置、服务/CORS、control_plane（必要项）、LLM 配置、工具路径、构建助手、高级参数。

## 12. 严格禁止修改

- `src/styles/globals.css` 的主题 token 体系。
- 现有核心视觉风格。
- 现有分析服务核心逻辑。
- 任意开放文件系统 API。
- 任意 `shell=True`。
- 任意从前端请求体直接执行命令。

## 13. Codex 每阶段必须输出

```text
读取过的 Codex 文档列表
实际修改文件列表
新增/修改 API 列表
安全校验点
已运行验证命令
未验证项和原因
下一阶段建议
```
