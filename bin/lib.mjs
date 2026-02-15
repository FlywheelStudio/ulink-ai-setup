import { existsSync, readFileSync, writeFileSync, mkdirSync, cpSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname } from "node:path";
import { homedir } from "node:os";

// ── MCP server config ───────────────────────────────────────────────
export const MCP_ENTRY = {
  command: "npx",
  args: ["-y", "@ulinkly/mcp-server@0.1.11"],
};

// ── Helpers ─────────────────────────────────────────────────────────

// Allowed command names for commandExists — prevents shell injection
const ALLOWED_COMMANDS = new Set(["ulink", "node", "npx", "npm", "flutter", "xcodebuild", "keytool", "curl"]);

export function commandExists(cmd) {
  if (!ALLOWED_COMMANDS.has(cmd)) {
    return false;
  }
  try {
    // Use execFileSync (no shell) to prevent command injection
    const whichCmd = process.platform === "win32" ? "where" : "which";
    execFileSync(whichCmd, [cmd], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function redactHome(filepath) {
  const home = homedir();
  return filepath.startsWith(home) ? filepath.replace(home, "~") : filepath;
}

export function writeMcpConfig(configPath) {
  let config = { mcpServers: {} };
  try {
    const raw = readFileSync(configPath, "utf-8");
    config = JSON.parse(raw);
    if (!config.mcpServers) config.mcpServers = {};
  } catch {
    // File doesn't exist — start fresh
  }

  if (config.mcpServers.ulink) {
    console.log("  MCP server already configured, updating...");
  }

  config.mcpServers.ulink = MCP_ENTRY;
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
  console.log(`  MCP config written to ${redactHome(configPath)}`);
}

export function copySkill(destDir, skillSource) {
  if (!existsSync(skillSource)) {
    console.log("  Warning: skill source not found, skipping skill install");
    return;
  }
  mkdirSync(destDir, { recursive: true });
  cpSync(skillSource, destDir, { recursive: true });
  console.log(`  Skill installed to ${redactHome(destDir)}`);
}
