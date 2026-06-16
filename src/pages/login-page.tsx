import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  Binary,
  Bug,
  LockKeyhole,
  Radar,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/common/form-field";
import { ApiErrorAlert } from "@/components/common/api-error-alert";
import { cn } from "@/lib/utils/cn";
import { authApi } from "@/lib/api/services/auth";

function sanitizeNextPath(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  if (value === "/login" || value.startsWith("/login?")) return null;
  return value;
}

export function LoginPage(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const nextFromQuery = sanitizeNextPath(new URLSearchParams(location.search).get("next"));
  const nextFromState = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? null;
  const from = nextFromQuery ?? nextFromState ?? "/dashboard";

  const loginMutation = useMutation({
    mutationFn: () => authApi.login(username, password),
    onSuccess: () => navigate(from, { replace: true }),
  });

  const capabilityCards = [
    {
      title: "Protocol Analysis",
      description: "协议结构抽取与链路切片，建立后续 fuzz 任务的输入边界。",
      icon: Radar,
    },
    {
      title: "Risk Instrumentation",
      description: "风险识别与插桩处理在同一控制面收敛，保持 /api/v1/* 主链路一致。",
      icon: Binary,
    },
    {
      title: "GDB Debug Sessions",
      description: "调试追踪、崩溃回放与证据链定位保持在专业控制台语义内。",
      icon: Activity,
    },
  ] as const;

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-background text-foreground"
      style={{
        backgroundImage: [
          "radial-gradient(circle at 12% 18%, hsl(var(--accent-blue) / 0.22), transparent 28%)",
          "radial-gradient(circle at 82% 20%, hsl(var(--accent-orange) / 0.14), transparent 24%)",
          "radial-gradient(circle at 72% 78%, hsl(var(--accent-pink) / 0.14), transparent 26%)",
          "linear-gradient(135deg, hsl(var(--bg-primary)) 0%, hsl(var(--bg-primary-alt)) 52%, hsl(var(--bg-surface)) 100%)",
        ].join(", "),
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage: [
            "linear-gradient(hsl(var(--border) / 0.22) 1px, transparent 1px)",
            "linear-gradient(90deg, hsl(var(--border) / 0.22) 1px, transparent 1px)",
          ].join(", "),
          backgroundSize: "2.75rem 2.75rem",
          maskImage: "linear-gradient(180deg, rgba(0,0,0,0.9), rgba(0,0,0,0.35))",
        }}
      />
      <div className="pointer-events-none absolute left-[12%] top-[14%] size-56 rounded-full bg-primary/20 blur-[100px]" />
      <div className="pointer-events-none absolute bottom-[10%] right-[8%] size-72 rounded-full bg-warning/20 blur-[120px]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1280px] items-center px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid w-full gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(24rem,27rem)] lg:items-stretch">
          <section className="relative overflow-hidden rounded-[2rem] border border-border/60 bg-[linear-gradient(180deg,hsl(var(--bg-surface-elevated)/0.74),hsl(var(--bg-surface)/0.52))] p-6 shadow-console backdrop-blur-xl sm:p-8 lg:p-10">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--accent-blue)/0.15),transparent_28%),linear-gradient(180deg,transparent,transparent_58%,hsl(var(--border)/0.1))]" />
            <div className="relative flex h-full flex-col justify-between gap-8">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/50 px-3 py-1.5 text-[11px] uppercase tracking-[0.28em] text-muted-foreground shadow-console">
                  <Bug className="size-3.5 text-primary" />
                  <span>Protocol Fuzz Console</span>
                </div>

                <div className="mt-6 space-y-5">
                  <h1 className="max-w-3xl text-[clamp(2.5rem,4vw,4.35rem)] font-semibold leading-[1.02] tracking-tight text-foreground">
                    ICS 协议模糊测试系统
                  </h1>
                  <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                    协议分析、风险识别、插桩处理、调试追踪，在同一现代控制面中收敛为一致的
                    Web BFF + <span className="font-medium text-foreground">/api/v1/*</span> 主链路。
                  </p>
                </div>

                <div className="mt-8 flex flex-wrap gap-3">
                  <div className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-sm text-primary">
                    Control Plane Ready
                  </div>
                  <div className="rounded-full border border-border/70 bg-background/50 px-3 py-1.5 text-sm text-muted-foreground">
                    Compat Removed
                  </div>
                  <div className="rounded-full border border-border/70 bg-background/50 px-3 py-1.5 text-sm text-muted-foreground">
                    Security-Centered Workflow
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {capabilityCards.map((item, index) => {
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.title}
                      className={cn(
                        "relative overflow-hidden rounded-[1.4rem] border border-border/70 bg-background/58 p-4 shadow-console backdrop-blur-xl transition-colors",
                        index === 1 && "md:translate-y-6",
                        index === 2 && "lg:translate-y-10",
                      )}
                    >
                      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--accent-blue)/0.12),transparent_35%)]" />
                      <div className="relative">
                        <div className="flex size-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                          <Icon className="size-5" />
                        </div>
                        <p className="mt-4 text-sm font-semibold tracking-wide text-foreground">{item.title}</p>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <div className="flex items-center justify-center lg:justify-end">
            <Card className="relative w-full max-w-[27rem] overflow-hidden border-border/70 bg-[linear-gradient(180deg,hsl(var(--bg-surface-elevated)/0.92),hsl(var(--bg-surface)/0.84))] shadow-[0_30px_90px_hsl(var(--shadow)/0.18)] backdrop-blur-2xl">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/45 to-transparent" />
              <CardHeader className="relative pb-4">
                <div className="mb-3 flex size-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-console">
                  <ShieldCheck className="size-5" />
                </div>
                <CardTitle className="flex items-center gap-2 text-[1.6rem] tracking-tight">
                  登录控制面
                </CardTitle>
                <CardDescription className="max-w-sm leading-6">
                  登录 Web BFF 后，浏览器仅持有 HttpOnly session。其余节点能力统一收敛到签名鉴权的 /api/v1/*。
                </CardDescription>
              </CardHeader>

              <CardContent className="relative space-y-5">
                {loginMutation.error ? <ApiErrorAlert error={loginMutation.error} title="登录失败" compact /> : null}

                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    loginMutation.mutate();
                  }}
                >
                  <FormField label="用户名">
                    <Input
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      autoComplete="username"
                      placeholder="输入控制台用户名"
                    />
                  </FormField>

                  <FormField label="密码">
                    <Input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete="current-password"
                      placeholder="输入当前密码"
                    />
                  </FormField>

                  <Button className="h-11 w-full justify-between rounded-[var(--radius-xl)] px-4" disabled={loginMutation.isPending}>
                    <span>{loginMutation.isPending ? "登录中..." : "登录"}</span>
                    <ArrowRight className="size-4" />
                  </Button>
                </form>

                <div className="rounded-[1.25rem] border border-border/70 bg-background/55 p-4 text-sm text-muted-foreground">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                      <LockKeyhole className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">安全说明</p>
                      <p className="mt-1 leading-6">
                        登录边界保持服务端 scrypt、HttpOnly session 与 CSRF。系统已删除 compat 旧接口，不再保留旁路访问。
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
