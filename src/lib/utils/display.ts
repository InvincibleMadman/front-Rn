import type { ArtifactKind, JobStatus } from "@/types/api/jobs";
import type { WorkspaceReferenceType } from "@/stores/workspace-store";

export function translateJobStatus(status: string | JobStatus): string {
  const map: Record<string, string> = {
    starting: "启动中",
    running: "运行中",
    stopping: "停止中",
    cancelled: "已停止",
    partial: "部分完成",
    finished: "已完成",
    failed: "失败",
    pending: "等待中",
    succeeded: "已成功",
    open: "已连接",
    closed: "已断开",
    connecting: "连接中",
    idle: "空闲",
    error: "异常",
    created: "待启动",
    launching_target: "准备目标",
    replaying_input: "回放输入",
    waiting_signal: "等待异常",
    collecting_context: "采集上下文",
    llm_reasoning: "分析中",
    locate_line: "定位代码",
    classified: "已定位",
    archived: "已归档",
  };
  return map[status] ?? status;
}

export function translateArtifactKind(kind: string | ArtifactKind): string {
  const map: Record<string, string> = {
    crash: "崩溃样本",
    hang: "挂起样本",
  };
  return map[kind] ?? kind;
}

export function translateWorkspaceReferenceType(type: WorkspaceReferenceType | string): string {
  const map: Record<string, string> = {
    protocol: "协议规范提取",
    seeds: "初始种子生成",
    'risk-analysis': "风险路径分析",
    'risk-preview': "分析结果预览",
    'risk-upload': "风险JSON上传",
    instrument: "插桩处理",
  };
  return map[type] ?? type;
}
