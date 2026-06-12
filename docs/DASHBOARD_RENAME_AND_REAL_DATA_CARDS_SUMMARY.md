# Dashboard rename and real-data metric cards summary

## Scope

This update only changes the frontend project. The backend Python project was not modified.

## Dashboard naming cleanup

- Removed the old `src/pages/console-page.tsx` dependency path.
- The main dashboard page is now loaded from `src/pages/dashboard-page.tsx`.
- The primary dashboard route is `/dashboard`.
- The old `/console` route is retained only as a compatibility redirect to `/dashboard`.
- Sidebar and home/login navigation now point to `/dashboard`.

## Dashboard metric redesign

The top metric area was changed from ordinary summary cards into seven real-data-driven visualization cards:

### Hero cards

1. **运行中任务**
   - Data: `metrics.runningJobs.running`, `metrics.runningJobs.byStatus`, `metrics.runningJobs.trend`.
   - Visualization: sparkline/mini area chart when trend data exists, otherwise status segmented bar.

2. **Crash 总数**
   - Data: `metrics.crashFindings.crashes`, `metrics.crashFindings.hangs`, `metrics.crashFindings.trend`, `metrics.crashFindings.byKind`.
   - Visualization: discovery bars when trend data exists, otherwise Crash/Hang segmented bar.
   - Semantics: Crash means fuzzing findings, not system errors or platform alarms.

3. **漏洞总数**
   - Data: `metrics.vulnerabilities.total`, `metrics.vulnerabilities.highConfidence`, `metrics.vulnerabilities.byCoarseType`, `metrics.vulnerabilities.byCwe`.
   - Visualization: coarse type/CWE mini bars, or high-confidence ratio ring when only totals exist.

### Compact cards

4. **节点状态**
   - Combines the old node total and online node cards.
   - Data: `metrics.nodeStatus.total`, `metrics.nodeStatus.online`, `metrics.nodeStatus.offline`, `metrics.nodeStatus.onlinePercent`.
   - Visualization: donut/ring chart with the online percentage shown at the center.

5. **协议资产数**
   - Data: `metrics.protocolAssets.protocolCount`, `metrics.protocolAssets.total`, `metrics.protocolAssets.byScope`, `metrics.protocolAssets.byKind`.
   - Visualization: scope donut or kind mini bars.

6. **GDB 会话数**
   - Data: `metrics.debugSessions.total`, `metrics.debugSessions.byStatus`, `metrics.debugSessions.byCoarseType`.
   - Visualization: status segmented bar or classified type mini bars.

7. **报告数**
   - Data: `metrics.reports.total`, `metrics.reports.byKind`, `metrics.reports.recentReports`.
   - Visualization: recent activity bars or report kind mini bars.

## API/data usage

The cards consume the existing `/web-api/dashboard/overview` BFF endpoint and the normalized `DashboardMetricOverview` structure from `src/lib/api/services/dashboard.ts` and `src/types/api/dashboard.ts`. No browser-to-backend direct calls were added.

## BFF/logging status

The uploaded frontend already included BFF logging fixes. The package keeps:

- `Fastify({ logger: false })` to prevent raw Pino JSON logs.
- `server/logger.mjs` for sanitized Vite-like logs.
- `server/dev.mjs` to launch BFF and Vite without `concurrently`/npm child scripts.

## Validation

Executed successfully:

```bash
node --check server/logger.mjs
node --check server/dev.mjs
node --check server/server.mjs
npx tsc -b
```

`npm run build` could not complete in the Linux sandbox because the uploaded `node_modules` is Windows/incomplete for Rollup optional native dependency `@rollup/rollup-linux-x64-gnu`. This is an environment/dependency issue, not a TypeScript error. On Windows, run:

```powershell
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json
npm install
npm run build
```
