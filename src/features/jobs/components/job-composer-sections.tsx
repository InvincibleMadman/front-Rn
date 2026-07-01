import { FormField } from "@/components/common/form-field";
import { ProtocolComboInput } from "@/components/common/protocol-combo-input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { LaunchProfile, RuntimeToolDefinition, TargetCandidate } from "@/types/api/build-assistant";

export interface JobComposerState {
  protocol: string;
  task_kind: "runtime" | "aux";
  launch_profile_id: string;
  selected_target_id: string;
  cwd: string;
  target_binary: string;
  target_args: string;
  afl_path: string;
  scheduler: string;
  workers: string;
  timeout_sec: string;
  memory_limit_mb: string;
  input_dir: string;
  output_dir: string;
  single_input_ref: string;
  transport_type: string;
  transport_config_json: string;
  env_json: string;
  fuzzer_args_text: string;
  node_name: string;
  operation_id: string;
  notes: string;
  dry_run: boolean;
  risk_feedback_enabled: boolean;
  risk_schedule_enabled: boolean;
}

const transportOptions = ["stdin", "file", "udp", "tcp", "custom"] as const;
const schedulerOptions = ["auto", "fast", "explore", "linucb", "rare", "mmopt", "seek"] as const;

export function JobComposerSections({
  value,
  onChange,
  protocols,
  launchProfiles,
  runtimeTools,
  targetOptions,
  selectedRuntimeTool,
}: {
  value: JobComposerState;
  onChange: (patch: Partial<JobComposerState>) => void;
  protocols: string[];
  launchProfiles: LaunchProfile[];
  runtimeTools: RuntimeToolDefinition[];
  targetOptions: TargetCandidate[];
  selectedRuntimeTool: RuntimeToolDefinition | null;
}): JSX.Element {
  return (
    <div className="space-y-4">
      <Card className="card-surface">
        <CardHeader className="pb-3"><CardTitle className="text-base">Fuzz / AFL 任务类型</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <FormField label="任务类型" description="实时 Fuzz 任务用于进入 Runner；辅助工具任务偏向一次性 AFL 工具。">
            <Select value={value.task_kind} onValueChange={(next) => onChange({ task_kind: next as JobComposerState["task_kind"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="runtime">实时 Fuzz 任务</SelectItem>
                <SelectItem value="aux">AFL 辅助工具任务</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="AFL tool">
            <Select value={value.afl_path} onValueChange={(next) => onChange({ afl_path: next })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {runtimeTools.map((item) => <SelectItem key={item.tool_id} value={item.tool_id}>{item.tool_id}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>
          <div className="md:col-span-2 rounded-[var(--radius-lg)] border border-border/60 bg-background/55 px-3 py-2 text-sm text-muted-foreground">
            {selectedRuntimeTool?.notes?.join(" ") || "当前工具说明将由后端 Build Probe 提供；若工具不适合正式 Runner，将仅保留 dry run / 侧栏命令建议。"}
          </div>
        </CardContent>
      </Card>

      <Card className="card-surface">
        <CardHeader className="pb-3"><CardTitle className="text-base">运行目标与 LaunchProfile</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <FormField label="protocol">
            <ProtocolComboInput
              value={value.protocol}
              options={protocols}
              placeholder="输入并选择已有协议"
              onValueChange={(next) => onChange({ protocol: next })}
            />
          </FormField>
          <FormField label="launch profile">
            <Select value={value.launch_profile_id || "none"} onValueChange={(next) => onChange({ launch_profile_id: next === "none" ? "" : next })}>
              <SelectTrigger><SelectValue placeholder="选择 LaunchProfile" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">不使用</SelectItem>
                {launchProfiles.map((item) => <SelectItem key={item.profile_id} value={item.profile_id}>{item.profile_id}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="已有目标产物" description="这里只是引用已有产物，不负责构建。">
            <Select value={value.selected_target_id || "none"} onValueChange={(next) => onChange({ selected_target_id: next === "none" ? "" : next })}>
              <SelectTrigger><SelectValue placeholder="选择已识别目标" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">不绑定已有目标</SelectItem>
                {targetOptions.map((item) => <SelectItem key={item.target_id} value={item.target_id}>{item.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="cwd / workspace ref">
            <Input value={value.cwd} onChange={(event) => onChange({ cwd: event.target.value })} placeholder="workspace://legacy-default/source/" />
          </FormField>
          <FormField label="target binary">
            <Input value={value.target_binary} onChange={(event) => onChange({ target_binary: event.target.value })} placeholder="workspace://.../server_example" />
          </FormField>
          <div className="md:col-span-2">
            <FormField label="target args">
              <Input value={value.target_args} onChange={(event) => onChange({ target_args: event.target.value })} placeholder="-p @@" />
            </FormField>
          </div>
        </CardContent>
      </Card>

      <Card className="card-surface">
        <CardHeader className="pb-3"><CardTitle className="text-base">执行策略</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FormField label="dry run">
            <div className="flex h-10 items-center rounded-[var(--radius-lg)] border border-border/60 px-3">
              <Switch checked={value.dry_run} onCheckedChange={(checked) => onChange({ dry_run: checked })} />
              <span className="ml-3 text-sm text-muted-foreground">{value.dry_run ? "是" : "否"}</span>
            </div>
          </FormField>
          <FormField label="scheduler">
            <Select value={value.scheduler} onValueChange={(next) => onChange({ scheduler: next })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{schedulerOptions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
            </Select>
          </FormField>
          <FormField label="workers">
            <Input value={value.workers} onChange={(event) => onChange({ workers: event.target.value })} placeholder="1" />
          </FormField>
          <FormField label="timeout sec">
            <Input value={value.timeout_sec} onChange={(event) => onChange({ timeout_sec: event.target.value })} placeholder="3600" />
          </FormField>
          <FormField label="memory limit mb">
            <Input value={value.memory_limit_mb} onChange={(event) => onChange({ memory_limit_mb: event.target.value })} placeholder="none" />
          </FormField>
          <FormField label="risk feedback">
            <div className="flex h-10 items-center rounded-[var(--radius-lg)] border border-border/60 px-3">
              <Switch checked={value.risk_feedback_enabled} onCheckedChange={(checked) => onChange({ risk_feedback_enabled: checked })} />
              <span className="ml-3 text-sm text-muted-foreground">{value.risk_feedback_enabled ? "开启" : "关闭"}</span>
            </div>
          </FormField>
          <FormField label="risk schedule">
            <div className="flex h-10 items-center rounded-[var(--radius-lg)] border border-border/60 px-3">
              <Switch
                checked={value.risk_feedback_enabled && value.risk_schedule_enabled}
                disabled={!value.risk_feedback_enabled}
                onCheckedChange={(checked) => onChange({ risk_schedule_enabled: checked })}
              />
              <span className="ml-3 text-sm text-muted-foreground">
                {value.risk_feedback_enabled && value.risk_schedule_enabled ? "开启" : "关闭"}
              </span>
            </div>
          </FormField>
        </CardContent>
      </Card>

      <Card className="card-surface">
        <CardHeader className="pb-3"><CardTitle className="text-base">输入与 transport</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <FormField label="input dir / ref"><Input value={value.input_dir} onChange={(event) => onChange({ input_dir: event.target.value })} placeholder="workspace://.../seeds" /></FormField>
          <FormField label="output dir / ref"><Input value={value.output_dir} onChange={(event) => onChange({ output_dir: event.target.value })} placeholder="workspace://.../jobs" /></FormField>
          <FormField label="single testcase"><Input value={value.single_input_ref} onChange={(event) => onChange({ single_input_ref: event.target.value })} placeholder="workspace://.../id_000001" /></FormField>
          <FormField label="transport type">
            <Select value={value.transport_type} onValueChange={(next) => onChange({ transport_type: next })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{transportOptions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
            </Select>
          </FormField>
          <div className="md:col-span-2">
            <FormField label="transport config JSON"><Textarea value={value.transport_config_json} onChange={(event) => onChange({ transport_config_json: event.target.value })} rows={5} /></FormField>
          </div>
        </CardContent>
      </Card>

      <Card className="card-surface">
        <CardHeader className="pb-3"><CardTitle className="text-base">环境与附加参数</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <FormField label="env JSON"><Textarea value={value.env_json} onChange={(event) => onChange({ env_json: event.target.value })} rows={6} /></FormField>
          <div className="space-y-4">
            <FormField label="fuzzer args"><Textarea value={value.fuzzer_args_text} onChange={(event) => onChange({ fuzzer_args_text: event.target.value })} rows={3} /></FormField>
            <FormField label="node name"><Input value={value.node_name} onChange={(event) => onChange({ node_name: event.target.value })} placeholder="local-node" /></FormField>
            <FormField label="operation id"><Input value={value.operation_id} onChange={(event) => onChange({ operation_id: event.target.value })} placeholder="optional" /></FormField>
            <FormField label="notes"><Textarea value={value.notes} onChange={(event) => onChange({ notes: event.target.value })} rows={3} /></FormField>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
