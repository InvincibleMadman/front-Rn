import type { CSSProperties, JSX } from "react";
import { useMemo } from "react";
import { useLocation } from "react-router-dom";

interface PageBackgroundSpec {
  key: string;
  src: string;
  size: string;
  position: string;
  strength: number;
  matches: (pathname: string) => boolean;
}

const PAGE_BACKGROUND_SPECS: PageBackgroundSpec[] = [
  {
    key: "dashboard",
    src: "/page-backgrounds/dashboard-background.svg",
    size: "72rem auto",
    position: "100% 100%",
    strength: 0.92,
    matches: (pathname) => pathname === "/dashboard" || pathname === "/console",
  },
  {
    key: "offline",
    src: "/page-backgrounds/protocol-studio-background.svg",
    size: "112.5rem auto",
    position: "100% 0%",
    strength: 1.02,
    matches: (pathname) => pathname.startsWith("/offline"),
  },
  {
    key: "jobs",
    src: "/page-backgrounds/fuzz-jobs-background.svg",
    size: "120rem auto",
    position: "calc(100% + 14rem) -6rem",
    strength: 0.98,
    matches: (pathname) => pathname.startsWith("/jobs"),
  },
  {
    key: "vulns",
    src: "/page-backgrounds/vulnerability-center-background.svg",
    size: "100% auto",
    position: "50% 100%",
    strength: 0.84,
    matches: (pathname) => pathname.startsWith("/vulns"),
  },
  {
    key: "debug",
    src: "/page-backgrounds/gdb-debug-background.svg",
    size: "100rem auto",
    position: "calc(100% + 4rem) -4rem",
    strength: 1.04,
    matches: (pathname) => pathname.startsWith("/debug"),
  },
  {
    key: "artifacts",
    src: "/page-backgrounds/artifact-center-background.svg",
    size: "137.5rem auto",
    position: "calc(100% + 12rem) calc(50% - 4rem)",
    strength: 0.94,
    matches: (pathname) => pathname.startsWith("/artifacts"),
  },
  {
    key: "reports",
    src: "/page-backgrounds/report-center-background.svg",
    size: "100% auto",
    position: "50% 100%",
    strength: 1.04,
    matches: (pathname) => pathname.startsWith("/reports"),
  },
  {
    key: "nodes",
    src: "/page-backgrounds/node-management-background.svg",
    size: "120rem auto",
    position: "0% 0%",
    strength: 1,
    matches: (pathname) => pathname.startsWith("/nodes"),
  },
  {
    key: "assets",
    src: "/page-backgrounds/asset-center-background.svg",
    size: "auto 100%",
    position: "100% 100%",
    strength: 0.96,
    matches: (pathname) => pathname.startsWith("/assets"),
  },
  {
    key: "settings",
    src: "/page-backgrounds/system-settings-background.svg",
    size: "auto 100%",
    position: "100% 100%",
    strength: 0.98,
    matches: (pathname) => pathname.startsWith("/settings"),
  },
];

export function AppShellPageBackground(): JSX.Element {
  const { pathname } = useLocation();

  const activeKey = useMemo(
    () => PAGE_BACKGROUND_SPECS.find((item) => item.matches(pathname))?.key ?? null,
    [pathname],
  );

  return (
    <div aria-hidden className="app-page-bg-shell">
      {PAGE_BACKGROUND_SPECS.map((item) => {
        const style = {
          "--page-ornament-light-low": (0.075 * item.strength).toFixed(3),
          "--page-ornament-light-high": (0.12 * item.strength).toFixed(3),
          "--page-ornament-dark-low": (0.2 * item.strength).toFixed(3),
          "--page-ornament-dark-high": (0.42 * item.strength).toFixed(3),
          WebkitMaskImage: `url(${item.src})`,
          maskImage: `url(${item.src})`,
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskPosition: item.position,
          maskPosition: item.position,
          WebkitMaskSize: item.size,
          maskSize: item.size,
        } as CSSProperties;

        return (
          <div
            key={item.key}
            className="app-page-bg-layer"
            data-active={activeKey === item.key}
            style={style}
          />
        );
      })}
    </div>
  );
}
