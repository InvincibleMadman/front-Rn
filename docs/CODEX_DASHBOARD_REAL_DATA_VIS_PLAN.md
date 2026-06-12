# CODEX Dashboard Real Data Vis Plan

## 1. Read docs

- `front-Kr/docs/CODEX_AR_PRODUCT_SPEC.md`
- `front-Kr/docs/CODEX_AR_API_CONTRACT.md`
- `front-Kr/docs/CODEX_AR_SECURITY_MODEL.md`
- `front-Kr/docs/FIX_SUMMARY_2026-06-03.md`

## 2. Read front-Ar-6.1 references

- `front-Ar-6.1/src/features/dashboard/dashboard-view.tsx`
- `front-Ar-6.1/src/pages/console-page.tsx`
- `front-Ar-6.1/src/app/router.tsx`

## 3. Current dashboard card status

- Current `front-Kr` console page still imports the dashboard implementation from `src/features/dashboard/dashboard-view.tsx`.
- Current top metric area is still based on 8 cards.
- Current card structure is not yet aligned with the requested 7-card split:
  - running jobs
  - crash total
  - vulnerability total
  - node status
  - protocol assets
  - GDB sessions
  - reports
- Current BFF overview only partially aggregates dashboard data. It already contains global counts, node summaries, protocol counts, running jobs, crash counts, vulnerabilities, debug sessions, and reports, but it does not yet expose a page-friendly normalized dashboard metric object.
- Current frontend type `src/types/api/dashboard.ts` is still centered on `global / nodes / current_node / cross_node` rather than the required normalized metric structure.

## 4. New 7-card structure

- Hero row:
  - `运行中任务`
  - `Crash 总数`
  - `漏洞总数`
- Compact row:
  - `节点状态`
  - `协议资产数`
  - `GDB 会话数`
  - `报告数`

## 5. Real API fields per card

- `运行中任务`
  - BFF source:
    - `/api/v1/jobs/summary`
    - `/api/v1/jobs`
    - optional `/api/v1/jobs/{job_id}/metrics/history`
  - normalized fields:
    - `runningJobs.running`
    - `runningJobs.total`
    - `runningJobs.byStatus`
    - `runningJobs.recentJobs`
    - `runningJobs.trend`

- `Crash 总数`
  - BFF source:
    - `/api/v1/jobs/summary`
    - `/api/v1/jobs`
    - optional `/api/v1/jobs/{job_id}/artifacts`
    - optional `/api/v1/jobs/{job_id}/metrics/history`
  - normalized fields:
    - `crashFindings.crashes`
    - `crashFindings.hangs`
    - `crashFindings.totalFindings`
    - `crashFindings.byKind`
    - `crashFindings.recentFindings`
    - `crashFindings.trend`

- `漏洞总数`
  - BFF source:
    - `/api/v1/protocols`
    - `/api/v1/protocols/{protocol}/vulnerabilities/summary`
    - optional `/api/v1/protocols/{protocol}/vulnerabilities/records`
  - normalized fields:
    - `vulnerabilities.total`
    - `vulnerabilities.highConfidence`
    - `vulnerabilities.byCoarseType`
    - `vulnerabilities.byCwe`
    - `vulnerabilities.recentRecords`

- `节点状态`
  - BFF source:
    - per-node `/api/v1/system/info`
    - BFF node registry in `server.mjs`
  - normalized fields:
    - `nodeStatus.total`
    - `nodeStatus.online`
    - `nodeStatus.offline`
    - `nodeStatus.checking`
    - `nodeStatus.onlineRate`
    - `nodeStatus.onlinePercent`

- `协议资产数`
  - BFF source:
    - `/api/v1/assets/overview-graph`
    - `/api/v1/assets`
    - `/api/v1/protocols`
  - normalized fields:
    - `protocolAssets.total`
    - `protocolAssets.protocolCount`
    - `protocolAssets.byScope`
    - `protocolAssets.byKind`

- `GDB 会话数`
  - BFF source:
    - `/api/v1/protocols`
    - `/api/v1/protocols/{protocol}/debug/summary`
  - normalized fields:
    - `debugSessions.total`
    - `debugSessions.byStatus`
    - `debugSessions.byCoarseType`

- `报告数`
  - BFF source:
    - `/api/v1/protocols`
    - `/api/v1/protocols/{protocol}/reports/summary`
  - normalized fields:
    - `reports.total`
    - `reports.byKind`
    - `reports.recentReports`

## 6. Right-side chart structure per card

- `运行中任务`
  - priority 1: real trend sparkline / mini area chart from `runningJobs.trend`
  - priority 2: segmented status bar from `runningJobs.byStatus`
  - fallback: `No trend`

- `Crash 总数`
  - priority 1: discovery mini bars from `crashFindings.trend`
  - priority 2: crash/hang segmented bar from `crashFindings.byKind`
  - fallback: `No findings`

- `漏洞总数`
  - priority 1: coarse type mini stacked bars from `vulnerabilities.byCoarseType`
  - priority 2: CWE top mini bars from `vulnerabilities.byCwe`
  - priority 3: high-confidence ratio ring from `highConfidence / total`
  - fallback: `No records`

- `节点状态`
  - forced percent donut
  - center text must show `onlinePercent`

- `协议资产数`
  - priority 1: scope mini donut from `protocolAssets.byScope`
  - priority 2: kind mini bars from `protocolAssets.byKind`
  - priority 3: compact protocol count ring
  - fallback: `No assets`

- `GDB 会话数`
  - priority 1: status donut / segmented bar from `debugSessions.byStatus`
  - priority 2: coarse type mini bars from `debugSessions.byCoarseType`
  - priority 3: compact count ring
  - fallback: `No sessions`

- `报告数`
  - priority 1: kind mini bars from `reports.byKind`
  - priority 2: recent activity tiny bars from `reports.recentReports`
  - priority 3: compact count ring
  - fallback: `No reports`

## 7. Graphs that may not be fully implementable

- `运行中任务` trend:
  - if metrics history is not available for running jobs, trend can only degrade to status segmentation or empty state.
- `Crash 总数` discovery trend:
  - if job artifact timestamps are unavailable or expensive to fetch for all jobs, trend may need to derive from metrics history or degrade to crash/hang distribution.
- `报告数` recent activity:
  - only possible if `recentReports` contains real timestamp-like fields.
- `GDB 会话数` classified breakdown:
  - depends on whether `byCoarseType` is really returned by debug summary.

## 8. Allowed files to modify

- `front-Kr/src/features/dashboard/**`
- `front-Kr/src/pages/console-page.tsx`
- `front-Kr/src/lib/api/**`
- `front-Kr/src/types/**`
- `front-Kr/server/server.mjs`
- `front-Kr/docs/*.md`

## 9. Forbidden files to modify

- `front-Kr/src/styles/globals.css`
- `front-Kr/src/components/ui/**`
- `front-Kr/src/components/charts/**`
- `front-Kr/src/components/common/summary-card.tsx`
- `front-Kr/src/components/common/json-viewer.tsx`
- `front-Kr/src/components/common/operation-log-panel.tsx`
- all files under `fuzz-server-Kr`
- all backend Python code

## 10. Whether BFF `server.mjs` needs changes

- Yes.
- The change is limited to `front-Kr/server/server.mjs`, which is the frontend Web BFF aggregation layer, not the backend Python service.
- The purpose is:
  - preserve existing overview fields
  - add normalized dashboard-oriented metric fields
  - aggregate available real data from existing node APIs
  - degrade per-node and per-protocol failures to zero or empty collections

## 11. Dashboard folder placement

- Do not move the implementation into `src/features/console/**`.
- Keep the main page implementation in `src/features/dashboard/dashboard-view.tsx`.
- If page-local helpers are needed, add them under `src/features/dashboard/**`.
