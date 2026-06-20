import { Search, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { VulnQuery } from "@/types/api/vuln-history";

export function VulnQueryBar({
  mode,
  protocol,
  protocolOptions,
  query,
  onModeChange,
  onProtocolChange,
  onQueryChange,
}: {
  mode: "global" | "protocol";
  protocol: string;
  protocolOptions: string[];
  query: VulnQuery;
  onModeChange: (mode: "global" | "protocol") => void;
  onProtocolChange: (protocol: string) => void;
  onQueryChange: (query: VulnQuery) => void;
}): JSX.Element {
  const setField = (key: keyof VulnQuery, value: unknown): void => onQueryChange({ ...query, [key]: value });

  return (
    <Card className="card-surface">
      <CardContent className="grid gap-y-1 gap-x-2.5 px-1 py-0.5 xl:grid-cols-[auto_minmax(0,1fr)_repeat(6,minmax(0,0.72fr))_auto]">
        <div className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/65 p-px">
          <button
            type="button"
            onClick={() => onModeChange("global")}
            className={`inline-flex h-[2.25rem] items-center rounded-full px-2.5 text-sm ${mode === "global" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            全局
          </button>
          <button
            type="button"
            onClick={() => onModeChange("protocol")}
            className={`inline-flex h-[2.25rem] items-center rounded-full px-2.5 text-sm ${mode === "protocol" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            单协议
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-[0.875rem] -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-[2.25rem] pl-8"
            value={String(query.keyword ?? "")}
            onChange={(event) => setField("keyword", event.target.value)}
            placeholder="标题 / 根因 / 文件 / 函数 / PoC"
          />
        </div>

        <Select value={mode === "protocol" ? protocol : "all"} onValueChange={(next) => onProtocolChange(next === "all" ? "" : next)}>
          <SelectTrigger className="h-[2.25rem] px-2.5">
            <SelectValue placeholder="协议" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部协议</SelectItem>
            {protocolOptions.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={String(query.coarse_type ?? "all")} onValueChange={(next) => setField("coarse_type", next === "all" ? undefined : next)}>
          <SelectTrigger className="h-[2.25rem] px-2.5">
            <SelectValue placeholder="粗类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类型</SelectItem>
            {["memory-corruption", "bounds-check", "null-deref", "use-after-free", "integer-issue", "parser-state", "auth-logic", "resource-exhaustion", "protocol-state-machine", "unknown"].map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          className="h-[2.25rem] px-2.5"
          value={String(query.cwe ?? "")}
          onChange={(event) => setField("cwe", event.target.value)}
          placeholder="CWE"
        />

        <Select value={String(query.confidence ?? "all")} onValueChange={(next) => setField("confidence", next === "all" ? undefined : next)}>
          <SelectTrigger className="h-[2.25rem] px-2.5">
            <SelectValue placeholder="置信度" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部置信度</SelectItem>
            <SelectItem value="high">高</SelectItem>
            <SelectItem value="medium">中</SelectItem>
            <SelectItem value="low">低</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={query.linked_debug === undefined ? "all" : query.linked_debug ? "true" : "false"}
          onValueChange={(next) => setField("linked_debug", next === "all" ? undefined : next === "true")}
        >
          <SelectTrigger className="h-[2.25rem] px-2.5">
            <SelectValue placeholder="GDB" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">GDB 全部</SelectItem>
            <SelectItem value="true">已关联 GDB</SelectItem>
            <SelectItem value="false">未关联 GDB</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={query.linked_crash === undefined ? "all" : query.linked_crash ? "true" : "false"}
          onValueChange={(next) => setField("linked_crash", next === "all" ? undefined : next === "true")}
        >
          <SelectTrigger className="h-[2.25rem] px-2.5">
            <SelectValue placeholder="Crash" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Crash 全部</SelectItem>
            <SelectItem value="true">已关联 Crash</SelectItem>
            <SelectItem value="false">未关联 Crash</SelectItem>
          </SelectContent>
        </Select>

        <Button className="h-[2.25rem] px-2.5" variant="secondary" onClick={() => onQueryChange({ limit: 100, sort: "updated_at", order: "desc" })}>
          <X className="size-4" />
          清空
        </Button>
      </CardContent>
    </Card>
  );
}
