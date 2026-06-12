import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Dock } from "@/components/layout/dock";
import { useUiStore } from "@/stores/ui-store";

export function AppShell(): JSX.Element {
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed);

  return (
    <div className="relative flex h-screen overflow-hidden bg-transparent">
      <Sidebar />
      <div
        className="relative flex min-w-0 flex-1 flex-col overflow-hidden"
        style={{
          marginLeft: sidebarCollapsed ? "var(--sidebar-w-collapsed)" : "var(--sidebar-w)",
          transition: "margin-left 220ms ease",
        }}
      >
        <Topbar />
        <main
          className="console-scrollbar relative min-h-0 flex-1 overflow-y-auto"
          style={{
            paddingTop: "var(--topbar-h)",
            paddingBottom: "var(--dock-h)",
          }}
        >
          <div
            className="mx-auto w-full"
            style={{
              maxWidth: "var(--content-max)",
              paddingInline: "var(--page-gutter)",
              paddingTop: "calc(var(--page-gutter) * 1.05)",
              paddingBottom: "calc(var(--page-gutter) * 1.15)",
            }}
          >
            <Outlet />
          </div>
        </main>
        <Dock />
      </div>
    </div>
  );
}
