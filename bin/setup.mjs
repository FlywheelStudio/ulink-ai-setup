#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync, mkdirSync, cpSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { createInterface } from "node:readline";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_SOURCE = join(__dirname, "..", "skills", "setup-ulink");

// ── MCP server config ───────────────────────────────────────────────
const MCP_ENTRY = {
  command: "npx",
  args: ["-y", "@ulinkly/mcp-server@latest"],
};

// ── Platform definitions ────────────────────────────────────────────
const PLATFORMS = {
  "claude-code": {
    name: "Claude Code",
    detect: () => commandExists("claude"),
    mcpConfig: null, // plugin bundles MCP via .mcp.json
    skillDir: null, // plugin bundles skill
    setup: installClaudePlugin,
  },
  cursor: {
    name: "Cursor",
    detect: () =>
      existsSync(join(homedir(), ".cursor")) ||
      commandExists("cursor"),
    mcpConfig: join(homedir(), ".cursor", "mcp.json"),
    skillDir: join(homedir(), ".cursor", "skills", "setup-ulink"),
    setup: (cfg) => {
      writeMcpConfig(cfg.mcpConfig);
      copySkill(cfg.skillDir);
    },
  },
  antigravity: {
    name: "Antigravity",
    detect: () =>
      existsSync(join(homedir(), ".gemini", "antigravity")) ||
      commandExists("antigravity"),
    mcpConfig: join(homedir(), ".gemini", "antigravity", "mcp_config.json"),
    skillDir: join(homedir(), ".gemini", "antigravity", "skills", "setup-ulink"),
    setup: (cfg) => {
      writeMcpConfig(cfg.mcpConfig);
      copySkill(cfg.skillDir);
    },
  },
};

// ── Helpers ─────────────────────────────────────────────────────────

function commandExists(cmd) {
  try {
    execSync(`which ${cmd} 2>/dev/null || where ${cmd} 2>nul`, {
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

function writeMcpConfig(configPath) {
  let config = { mcpServers: {} };
  try {
    const raw = readFileSync(configPath, "utf-8");
    config = JSON.parse(raw);
    if (!config.mcpServers) config.mcpServers = {};
  } catch {
    // File doesn't exist — start fresh
  }

  if (config.mcpServers.ulink) {
    log("  MCP server already configured, updating...");
  }

  config.mcpServers.ulink = MCP_ENTRY;
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
  log(`  MCP config written to ${configPath}`);
}

function copySkill(destDir) {
  if (!existsSync(SKILL_SOURCE)) {
    log("  Warning: skill source not found, skipping skill install");
    return;
  }
  mkdirSync(destDir, { recursive: true });
  cpSync(SKILL_SOURCE, destDir, { recursive: true });
  log(`  Skill installed to ${destDir}`);
}

function installClaudePlugin() {
  log("  Installing ULink plugin (includes MCP server + onboarding skill)...");
  try {
    // 1. Add the marketplace
    log("  Adding marketplace...");
    try {
      execSync(
        "claude plugin marketplace add FlywheelStudio/ulink-ai-setup",
        { stdio: "inherit" }
      );
    } catch {
      // Marketplace may already be added — continue
    }

    // 2. Install the plugin (bundles MCP server via .mcp.json)
    log("  Installing plugin...");
    execSync("claude plugin install ulink-onboarding@ulink", {
      stdio: "inherit",
    });
    log("  Plugin installed (MCP server + onboarding skill).");
  } catch {
    log("  Failed to install plugin automatically. You can install it manually:");
    log("    claude plugin marketplace add FlywheelStudio/ulink-ai-setup");
    log("    claude plugin install ulink-onboarding@ulink");
  }
}

function log(msg) {
  console.log(msg);
}

function prompt(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  console.log();
  console.log("  ULink AI Setup");
  console.log("  ==============");
  console.log();
  console.log("  This will configure the ULink MCP server and onboarding");
  console.log("  skill for your AI coding assistant.");
  console.log();

  // Detect platforms
  const detected = [];
  for (const [id, platform] of Object.entries(PLATFORMS)) {
    if (platform.detect()) {
      detected.push(id);
    }
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let selected = [];

  if (detected.length === 0) {
    console.log("  No supported AI tools detected.");
    console.log("  Supported: Claude Code, Cursor, Antigravity");
    console.log();
    console.log("  Choose which to configure:");
    console.log();
    const choices = Object.entries(PLATFORMS);
    choices.forEach(([, p], i) => console.log(`    ${i + 1}. ${p.name}`));
    console.log(`    ${choices.length + 1}. All`);
    console.log();

    const answer = await prompt(rl, "  Enter number(s), comma-separated: ");
    const nums = answer
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n));

    if (nums.includes(choices.length + 1)) {
      selected = choices.map(([id]) => id);
    } else {
      selected = nums
        .filter((n) => n >= 1 && n <= choices.length)
        .map((n) => choices[n - 1][0]);
    }
  } else if (detected.length === 1) {
    console.log(`  Detected: ${PLATFORMS[detected[0]].name}`);
    console.log();
    const answer = await prompt(rl, "  Set up ULink for this tool? (Y/n) ");
    if (answer.toLowerCase() === "n") {
      rl.close();
      return;
    }
    selected = detected;
  } else {
    console.log("  Detected:");
    detected.forEach((id) => console.log(`    - ${PLATFORMS[id].name}`));
    console.log();
    const answer = await prompt(
      rl,
      "  Set up ULink for all detected tools? (Y/n) "
    );
    if (answer.toLowerCase() === "n") {
      console.log();
      detected.forEach((id, i) =>
        console.log(`    ${i + 1}. ${PLATFORMS[id].name}`)
      );
      console.log();
      const pick = await prompt(rl, "  Enter number(s), comma-separated: ");
      const nums = pick
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n));
      selected = nums
        .filter((n) => n >= 1 && n <= detected.length)
        .map((n) => detected[n - 1]);
    } else {
      selected = detected;
    }
  }

  rl.close();

  if (selected.length === 0) {
    console.log("\n  No tools selected. Exiting.\n");
    return;
  }

  console.log();

  // Install for each selected platform
  for (const id of selected) {
    const platform = PLATFORMS[id];
    console.log(`  Setting up ${platform.name}...`);
    console.log("  ─".repeat(20));

    platform.setup(platform);

    console.log();
  }

  // Summary
  console.log("  Done! Next steps:");
  console.log("  ─".repeat(20));
  console.log();

  for (const id of selected) {
    const name = PLATFORMS[id].name;
    if (id === "claude-code") {
      console.log(`  ${name}:`);
      console.log("    1. Restart Claude Code");
      console.log('    2. Run /setup-ulink in your project');
      console.log();
    } else if (id === "cursor") {
      console.log(`  ${name}:`);
      console.log("    1. Restart Cursor");
      console.log('    2. Ask the agent: "setup ulink" in your project');
      console.log();
    } else if (id === "antigravity") {
      console.log(`  ${name}:`);
      console.log("    1. Restart Antigravity");
      console.log('    2. Ask the agent: "setup ulink" in your project');
      console.log();
    }
  }

  console.log("  The AI will walk you through the rest —");
  console.log("  detecting your app, connecting to ULink, and");
  console.log("  configuring deep links automatically.");
  console.log();
}

main().catch((err) => {
  console.error("Setup failed:", err.message);
  process.exit(1);
});
