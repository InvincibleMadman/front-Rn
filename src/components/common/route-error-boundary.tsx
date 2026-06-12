import { isRouteErrorResponse, useRouteError } from "react-router-dom";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { JsonViewer } from "@/components/common/json-viewer";

function normalizeRouteError(error: unknown): Record<string, unknown> {
  if (isRouteErrorResponse(error)) {
    return {
      type: "route_error_response",
      status: error.status,
      statusText: error.statusText,
      data: error.data,
    };
  }

  if (error instanceof Error) {
    return {
      type: "render_error",
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    type: "unknown_route_error",
    value: error,
  };
}

export function RouteErrorBoundary(): JSX.Element {
  const error = useRouteError();
  const normalized = normalizeRouteError(error);

  return (
    <div className="min-h-screen bg-background p-6 text-foreground">
      <Card className="mx-auto max-w-4xl border-danger/35 bg-danger/8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-danger">
            <AlertTriangle className="size-5" />
            页面渲染失败
          </CardTitle>
          <CardDescription>
            这通常是前端组件渲染期异常，不是普通 API 请求失败。请先复制错误详情定位具体字段。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button type="button" variant="outline" onClick={() => window.location.reload()}>
            <RefreshCw className="size-4" />
            刷新页面
          </Button>
          <JsonViewer data={normalized} />
        </CardContent>
      </Card>
    </div>
  );
}