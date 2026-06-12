# front-Xe 资产中心后端 API 对照

说明：

- 后端实际来源于 `fuzz-server-Xe/fuzz_core/api/routers/assets.py`。
- 前端现有调用位置主要在 `front-Xe/src/lib/api/services/assets.ts` 和 `front-Xe/src/features/assets/assets-view.tsx`。
- 浏览器侧必须通过 `/node-api/{selectedNodeId}/api/v1/...` 代理访问。

## 已接入或已存在的资产 API

### `GET /api/v1/assets/overview-graph`

- 请求：无查询参数。
- 返回字段：`nodes[]`、`edges[]`、`protocol_count`。
- 节点字段：`id`、`name`、`category`。
- 前端使用位置：`front-Xe/src/features/assets/assets-view.tsx` 的 `overviewQuery`，经 `assetsApi.getOverviewGraph()` 调用。
- 代理：是，走 `/node-api/{selectedNodeId}/api/v1/assets/overview-graph`。
- 备注：当前后端返回的是协议节点图，`edges` 为空。

### `GET /api/v1/assets`

- 请求：`keyword`、`scope`、`kind`、`protocol`。
- 返回字段：`items[]`。
- 项字段：`protocol`、`scope`、`kind`、`name`、`virtual_path`、`size`、`updated_at`、`workspace_ref`、`type`。
- 前端使用位置：`front-Xe/src/lib/api/services/assets.ts` 的 `listAssets()`，当前页面未直接调用。
- 代理：是，走 `/node-api/{selectedNodeId}/api/v1/assets`。

### `GET /api/v1/protocols/{protocol}/assets`

- 请求：路径参数 `protocol`。
- 返回字段：`protocol`、`items[]`。
- 项字段：实际是 `ProtocolAssetSummary`，即 `protocol`、`source_ref`、`files_count`、`ready`。
- 前端使用位置：`front-Xe/src/lib/api/services/assets.ts` 的 `getProtocolAssets()`，当前页面未直接调用。
- 代理：是，走 `/node-api/{selectedNodeId}/api/v1/protocols/{protocol}/assets`。

### `GET /api/v1/protocols/{protocol}/assets/summary`

- 请求：路径参数 `protocol`。
- 返回字段：`protocol`、`source_ref`、`files_count`、`ready`。
- 前端使用位置：`front-Xe/src/features/assets/assets-view.tsx` 的 `summaryQuery`，经 `assetsApi.getProtocolAssetsSummary()` 调用。
- 代理：是，走 `/node-api/{selectedNodeId}/api/v1/protocols/{protocol}/assets/summary`。

### `GET /api/v1/protocols/{protocol}/assets/mindmap`

- 请求：路径参数 `protocol`。
- 返回字段：`protocol`、`nodes[]`、`edges[]`、`counts`、`statuses`、`recent_items`。
- 节点字段：`id`、`name`、`scope`、`kind`、`status`、`count`、`workspace_ref`。
- 前端使用位置：当前 `AssetsView` 和 `assets.ts` 里都未接入。
- 代理：是，未来接入也必须走 `/node-api/{selectedNodeId}/api/v1/protocols/{protocol}/assets/mindmap`。

### `GET /api/v1/protocols/{protocol}/workspace/tree`

- 请求：路径参数 `protocol`；查询参数 `scope`、`path`。
- 返回字段：`protocol`、`scope`、`path`、`items[]`。
- 项字段：`name`、`type`、`virtual_path`、`size`、`updated_at`、`previewable`、`downloadable`、`depth`、`extension`、`workspace_ref`。
- 前端使用位置：`front-Xe/src/features/assets/assets-view.tsx` 的 `treeQuery`，经 `assetsApi.getWorkspaceTree()` 调用。
- 代理：是，走 `/node-api/{selectedNodeId}/api/v1/protocols/{protocol}/workspace/tree`。

### `GET /api/v1/protocols/{protocol}/workspace/index`

- 请求：路径参数 `protocol`；查询参数 `scopes`、`max_depth`、`limit`、`cursor`、`include_dirs`、`include_counts`。
- 返回字段：`protocol`、`items[]`、`next_cursor`、`counts_by_scope`、`truncated`、`scanned_count`、`limited_by_max_depth`、`limited_by_max_items`。
- 项字段：沿用树节点字段，并带 `workspace_ref`、`extension`、`previewable`、`downloadable` 等索引信息。
- 前端使用位置：当前未接入前端 service / 页面。
- 代理：是，未来接入必须走 `/node-api/{selectedNodeId}/api/v1/protocols/{protocol}/workspace/index`。

### `GET /api/v1/protocols/{protocol}/workspace/search`

- 请求：路径参数 `protocol`；查询参数 `q`、`scopes`、`ext`、`type`、`path`、`content`、`limit`、`cursor`。
- 返回字段：`protocol`、`items[]`、`next_cursor`、`truncated`、`scanned_count`、`content_limited`、`limited_by_max_depth`、`limited_by_max_items`。
- 项字段：`item`、`score`、`reason`、可选 `snippets`。
- `item` 字段：与 workspace index item 结构一致。
- 前端使用位置：当前未接入前端 service / 页面。
- 代理：是，未来接入必须走 `/node-api/{selectedNodeId}/api/v1/protocols/{protocol}/workspace/search`。

### `GET /api/v1/protocols/{protocol}/workspace/preview`

- 请求：路径参数 `protocol`；查询参数 `scope`、`path`。
- 返回字段：`preview_type`、`truncated`、`content` 或 `hex`/`ascii`、`size`。
- 前端使用位置：`front-Xe/src/features/assets/assets-view.tsx` 的 `previewQuery`，经 `assetsApi.getWorkspacePreview()` 调用。
- 代理：是，走 `/node-api/{selectedNodeId}/api/v1/protocols/{protocol}/workspace/preview`。

### `GET /api/v1/protocols/{protocol}/workspace/download`

- 请求：路径参数 `protocol`；查询参数 `scope`、`path`。
- 返回字段：文件二进制流，响应头由 `FileResponse` 处理。
- 前端使用位置：`front-Xe/src/features/assets/assets-view.tsx` 的下载链接，经 `assetsApi.getWorkspaceDownloadUrl()` 生成。
- 代理：是，走 `/node-api/{selectedNodeId}/api/v1/protocols/{protocol}/workspace/download`。

### `DELETE /api/v1/protocols/{protocol}`

- 请求：路径参数 `protocol`。
- 返回字段：`protocol`、`deleted`。
- 前端使用位置：`front-Xe/src/features/assets/assets-view.tsx` 的 `deleteMutation`，经 `assetsApi.deleteProtocol()` 调用。
- 代理：是，走 `/node-api/{selectedNodeId}/api/v1/protocols/{protocol}`。

### `POST /api/v1/protocols/{protocol}/source/upload-archive`

- 请求：路径参数 `protocol`；`multipart/form-data`，字段 `file`、`replace_existing`。
- 返回字段：`ProtocolAssetSummary`，即 `protocol`、`source_ref`、`files_count`、`ready`。
- 前端使用位置：`front-Xe/src/features/assets/assets-view.tsx` 的 `uploadMutation`，经 `assetsApi.uploadArchive()` 调用。
- 代理：是，走 `/node-api/{selectedNodeId}/api/v1/protocols/{protocol}/source/upload-archive`。

### `POST /api/v1/protocols/{protocol}/source/import-git`

- 请求：路径参数 `protocol`；JSON body，字段 `repo_url`、`branch`、`replace_existing`。
- 返回字段：`ProtocolAssetSummary`，即 `protocol`、`source_ref`、`files_count`、`ready`。
- 前端使用位置：`front-Xe/src/features/assets/assets-view.tsx` 的 `importMutation`，经 `assetsApi.importGit()` 调用。
- 代理：是，走 `/node-api/{selectedNodeId}/api/v1/protocols/{protocol}/source/import-git`。

### `GET /api/v1/protocols/{protocol}/source/status`

- 请求：路径参数 `protocol`。
- 返回字段：`protocol`、`source_ref`、`files_count`、`ready`。
- 前端使用位置：`front-Xe/src/lib/api/services/assets.ts` 的 `getSourceStatus()`，当前页面未直接调用。
- 代理：是，走 `/node-api/{selectedNodeId}/api/v1/protocols/{protocol}/source/status`。

## 结论

- 资产中心当前页面实际只直接用到 `overview-graph`、`protocol/assets/summary`、`workspace/tree`、`workspace/preview`、`workspace/download`、`source/upload-archive`、`source/import-git`、`DELETE /protocols/{protocol}`。
- `assets`、`protocol/assets`、`assets/mindmap`、`workspace/index`、`workspace/search`、`source/status` 已在后端存在，但前端页面尚未全面接入。
- 所有浏览器请求都必须通过 Web BFF 节点代理，不允许直连 `/api/v1/...`。

