import { FormField } from "@/components/common/form-field";
import { ProtocolComboInput } from "@/components/common/protocol-combo-input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { SanitizedBuildCommandsResult } from "@/features/jobs/job-command-guard";

export type BuildComposerMode = "structured" | "direct_commands";

export interface BuildTaskComposerState {
  protocol: string;
  mode: BuildComposerMode;
  source_ref: string;
  source_root: string;
  build_root_ref: string;
  build_root: string;
  binary_output_ref: string;
  build_system: string;
  compiler: string;
  build_type: string;
  generator: string;
  build_target: string;
  parallelism: string;
  extra_cflags: string;
  extra_cxxflags: string;
  extra_ldflags: string;
  expected_outputs_text: string;
  target_io_hint: "file_or_stdin" | "network_or_server" | "unknown";
  configure_command_text: string;
  build_command_text: string;
  post_build_commands_text: string;
  direct_commands_text: string;
}

const buildTypeOptions = ["RelWithDebInfo", "Debug", "Release", "MinSizeRel"] as const;
const targetIoOptions = ["file_or_stdin", "network_or_server", "unknown"] as const;

export function BuildTaskComposerSections({
  value,
  onChange,
  protocols,
  buildSystems,
  compilers,
  directCommandSanitize,
}: {
  value: BuildTaskComposerState;
  onChange: (patch: Partial<BuildTaskComposerState>) => void;
  protocols: string[];
  buildSystems: string[];
  compilers: string[];
  directCommandSanitize: SanitizedBuildCommandsResult;
}): JSX.Element {
  return (
    <div className="space-y-4">
      <Card className="card-surface">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">构建任务模式</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={value.mode} onValueChange={(next) => onChange({ mode: next as BuildComposerMode })}>
            <TabsList className="w-full justify-start">
              <TabsTrigger value="structured">表单模式</TabsTrigger>
              <TabsTrigger value="direct_commands">直接命令模式</TabsTrigger>
            </TabsList>
            <TabsContent value="structured" className="mt-4 space-y-4">
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">源码与构建目录</CardTitle></CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <FormField label="protocol">
                    <ProtocolComboInput
                      value={value.protocol}
                      options={protocols}
                      placeholder="输入并选择已有协议"
                      onValueChange={(next) => onChange({ protocol: next })}
                    />
                  </FormField>
                  <FormField label="build system">
                    <Select value={value.build_system || (buildSystems[0] ?? "manual")} onValueChange={(next) => onChange({ build_system: next })}>
                      <SelectTrigger><SelectValue placeholder="选择构建系统" /></SelectTrigger>
                      <SelectContent>
                        {(buildSystems.length ? buildSystems : ["cmake", "make", "ninja", "meson", "manual"]).map((item) => (
                          <SelectItem key={item} value={item}>{item}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField label="source_ref">
                    <Input value={value.source_ref} onChange={(event) => onChange({ source_ref: event.target.value })} placeholder="workspace://legacy-default/source/" />
                  </FormField>
                  <FormField label="source_root">
                    <Input value={value.source_root} onChange={(event) => onChange({ source_root: event.target.value })} placeholder="可选，仅用于说明或兼容旧输入" />
                  </FormField>
                  <FormField label="build_root_ref">
                    <Input value={value.build_root_ref} onChange={(event) => onChange({ build_root_ref: event.target.value })} placeholder="workspace://legacy-default/build/" />
                  </FormField>
                  <FormField label="binary_output_ref" description="可选。留空时归档到当前协议的 binaries 类别目录；支持 workspace://<protocol>/... 或当前协议快捷写法，如 binaries/asan/。">
                    <Input value={value.binary_output_ref} onChange={(event) => onChange({ binary_output_ref: event.target.value })} placeholder="binaries/asan/ 或 workspace://legacy-default/binaries/asan/" />
                  </FormField>
                  <FormField label="build_root">
                    <Input value={value.build_root} onChange={(event) => onChange({ build_root: event.target.value })} placeholder="可选，仅用于说明或兼容旧输入" />
                  </FormField>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">构建参数</CardTitle></CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <FormField label="compiler">
                    <Select value={value.compiler} onValueChange={(next) => onChange({ compiler: next })}>
                      <SelectTrigger><SelectValue placeholder="选择编译器" /></SelectTrigger>
                      <SelectContent>{compilers.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                    </Select>
                  </FormField>
                  <FormField label="build type">
                    <Select value={value.build_type} onValueChange={(next) => onChange({ build_type: next })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{buildTypeOptions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                    </Select>
                  </FormField>
                  <FormField label="generator">
                    <Input value={value.generator} onChange={(event) => onChange({ generator: event.target.value })} placeholder="Ninja / Unix Makefiles" />
                  </FormField>
                  <FormField label="parallelism">
                    <Input value={value.parallelism} onChange={(event) => onChange({ parallelism: event.target.value })} placeholder="4" />
                  </FormField>
                  <FormField label="build target">
                    <Input value={value.build_target} onChange={(event) => onChange({ build_target: event.target.value })} placeholder="可选目标名" />
                  </FormField>
                  <FormField label="target io hint">
                    <Select value={value.target_io_hint} onValueChange={(next) => onChange({ target_io_hint: next as BuildTaskComposerState["target_io_hint"] })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{targetIoOptions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                    </Select>
                  </FormField>
                  <FormField label="extra CFLAGS">
                    <Input value={value.extra_cflags} onChange={(event) => onChange({ extra_cflags: event.target.value })} placeholder="-O2 -g" />
                  </FormField>
                  <FormField label="extra CXXFLAGS">
                    <Input value={value.extra_cxxflags} onChange={(event) => onChange({ extra_cxxflags: event.target.value })} placeholder="-O2 -g" />
                  </FormField>
                  <div className="md:col-span-2 xl:col-span-4">
                    <FormField label="extra LDFLAGS">
                      <Input value={value.extra_ldflags} onChange={(event) => onChange({ extra_ldflags: event.target.value })} placeholder="-fsanitize=address" />
                    </FormField>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">命令与输出预期</CardTitle></CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <FormField label="configure_command_text" description="可留空，后端将按 build system 推导默认 configure step。">
                    <Textarea value={value.configure_command_text} onChange={(event) => onChange({ configure_command_text: event.target.value })} rows={4} placeholder="cmake -S . -B build" />
                  </FormField>
                  <FormField label="build_command_text" description="可留空，后端将按 build system 推导默认 build step。">
                    <Textarea value={value.build_command_text} onChange={(event) => onChange({ build_command_text: event.target.value })} rows={4} placeholder="cmake --build build --parallel 4" />
                  </FormField>
                  <FormField label="post_build_commands_text" description="一行一个后处理构建命令。">
                    <Textarea value={value.post_build_commands_text} onChange={(event) => onChange({ post_build_commands_text: event.target.value })} rows={5} placeholder="ninja -C build fuzz_target" />
                  </FormField>
                  <FormField label="expected_outputs_text" description="一行一个预期产物，支持相对 build 根目录的路径。">
                    <Textarea value={value.expected_outputs_text} onChange={(event) => onChange({ expected_outputs_text: event.target.value })} rows={5} placeholder={"bin/server\nserver_example_basic_io"} />
                  </FormField>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="direct_commands" className="mt-4 space-y-4">
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">直接构建命令</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <FormField label="source_ref">
                    <Input value={value.source_ref} onChange={(event) => onChange({ source_ref: event.target.value })} placeholder="workspace://legacy-default/source/" />
                  </FormField>
                  <FormField label="build_root_ref">
                    <Input value={value.build_root_ref} onChange={(event) => onChange({ build_root_ref: event.target.value })} placeholder="workspace://legacy-default/build/" />
                  </FormField>
                  <FormField label="binary_output_ref" description="可选。留空时归档到当前协议的 binaries 类别目录；支持 workspace://<protocol>/... 或当前协议快捷写法，如 binaries/asan/。">
                    <Input value={value.binary_output_ref} onChange={(event) => onChange({ binary_output_ref: event.target.value })} placeholder="binaries/asan/ 或 workspace://legacy-default/binaries/asan/" />
                  </FormField>
                  <FormField label="command lines" description="前端会先做简单过滤，后端仍会再做强校验。">
                    <Textarea value={value.direct_commands_text} onChange={(event) => onChange({ direct_commands_text: event.target.value })} rows={10} placeholder={"cmake -S . -B build\ncmake --build build --parallel 4"} />
                  </FormField>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField label="expected_outputs_text">
                      <Textarea value={value.expected_outputs_text} onChange={(event) => onChange({ expected_outputs_text: event.target.value })} rows={5} placeholder={"bin/server\nserver_example_basic_io"} />
                    </FormField>
                    <FormField label="target io hint">
                      <Select value={value.target_io_hint} onValueChange={(next) => onChange({ target_io_hint: next as BuildTaskComposerState["target_io_hint"] })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{targetIoOptions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                      </Select>
                    </FormField>
                  </div>
                  {directCommandSanitize.droppedLines.length ? (
                    <div className="rounded-[var(--radius-lg)] border border-warning/25 bg-warning/10 px-3 py-3 text-sm text-warning-foreground">
                      <p className="font-medium">以下命令不会发送到后端：</p>
                      <div className="mt-2 space-y-1.5 text-xs">
                        {directCommandSanitize.droppedLines.map((item) => (
                          <div key={`${item.line}-${item.reason}`} className="break-all">{item.line} · {item.reason}</div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
