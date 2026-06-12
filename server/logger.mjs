const useColor = !process.env.NO_COLOR && Boolean(process.stdout.isTTY);

const codes = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
};

function color(code, value) {
  if (!useColor) return value;
  return `${codes[code] ?? ""}${value}${codes.reset}`;
}

export function cleanMessage(value) {
  if (value instanceof Error) {
    return cleanMessage(value.message || value.name || "Error");
  }

  if (typeof value === "object" && value !== null) {
    return "[object redacted]";
  }

  return String(value ?? "")
    .replace(/(authorization|cookie|csrf|session|token|password|node_secret|secret)=\S+/gi, "$1=<redacted>")
    .replace(/(authorization|cookie|csrf|session|token|password|node_secret|secret):\s*\S+/gi, "$1: <redacted>")
    .replace(/\s+/g, " ")
    .trim();
}

function wrap(text, prefixLength) {
  const width = Math.max(72, Math.min(process.stdout.columns || 100, 140));
  const max = Math.max(32, width - prefixLength);
  const words = cleanMessage(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > max && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }

  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function lineColor(level, event) {
  if (level === "error") return "red";
  if (level === "warn") return "yellow";
  if (event === "ready" || event === "listen") return "green";
  if (event === "auth" || event === "login" || event === "logout") return "magenta";
  if (event === "proxy" || event === "ws" || event === "http" || event === "node") return "cyan";
  return "cyan";
}

function writeLine(scope, event, message = "", detail = "", level = "info") {
  const scopeText = String(scope || "bff").padStart(5);
  const eventText = String(event || "info").padEnd(7);
  const prefixRaw = `  ${scopeText}  ${eventText} `;
  const paint = lineColor(level, event);
  const prefix = `  ${color("dim", scopeText)}  ${color(paint, eventText)} `;
  const body = [message, detail].filter(Boolean).map(cleanMessage).join(" ");
  const lines = wrap(body, prefixRaw.length);

  console.log(prefix + lines[0]);
  for (const extra of lines.slice(1)) {
    console.log(" ".repeat(prefixRaw.length) + color("dim", extra));
  }
}

export function logReady(message, detail = "") {
  writeLine("bff", "ready", message, detail, "info");
}

export function logInfo(scope, event, message, detail = "") {
  writeLine(scope, event, message, detail, "info");
}

export function logWarn(scope, event, message, detail = "") {
  writeLine(scope, event, message, detail, "warn");
}

export function logError(scope, event, message, detail = "") {
  writeLine(scope, event, message, detail, "error");
}