import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { logError, logInfo, logWarn } from "./logger.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const viteBin = path.join(rootDir, "node_modules", "vite", "bin", "vite.js");

const children = new Map();
let stopping = false;

function spawnNode(name, args, env = {}) {
  const child = spawn(process.execPath, args, {
    cwd: rootDir,
    stdio: "inherit",
    shell: false,
    env: {
      ...process.env,
      ...env,
    },
  });

  children.set(name, child);

  child.on("exit", (code, signal) => {
    children.delete(name);

    if (stopping) return;

    if (signal) {
      logWarn("dev", "exit", `${name} stopped by ${signal}`);
      stopAll(0);
      return;
    }

    if (code && code !== 0) {
      logError("dev", "exit", `${name} exited with code ${code}`);
      stopAll(code);
    }
  });

  return child;
}

function stopAll(code = 0) {
  if (stopping) return;
  stopping = true;

  logInfo("dev", "stop", "stopping services");

  for (const child of children.values()) {
    try {
      if (!child.killed) child.kill("SIGTERM");
    } catch {
      // ignore shutdown errors
    }
  }

  setTimeout(() => {
    process.exit(code);
  }, 250);
}

process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));

if (!existsSync(viteBin)) {
  logError("dev", "missing", "vite is not installed", "run npm install first");
  process.exit(1);
}

logInfo("dev", "launch", "bff");
spawnNode("bff", ["server/server.mjs"]);

logInfo("dev", "launch", "vite");
spawnNode("vite", [viteBin, "--host", process.env.VITE_DEV_HOST ?? "0.0.0.0"]);