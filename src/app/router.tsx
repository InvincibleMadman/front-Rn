import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, createBrowserRouter } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import { ProtectedRoute } from "@/components/common/protected-route";

/* ── Lazy pages ── */
const HomePage = lazy(() => import("@/pages/home-page").then((m) => ({ default: m.HomePage })));
const LoginPage = lazy(() => import("@/pages/login-page").then((m) => ({ default: m.LoginPage })));
const AssetsPage = lazy(() => import("@/pages/assets-page").then((m) => ({ default: m.AssetsPage })));
const ArtifactsPage = lazy(() => import("@/pages/artifacts-page").then((m) => ({ default: m.ArtifactsPage })));
const DashboardPage = lazy(() => import("@/pages/dashboard-page").then((m) => ({ default: m.DashboardPage })));
const OfflineStudioPage = lazy(() => import("@/pages/offline-studio-page").then((m) => ({ default: m.OfflineStudioPage })));
const JobsPage = lazy(() => import("@/pages/jobs-page").then((m) => ({ default: m.JobsPage })));
const JobDetailPage = lazy(() => import("@/pages/job-detail-page").then((m) => ({ default: m.JobDetailPage })));
const SettingsPage = lazy(() => import("@/pages/settings-page").then((m) => ({ default: m.SettingsPage })));
const DebugPage = lazy(() => import("@/pages/debug-page").then((m) => ({ default: m.DebugPage })));
const ReportsPage = lazy(() => import("@/pages/reports-page").then((m) => ({ default: m.ReportsPage })));
const VulnHistoryPage = lazy(() => import("@/pages/vuln-history-page").then((m) => ({ default: m.VulnHistoryPage })));
const NodesPage = lazy(() => import("@/pages/nodes-page").then((m) => ({ default: m.NodesPage })));

function PageSuspense({ children }: { children: ReactNode }): JSX.Element {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-12">
          <div className="text-sm text-[hsl(var(--text-tertiary))]">加载中...</div>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

export const router = createBrowserRouter([
  /* ── 首页：独立全屏，无 AppShell ── */
  {
    path: "/",
    element: (
      <PageSuspense>
        <HomePage />
      </PageSuspense>
    ),
  },
  {
    path: "/login",
    element: (
      <PageSuspense>
        <LoginPage />
      </PageSuspense>
    ),
  },

  /* ── 应用内页：带 AppShell ── */
  {
    path: "/",
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: "dashboard", element: <PageSuspense><DashboardPage /></PageSuspense> },
          { path: "console", element: <Navigate to="/dashboard" replace /> },
          { path: "assets", element: <PageSuspense><AssetsPage /></PageSuspense> },
          { path: "offline", element: <PageSuspense><OfflineStudioPage /></PageSuspense> },
          { path: "jobs", element: <PageSuspense><JobsPage /></PageSuspense> },
          { path: "jobs/:jobId", element: <PageSuspense><JobDetailPage /></PageSuspense> },
          { path: "vulns/history", element: <PageSuspense><VulnHistoryPage /></PageSuspense> },
          { path: "debug", element: <PageSuspense><DebugPage /></PageSuspense> },
          { path: "artifacts", element: <PageSuspense><ArtifactsPage /></PageSuspense> },
          { path: "reports", element: <PageSuspense><ReportsPage /></PageSuspense> },
          { path: "nodes", element: <PageSuspense><NodesPage /></PageSuspense> },
          { path: "settings", element: <PageSuspense><SettingsPage /></PageSuspense> },
        ],
      },
    ],
  },
]);
