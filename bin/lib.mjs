import { existsSync, readFileSync, writeFileSync, mkdirSync, cpSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname } from "node:path";

// ── MCP server config ───────────────────────────────────────────────
export const MCP_ENTRY = {
  command: "npx",
  args: ["-y", "@ulinkly/mcp-server@latest"],
};

// ── Helpers ─────────────────────────────────────────────────────────

export function commandExists(cmd) {
  try {
    execSync(`which ${cmd} 2>/dev/null || where ${cmd} 2>nul`, {
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
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
  console.log(`  MCP config written to ${configPath}`);
}

export function copySkill(destDir, skillSource) {
  if (!existsSync(skillSource)) {
    console.log("  Warning: skill source not found, skipping skill install");
    return;
  }
  mkdirSync(destDir, { recursive: true });
  cpSync(skillSource, destDir, { recursive: true });
  console.log(`  Skill installed to ${destDir}`);
}
