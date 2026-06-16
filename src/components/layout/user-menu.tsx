import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, UserCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { authApi } from "@/lib/api/services/auth";
import { cn } from "@/lib/utils/cn";
import { useAuthStore } from "@/stores/auth-store";

function getUserInitial(username?: string): string {
  const value = username?.trim();
  return value ? value.charAt(0).toUpperCase() : "U";
}

function getRoleLabel(role?: "admin" | "user"): string {
  return role === "admin" ? "管理员" : "普通用户";
}

export function UserMenu(): JSX.Element | null {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const setCsrfToken = useAuthStore((state) => state.setCsrfToken);
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);

  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target;
      if (target instanceof Node && rootRef.current && !rootRef.current.contains(target)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!user) return null;

  const handleAccountClick = (): void => {
    setOpen(false);
    navigate("/settings?tab=account");
  };

  const handleLogoutClick = async (): Promise<void> => {
    if (logoutPending) return;

    setLogoutPending(true);

    try {
      await authApi.logout();
    } finally {
      setUser(null);
      setCsrfToken("");
      setOpen(false);
      setLogoutPending(false);
      navigate("/login", { replace: true });
    }
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        className={cn(
          "flex h-11 items-center gap-3 rounded-full border border-border/70 bg-background px-2.5 pr-3 text-left shadow-console transition-colors",
          "hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring",
        )}
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={`${user.username} · ${getRoleLabel(user.role)}`}
      >
        <span className="flex size-8 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-sm font-semibold text-primary">
          {getUserInitial(user.username)}
        </span>
        <span className="hidden min-w-0 sm:flex sm:flex-col">
          <span className="max-w-[9rem] truncate text-sm font-medium text-foreground">{user.username}</span>
          <span className="text-[11px] text-muted-foreground">{getRoleLabel(user.role)}</span>
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="用户菜单"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-[90] w-[min(15rem,calc(100vw-2rem))] rounded-[var(--radius-xl)] border border-border bg-popover p-2 shadow-console"
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-secondary"
            onClick={handleAccountClick}
          >
            <UserCircle2 className="size-4 text-primary" />
            <span>用户中心</span>
          </button>

          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-70"
            onClick={() => {
              void handleLogoutClick();
            }}
            disabled={logoutPending}
          >
            <LogOut className="size-4 text-primary" />
            <span>{logoutPending ? "退出中..." : "退出登录"}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
