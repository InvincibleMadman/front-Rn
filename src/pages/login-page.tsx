import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Home, MoonStar, ShieldCheck, SunMedium } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/common/form-field";
import { ApiErrorReporter } from "@/components/common/api-error-alert";
import { authApi } from "@/lib/api/services/auth";
import { cn } from "@/lib/utils/cn";
import { useUiStore } from "@/stores/ui-store";

function sanitizeNextPath(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  if (value === "/login" || value.startsWith("/login?")) return null;
  return value;
}

function getLoginInitial(username: string): string {
  const value = username.trim();
  return value ? value.charAt(0).toUpperCase() : "U";
}

export function LoginPage(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useUiStore((state) => state.theme);
  const toggleTheme = useUiStore((state) => state.toggleTheme);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const nextFromQuery = sanitizeNextPath(new URLSearchParams(location.search).get("next"));
  const nextFromState = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? null;
  const from = nextFromQuery ?? nextFromState ?? "/dashboard";

  const loginMutation = useMutation({
    mutationFn: () => authApi.login(username, password),
    onSuccess: () => navigate(from, { replace: true }),
  });

  const avatarInitial = useMemo(() => getLoginInitial(username), [username]);
  const topControlSizeClass = "h-[clamp(3.02rem,5vh,3.28rem)]";
  const topControlWidthClass = "w-[clamp(3.02rem,5vh,3.28rem)]";
  const topCircleButtonClass = cn(
    "rounded-full border-border/70 bg-background/60 shadow-console backdrop-blur-xl",
    topControlSizeClass,
    topControlWidthClass,
  );
  const topThemeIconClass = "size-[1.5rem]";
  const topHomeIconClass = "size-[1.5rem]";
  const topBrandPillClass = `inline-flex ${topControlSizeClass} items-center gap-[0.66rem] rounded-full border border-border/70 bg-background/60 px-[0.86rem] shadow-console backdrop-blur-xl`;

  const pageBackgroundImage = useMemo(
    () =>
      (
        theme === "dark"
          ? [
              "radial-gradient(circle at 18% 16%, hsl(var(--accent-blue) / 0.26), transparent 24%)",
              "radial-gradient(circle at 84% 18%, hsl(258 84% 72% / 0.2), transparent 22%)",
              "radial-gradient(circle at 68% 82%, hsl(var(--accent-orange) / 0.16), transparent 24%)",
              "linear-gradient(135deg, hsl(var(--bg-primary)) 0%, hsl(var(--bg-primary-alt)) 54%, hsl(var(--bg-surface)) 100%)",
            ]
          : [
              "radial-gradient(circle at 16% 14%, hsl(var(--accent-blue) / 0.18), transparent 24%)",
              "radial-gradient(circle at 82% 18%, hsl(258 78% 66% / 0.15), transparent 21%)",
              "radial-gradient(circle at 66% 82%, hsl(var(--accent-orange) / 0.16), transparent 22%)",
              "linear-gradient(135deg, hsl(var(--bg-primary)) 0%, hsl(var(--bg-primary-alt)) 56%, hsl(var(--bg-surface)) 100%)",
            ]
      ).join(", "),
    [theme],
  );

  const maskedPatternGradient = useMemo(
    () =>
      theme === "dark"
        ? "linear-gradient(125deg, hsl(var(--accent-blue) / 0.98) 6%, hsl(259 86% 72% / 0.74) 46%, hsl(var(--accent-orange) / 0.58) 100%)"
        : "linear-gradient(125deg, hsl(var(--accent-blue) / 0.84) 8%, hsl(258 80% 66% / 0.6) 48%, hsl(var(--accent-orange) / 0.7) 96%)",
    [theme],
  );

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-background text-foreground"
      style={{ backgroundImage: pageBackgroundImage }}
    >
      <ApiErrorReporter error={loginMutation.error} title="登录失败" source="auth" />

      <div
        className="pointer-events-none absolute inset-0 opacity-55"
        style={{
          backgroundImage: [
            "linear-gradient(hsl(var(--border) / 0.18) 0.0625rem, transparent 0.0625rem)",
            "linear-gradient(90deg, hsl(var(--border) / 0.18) 0.0625rem, transparent 0.0625rem)",
          ].join(", "),
          backgroundSize: "3.25rem 3.25rem",
          maskImage: "linear-gradient(180deg, rgba(0,0,0,0.9), rgba(0,0,0,0.3))",
        }}
      />

      <div
        className="pointer-events-none absolute inset-y-0 left-0 hidden w-[58%] lg:block"
        style={{
          background: maskedPatternGradient,
          WebkitMaskImage: "url(/page-backgrounds/login-background.svg)",
          maskImage: "url(/page-backgrounds/login-background.svg)",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskPosition: "left center",
          maskPosition: "left center",
          WebkitMaskSize: "contain",
          maskSize: "contain",
          opacity: theme === "dark" ? 0.42 : 0.36,
          filter: theme === "dark" ? "saturate(1.16) brightness(1.08)" : "saturate(1.08) brightness(1.02)",
        }}
      />
      <div className="pointer-events-none absolute left-[8%] top-[14%] size-[22rem] rounded-full bg-primary/14 blur-[7rem]" />
      <div className="pointer-events-none absolute right-[10%] top-[12%] size-[18rem] rounded-full bg-warning/12 blur-[6.5rem]" />
      <div className="pointer-events-none absolute bottom-[8%] left-1/2 size-[24rem] -translate-x-1/2 rounded-full bg-primary/10 blur-[8.5rem]" />

      <header className="absolute inset-x-0 top-0 z-20">
        <div className="flex w-full items-center justify-between px-[2.35vw] pt-[2.6vh]">
          <div className="flex items-center gap-[0.65rem]">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className={topCircleButtonClass}
              onClick={() => navigate("/")}
              aria-label="返回系统首页"
              title="返回系统首页"
            >
              <Home className={topHomeIconClass} />
            </Button>

            <div className={topBrandPillClass}>
              <div className="flex size-[1.88rem] items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
                <ShieldCheck className="size-[1.38rem]" />
              </div>
              <span className="text-[0.82rem] font-semibold uppercase tracking-[0.24em] text-foreground/90">ICP Fuzz</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="icon"
            className={cn(topCircleButtonClass, "shrink-0")}
            onClick={toggleTheme}
            aria-label="切换主题"
            title="切换主题"
          >
            {theme === "dark" ? <SunMedium className={topThemeIconClass} /> : <MoonStar className={topThemeIconClass} />}
          </Button>
        </div>
      </header>

      <main className="relative z-10 grid min-h-screen place-items-center px-[4vw]">
        <div className="relative flex w-full max-w-[clamp(20.25rem,26vw,23.75rem)] items-center justify-center">
          <div className="pointer-events-none absolute inset-x-[8%] top-1/2 h-[36%] -translate-y-1/2 rounded-full bg-primary/12 blur-3xl" />

          <Card className="relative w-full overflow-hidden rounded-[2rem] border-border/70 bg-[linear-gradient(180deg,hsl(var(--bg-surface-elevated)/0.94),hsl(var(--bg-surface)/0.86))] shadow-[0_2rem_5rem_hsl(var(--shadow)/0.18)] backdrop-blur-2xl">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/45 to-transparent" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.34),transparent_22%)] dark:bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_22%)]" />

            <CardContent className="relative px-[clamp(1.6rem,5.4vw,2.45rem)] pt-[clamp(1.48rem,4.2vh,2.08rem)] pb-[clamp(3.6rem,5.9vh,3.95rem)]">
              <div className="mx-auto w-full max-w-[19.25rem] space-y-[clamp(0.85rem,1.85vh,1.2rem)]">
                <div className="space-y-[clamp(3.55rem,5.9vh,3.9rem)] text-center">
                  <p className="text-[0.72rem] uppercase tracking-[0.32em] text-muted-foreground">Console Access</p>

                  <div className="flex flex-col items-center gap-[0.8rem]">
                    <div className="flex size-[4.35rem] items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-[1.55rem] font-semibold text-primary shadow-console">
                      {avatarInitial}
                    </div>
                    <p className="text-[1.4rem] font-medium tracking-[0.06em] text-foreground">登录</p>
                  </div>
                </div>

                <form
                  className="space-y-0"
                  onSubmit={(event) => {
                    event.preventDefault();
                    loginMutation.mutate();
                  }}
                >
                  <div className="space-y-[1rem]">
                    <FormField label="用户名">
                      <Input
                        className="h-[clamp(2.7rem,4.4vh,2.95rem)] rounded-full px-[1rem]"
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                        autoComplete="username"
                        placeholder="输入控制台用户名"
                      />
                    </FormField>

                    <FormField label="密码">
                      <Input
                        className="h-[clamp(2.7rem,4.4vh,2.95rem)] rounded-full px-[1rem]"
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        autoComplete="current-password"
                        placeholder="输入当前密码"
                      />
                    </FormField>
                  </div>

                  <div className="flex justify-center pt-[clamp(3.55rem,5.9vh,3.9rem)]">
                    <Button
                      type="submit"
                      size="icon"
                      className="size-[clamp(3.7rem,6.2vh,4.2rem)] rounded-full bg-primary text-primary-foreground shadow-console transition-transform hover:scale-[1.03] hover:bg-[hsl(var(--accent-blue-hover))] [&_svg]:text-primary-foreground"
                      disabled={loginMutation.isPending}
                      aria-label={loginMutation.isPending ? "登录中" : "登录"}
                      title={loginMutation.isPending ? "登录中" : "登录"}
                    >
                      <ArrowRight className="size-[1.62rem]" />
                    </Button>
                  </div>
                </form>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
