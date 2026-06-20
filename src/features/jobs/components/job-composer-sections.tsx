import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/common/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { LaunchProfile } from "@/types/api/build-assistant";

export interface JobComposerState {
  protocol: string;
  launch_profile_id: string;
  cwd: string;
  target_binary: string;
  target_args: string;
  afl_path: string;
  scheduler: string;
  workers: string;
  timeout_sec: string;
  input_dir: string;
  output_dir: string;
  transport_type: string;
  transport_config_json: string;
  env_json: string;
  fuzzer_args_text: string;
  node_name: string;
  operation_id: string;
  notes: string;
  dry_run: boolean;
  risk_enabled: boolean;
}

const transportOptions = ["stdin", "file", "udp", "tcp", "custom"] as const;
const schedulerOptions = ["auto", "fast", "explore", "coe", "linucb", "rare"] as const;

export function JobComposerSections({
  value,
  onChange,
  protocols,
  launchProfiles,
  onApplyProfile,
}: {
  value: JobComposerState;
  onChange: (patch: Partial<JobComposerState>) => void;
  protocols: string[];
  launchProfiles: LaunchProfile[];
  onApplyProfile: (profileId: string) => void;
}): JSX.Element {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">任务目标</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <FormField label="protocol">
            <Input list="jobs-protocol-list" value={value.protocol} onChange={(event) => onChange({ protocol: event.target.value })} placeholder="modbus" />
          </FormField>
          <datalist id="jobs-protocol-list">
            {protocols.map((item) => <option key={item} value={item} />)}
          </datalist>
          <FormField label="launch profile">
            <Select value={value.launch_profile_id || "none"} onValueChange={(next) => { const valueToSet = next === "none" ? "" : next; onChange({ launch_profile_id: valueToSet }); if (valueToSet) onApplyProfile(valueToSet); }}>
              <SelectTrigger><SelectValue placeholder="选择 LaunchProfile" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">不使用</SelectItem>
                {launchProfiles.map((item) => <SelectItem key={item.profile_id} value={item.profile_id}>{item.profile_id}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="cwd / source / build">
            <Input value={value.cwd} onChange={(event) => onChange({ cwd: event.target.value })} placeholder="workspace://legacy-default/source" />
          </FormField>
          <FormField label="target binary">
            <Input value={value.target_binary} onChange={(event) => onChange({ target_binary: event.target.value })} placeholder="workspace://.../server_example" />
          </FormField>
          <div className="md:col-span-2">
            <FormField label="args">
              <Input value={value.target_args} onChange={(event) => onChange({ target_args: event.target.value })} placeholder="-p @@" />
            </FormField>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">执行模式</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FormField label="dry run">
            <div className="flex h-10 items-center rounded-[var(--radius-lg)] border border-border/60 px-3">
              <Switch checked={value.dry_run} onCheckedChange={(checked) => onChange({ dry_run: checked })} />
              <span className="ml-3 text-sm text-muted-foreground">{value.dry_run ? "是" : "否"}</span>
            </div>
          </FormField>
          <FormField label="afl binary">
            <Input value={value.afl_path} onChange={(event) => onChange({ afl_path: event.target.value })} placeholder="afl-fuzz" />
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
          <FormField label="timeout">
            <Input value={value.timeout_sec} onChange={(event) => onChange({ timeout_sec: event.target.value })} placeholder="3600" />
          </FormField>
          <FormField label="risk enabled">
            <div className="flex h-10 items-center rounded-[var(--radius-lg)] border border-border/60 px-3">
              <Switch checked={value.risk_enabled} onCheckedChange={(checked) => onChange({ risk_enabled: checked })} />
              <span className="ml-3 text-sm text-muted-foreground">{value.risk_enabled ? "开启" : "关闭"}</span>
            </div>
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">输入与 transport</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <FormField label="input dir"><Input value={value.input_dir} onChange={(event) => onChange({ input_dir: event.target.value })} placeholder="workspace://.../seeds" /></FormField>
          <FormField label="output dir"><Input value={value.output_dir} onChange={(event) => onChange({ output_dir: event.target.value })} placeholder="workspace://.../jobs" /></FormField>
          <FormField label="transport type">
            <Select value={value.transport_type} onValueChange={(next) => onChange({ transport_type: next })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{transportOptions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
            </Select>
          </FormField>
          <FormField label="transport config JSON"><Textarea value={value.transport_config_json} onChange={(event) => onChange({ transport_config_json: event.target.value })} rows={5} /></FormField>
        </CardContent>
      </Card>

      <Card>
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
