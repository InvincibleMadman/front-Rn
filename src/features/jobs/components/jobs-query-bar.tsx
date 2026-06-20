import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { JobsListQuery } from "@/types/api/jobs";

interface Props {
  value: JobsListQuery;
  onChange: (next: JobsListQuery) => void;
  protocolOptions: string[];
  nodeOptions: string[];
  schedulerOptions: string[];
}

function boolString(value: boolean | undefined): string {
  if (value === true) return "true";
  if (value === false) return "false";
  return "all";
}

export function JobsQueryBar({ value, onChange, protocolOptions, nodeOptions, schedulerOptions }: Props): JSX.Element {
  const setField = (key: keyof JobsListQuery, fieldValue: unknown): void => {
    onChange({ ...value, [key]: fieldValue });
  };
  return (
    <Card className="card-surface sticky top-[calc(var(--topbar-h)+0.85rem)] z-20">
      <CardContent className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1.35fr)_repeat(6,minmax(0,0.72fr))_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-3.5 size-4 text-muted-foreground" />
          <Input className="pl-9" value={String(value.keyword ?? "")} onChange={(event) => setField("keyword", event.target.value)} placeholder="搜索 task id、协议、节点、目标命令" />
        </div>
        <Select value={String(value.protocol ?? "all")} onValueChange={(next) => setField("protocol", next === "all" ? undefined : next)}>
          <SelectTrigger><SelectValue placeholder="协议" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部协议</SelectItem>
            {protocolOptions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={String(value.status ?? "all")} onValueChange={(next) => setField("status", next === "all" ? undefined : next)}>
          <SelectTrigger><SelectValue placeholder="状态" /></SelectTrigger>
          <SelectContent>
            {['all','created','validated','starting','running','stopping','finished','failed','validation_failed'].map((item) => <SelectItem key={item} value={item}>{item === 'all' ? '全部状态' : item}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={String(value.node_name ?? "all")} onValueChange={(next) => setField("node_name", next === "all" ? undefined : next)}>
          <SelectTrigger><SelectValue placeholder="节点" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部节点</SelectItem>
            {nodeOptions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={String(value.scheduler ?? "all")} onValueChange={(next) => setField("scheduler", next === "all" ? undefined : next)}>
          <SelectTrigger><SelectValue placeholder="调度" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部调度</SelectItem>
            {schedulerOptions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={boolString(value.risk_enabled)} onValueChange={(next) => setField("risk_enabled", next === "all" ? undefined : next === "true") }>
          <SelectTrigger><SelectValue placeholder="Risk" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Risk 全部</SelectItem>
            <SelectItem value="true">Risk 开启</SelectItem>
            <SelectItem value="false">Risk 关闭</SelectItem>
          </SelectContent>
        </Select>
        <Select value={boolString(value.has_crash)} onValueChange={(next) => setField("has_crash", next === "all" ? undefined : next === "true") }>
          <SelectTrigger><SelectValue placeholder="Crash" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Crash 全部</SelectItem>
            <SelectItem value="true">有 Crash</SelectItem>
            <SelectItem value="false">无 Crash</SelectItem>
          </SelectContent>
        </Select>
        <Select value={String(value.order ?? "desc")} onValueChange={(next) => setField("order", next)}>
          <SelectTrigger><SelectValue placeholder="排序" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="desc">最新优先</SelectItem>
            <SelectItem value="asc">最早优先</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="secondary" onClick={() => onChange({ sort: "updated_at", order: "desc" })}>
          <X className="size-4" /> 清空
        </Button>
      </CardContent>
    </Card>
  );
}
