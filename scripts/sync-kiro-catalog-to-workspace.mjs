/**
 * OPTIONAL — only if you want a copy of `.kiro/agents` + steering inside another repo for editing.
 * The web UI + bridge do NOT require this: agent prompts are inlined from this repo’s catalog;
 * the UI “target workspace” is only Kiro’s cwd (MCP, .env, outputs).
 *
 * Usage:
 *   node scripts/sync-kiro-catalog-to-workspace.mjs C:\OtherRepo
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NUI_ROOT = path.resolve(__dirname, "..");

const targetArg = process.argv[2];
if (!targetArg?.trim()) {
  console.error("Usage: node scripts/sync-kiro-catalog-to-workspace.mjs <target-workspace-root>");
  process.exit(1);
}

const targetRoot = path.resolve(targetArg.trim());
const srcAgents = path.join(NUI_ROOT, ".kiro", "agents");
const srcSteering = path.join(NUI_ROOT, ".kiro", "steering");
const dstAgents = path.join(targetRoot, ".kiro", "agents");
const dstSteering = path.join(targetRoot, ".kiro", "steering");

if (!fs.existsSync(srcAgents)) {
  console.error(`Missing catalog: ${srcAgents}`);
  process.exit(1);
}
if (!fs.existsSync(srcSteering)) {
  console.error(`Missing steering: ${srcSteering}`);
  process.exit(1);
}

fs.mkdirSync(dstAgents, { recursive: true });
fs.mkdirSync(dstSteering, { recursive: true });

let nAgents = 0;
for (const f of fs.readdirSync(srcAgents)) {
  if (!f.endsWith(".json")) continue;
  fs.copyFileSync(path.join(srcAgents, f), path.join(dstAgents, f));
  nAgents += 1;
}

let nSteer = 0;
for (const f of fs.readdirSync(srcSteering)) {
  if (!f.endsWith(".md")) continue;
  fs.copyFileSync(path.join(srcSteering, f), path.join(dstSteering, f));
  nSteer += 1;
}

console.log(
  `[sync-kiro-catalog] ${nAgents} agent JSON → ${dstAgents}\n` +
    `[sync-kiro-catalog] ${nSteer} steering files → ${dstSteering}\n` +
    `[sync-kiro-catalog] target workspace: ${targetRoot}`
);
