export interface SanitizedBuildCommandsResult {
  acceptedLines: string[];
  droppedLines: Array<{ line: string; reason: string }>;
}

const ALLOWED_PROGRAMS = new Set([
  "cmake",
  "make",
  "ninja",
  "meson",
  "bear",
  "clang",
  "clang++",
  "gcc",
  "g++",
]);

const ALLOWED_ENV_VARS = new Set([
  "CC",
  "CXX",
  "CFLAGS",
  "CXXFLAGS",
  "CPPFLAGS",
  "LDFLAGS",
  "AFL_USE_ASAN",
  "AFL_USE_UBSAN",
  "ASAN_OPTIONS",
  "UBSAN_OPTIONS",
]);

const FORBIDDEN_TOKENS = [";", "&&", "||", "|", ">", "<", "`", "$("];
const FORBIDDEN_WORDS = [
  "sudo",
  "su",
  "ssh",
  "curl",
  "wget",
  "python",
  "python3",
  "bash",
  "sh",
  "rm",
  "mv",
  "chmod",
  "chown",
  "docker",
  "systemctl",
];

function startsWithAllowedEnv(line: string): string {
  let rest = line.trim();
  while (rest) {
    const match = rest.match(/^([A-Za-z_][A-Za-z0-9_]*)=([^\s]+)\s*(.*)$/);
    if (!match) break;
    const [, key, , tail] = match;
    if (!ALLOWED_ENV_VARS.has(key)) {
      return `不允许的环境变量前缀：${key}`;
    }
    rest = tail.trim();
  }
  if (!rest) {
    return "缺少实际构建命令";
  }
  const program = rest.split(/\s+/)[0]?.trim();
  if (!program || !ALLOWED_PROGRAMS.has(program)) {
    return `不允许的构建程序：${program || "<empty>"}`;
  }
  return "";
}

export function sanitizeBuildCommandLines(input: string): SanitizedBuildCommandsResult {
  const acceptedLines: string[] = [];
  const droppedLines: Array<{ line: string; reason: string }> = [];

  for (const rawLine of input.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const forbiddenToken = FORBIDDEN_TOKENS.find((token) => line.includes(token));
    if (forbiddenToken) {
      droppedLines.push({ line, reason: `包含禁用连接或重定向符：${forbiddenToken}` });
      continue;
    }

    const lower = ` ${line.toLowerCase()} `;
    const forbiddenWord = FORBIDDEN_WORDS.find((word) => lower.includes(` ${word} `) || lower.startsWith(`${word} `));
    if (forbiddenWord) {
      droppedLines.push({ line, reason: `包含禁用工具：${forbiddenWord}` });
      continue;
    }

    const envOrProgramError = startsWithAllowedEnv(line);
    if (envOrProgramError) {
      droppedLines.push({ line, reason: envOrProgramError });
      continue;
    }

    acceptedLines.push(line);
  }

  return { acceptedLines, droppedLines };
}
