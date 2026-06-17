import { Home, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function RouteErrorBoundary(): JSX.Element {
  return (
    <div className="min-h-screen bg-background p-6 text-foreground">
      <Card className="mx-auto max-w-3xl border-border/70 bg-card/90 shadow-console">
        <CardHeader>
          <CardTitle className="text-foreground">
            页面暂时不可用
          </CardTitle>
          <CardDescription>
            当前路由发生了渲染或加载异常。请先刷新当前页面，或回到控制台首页后重试。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button type="button" onClick={() => window.location.reload()}>
            <RefreshCw className="size-4" />
            刷新页面
          </Button>
          <Button type="button" variant="outline" onClick={() => window.location.assign("/dashboard")}>
            <Home className="size-4" />
            返回控制台
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
