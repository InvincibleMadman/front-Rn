# CODEX Page Logic Fix Summary

## Read docs

- `front-Kr/docs/CODEX_AR_PRODUCT_SPEC.md`
- `front-Kr/docs/CODEX_AR_API_CONTRACT.md`
- `front-Kr/docs/CODEX_AR_SECURITY_MODEL.md`
- `front-Kr/docs/CODEX_AR_SNIPPETS_FRONTEND.md`
- `front-Kr/docs/CODEX_AR_SNIPPETS_BFF.md`
- `front-Kr/docs/redesign-plan.md`
- `front-Kr/docs/design-map.md`
- `front-Kr/docs/design-reference-map.md`
- `front-Kr/docs/FIX_SUMMARY_2026-06-03.md`
- `fuzz-server-Kr/docs/CODEX_AR_BACKEND_DELTA.md`
- `fuzz-server-Kr/docs/CODEX_AR_SECURITY_MODEL.md`
- `fuzz-server-Kr/docs/CODEX_AR_SNIPPETS_BACKEND.md`
- `fuzz-server-Kr/docs/FIX_SUMMARY_2026-06-03.md`

## Read old frontend references

- `front-Ar-6.1/src/features/dashboard/dashboard-view.tsx`
- `front-Ar-6.1/docs/design-map.md`
- `front-Ar-6.1/docs/design-reference-map.md`

## Modified files

- `front-Kr/src/app/router.tsx`
- `front-Kr/src/pages/artifacts-page.tsx`
- `front-Kr/src/components/layout/sidebar.tsx`
- `front-Kr/src/components/layout/topbar.tsx`
- `front-Kr/src/features/assets/assets-view.tsx`
- `front-Kr/src/features/artifacts/artifacts-view.tsx`
- `front-Kr/src/features/dashboard/dashboard-view.tsx`
- `front-Kr/src/features/offline/offline-studio-view.tsx`
- `front-Kr/server/logger.mjs`
- `front-Kr/server/server.mjs`
- `front-Kr/docs/CODEX_PAGE_LOGIC_FIX_SUMMARY.md`

## Added routes

- `/artifacts`

## Added or changed API usage

- Dashboard page now consumes `/web-api/dashboard/overview`
- Artifact center reuses `assetsApi.listAssets()`
- Artifact preview reuses `assetsApi.getWorkspacePreview()`
- Artifact download reuses `assetsApi.getWorkspaceDownloadUrl()`
- Asset center keeps existing workspace tree / preview / upload / git import / delete protocol APIs
- BFF dashboard overview now additionally attempts:
  - `/api/v1/protocols/{protocol}/vulnerabilities/summary`
  - `/api/v1/protocols/{protocol}/debug/summary`
  - `/api/v1/protocols/{protocol}/reports/summary`

## Final responsibility split

- Asset Center:
  - protocol asset overview graph
  - source archive upload
  - git import
  - virtual file tree
  - workspace preview
  - safe download
  - protocol project delete
  - lightweight asset index
- Artifact Center:
  - cross-protocol artifact search
  - artifact list
  - preview
  - download
  - jump entry
  - workspace_ref / scope / kind / virtual_path display

## Dashboard card fix

- Replaced uniform summary presentation with eight colored gradient metric cards at page level.
- Preserved current project Card/Icon system.
- Did not modify `SummaryCard` base component.
- Added the required eight metrics:
  - node count
  - online nodes
  - protocol assets
  - running jobs
  - crash count
  - vulnerability count
  - GDB session count
  - report count

## Topbar node status fix

- Kept node-based query logic using backend system info.
- Normalized visible labels to:
  - `节点检测中`
  - `节点在线`
  - `节点离线`
- Did not revert to `/healthz`.

## Page error handling

- Removed inline raw mutation error alerts from asset center.
- Added page-level timed toast reporting through existing `GlobalErrorCenter`.
- Added page-level English log entries through existing Dock log.
- Component areas now degrade to empty state text instead of raw error text or raw objects.

## Page log entry additions

- Asset center:
  - `Source archive upload started`
  - `Source archive upload finished`
  - `Git import started`
  - `Git import finished`
  - `Workspace tree refreshed`
  - `Workspace file preview loaded`
  - `Workspace file download requested`
  - `Protocol project delete requested`
  - `Protocol project deleted`
  - `Asset operation failed`
- Artifact center:
  - `Artifact filter changed`
  - `Artifact preview loaded`
  - `Artifact download requested`
  - `Artifact jump requested`
  - `Artifact operation failed`
- Offline studio operation labels normalized to English stage prefixes.

## BFF console logging

- Added `front-Kr/server/logger.mjs`
- Replaced noisy raw-object warning output with Vite-like structured lines
- English-only log text
- Redacted sensitive values
- Supports `NO_COLOR=1`
- Disables color automatically when stdout is not TTY
- Wraps long lines with aligned continuation indentation

## Backend modification status

- Backend was not modified. Existing backend APIs were sufficient for this page-logic fix.

## Security checks

- Kept Browser -> Web BFF -> FastAPI Backend Node architecture
- No browser direct calls to backend base URLs
- No real server path exposure added
- Continued using `workspace_ref` / virtual paths for preview and download
- BFF logs redact secret-like fields and avoid raw request/response dumps

## Validation commands

- `cd front-Kr`
- `node --check server/server.mjs`
- `if (Test-Path server/logger.mjs) { node --check server/logger.mjs }`
- `if (Test-Path server/dev.mjs) { node --check server/dev.mjs }`
- `npm run build`

## Unverified items

- Runtime browser interaction was not manually exercised in this summary document.
- Any failure details from local build or syntax validation depend on command results below.
