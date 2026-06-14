import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const serverEntry = path.resolve(root, "server.mjs");
const distDir = path.resolve(root, "dist");
const configPath = path.resolve(root, "sea-config.json");
const blobPath = path.resolve(root, "dist", "front-xe-sea-prep.blob");

if (!existsSync(distDir)) {
  console.error("dist/ not found. Run npm run build first.");
  process.exit(1);
}

const config = {
  main: serverEntry,
  output: blobPath,
  disableExperimentalSEAWarning: true,
};

writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

console.log("SEA config generated: sea-config.json");
console.log("Template prepared for Node SEA, but no binary patching was performed.");
console.log("Next manual steps depend on your Node version and platform.");
console.log("See docs/performance-deployment.md.");
