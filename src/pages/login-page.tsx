import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/common/form-field";
import { ApiErrorAlert } from "@/components/common/api-error-alert";
import { authApi } from "@/lib/api/services/auth";

export function LoginPage(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/dashboard";

  const loginMutation = useMutation({
    mutationFn: () => authApi.login(username, password),
    onSuccess: () => navigate(from, { replace: true }),
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--bg-base))] px-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            登录控制面
          </CardTitle>
          <CardDescription>浏览器登录 Web BFF 后，仅持有 HttpOnly Cookie 会话。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loginMutation.error ? <ApiErrorAlert error={loginMutation.error} title="登录失败" /> : null}
          <FormField label="用户名">
            <Input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
          </FormField>
          <FormField label="密码">
            <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
          </FormField>
          <Button className="w-full" disabled={loginMutation.isPending} onClick={() => loginMutation.mutate()}>
            {loginMutation.isPending ? "登录中..." : "登录"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
