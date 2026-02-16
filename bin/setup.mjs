#!/usr/bin/env node

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { commandExists, writeMcpConfig, copySkill } from "./lib.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_SOURCE = join(__dirname, "..", "skills", "setup-ulink");

// ── Platform definitions ────────────────────────────────────────────
const PLATFORMS = {
  "claude-code": {
    name: "Claude Code",
    detect: () => commandExists("claude"),
    setup: installClaudePlugin,
  },
  cursor: {
    name: "Cursor",
    detect: () =>
      existsSync(join(homedir(), ".cursor")) || commandExists("cursor"),
    mcpConfig: join(homedir(), ".cursor", "mcp.json"),
    skillDir: join(homedir(), ".cursor", "skills", "setup-ulink"),
    setup: (cfg) => {
      writeMcpConfig(cfg.mcpConfig);
      copySkill(cfg.skillDir, SKILL_SOURCE);
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
      copySkill(cfg.skillDir, SKILL_SOURCE);
    },
  },
};

// ── Helpers ─────────────────────────────────────────────────────────

function installClaudePlugin() {
  console.log("  Installing ULink plugin (includes MCP server + onboarding skill)...");
  try {
    console.log("  Adding marketplace...");
    try {
      execFileSync(
        "claude",
        ["plugin", "marketplace", "add", "FlywheelStudio/ulink-ai-setup"],
        { stdio: "inherit" }
      );
    } catch {
      // Marketplace may already be added — continue
    }

    console.log("  Installing plugin...");
    execFileSync("claude", ["plugin", "install", "ulink-onboarding@ulink"], {
      stdio: "inherit",
    });
    console.log("  Plugin installed (MCP server + onboarding skill).");
  } catch {
    console.log("  Failed to install plugin automatically. You can install it manually:");
    console.log("    claude plugin marketplace add FlywheelStudio/ulink-ai-setup");
    console.log("    claude plugin install ulink-onboarding@ulink");
  }
}

// ── Interactive checkbox selector ───────────────────────────────────

/**
 * Shows an interactive checkbox list in the terminal.
 * Arrow keys to move, space to toggle, enter to confirm.
 *
 * @param {string} title - Header text shown above the list
 * @param {{ label: string, checked: boolean }[]} items - Selectable items
 * @returns {Promise<number[]>} Indices of selected items
 */
function checkbox(title, items) {
  return new Promise((resolve) => {
    const { stdin, stdout } = process;
    const wasRaw = stdin.isRaw;
    let cursor = 0;
    const checked = items.map((item) => item.checked);

    function render(clear) {
      if (clear) {
        // Move up to overwrite previous render (title + items + hint)
        stdout.write(`\x1b[${items.length + 2}A`);
      }
      stdout.write(`\x1b[2K  ${title}\n`);
      items.forEach((item, i) => {
        const check = checked[i] ? "\x1b[32m[x]\x1b[0m" : "[ ]";
        const pointer = i === cursor ? "\x1b[36m>\x1b[0m" : " ";
        stdout.write(`\x1b[2K  ${pointer} ${check} ${item.label}\n`);
      });
      stdout.write(`\x1b[2K  \x1b[2m(arrow keys to move, space to toggle, enter to confirm)\x1b[0m\n`);
    }

    render(false);

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf-8");

    function onData(key) {
      // Ctrl+C
      if (key === "\x03") {
        stdin.setRawMode(wasRaw || false);
        stdin.pause();
        stdin.removeListener("data", onData);
        process.exit(0);
      }

      // Enter
      if (key === "\r" || key === "\n") {
        stdin.setRawMode(wasRaw || false);
        stdin.pause();
        stdin.removeListener("data", onData);
        const selected = [];
        checked.forEach((c, i) => { if (c) selected.push(i); });
        resolve(selected);
        return;
      }

      // Space — toggle
      if (key === " ") {
        checked[cursor] = !checked[cursor];
        render(true);
        return;
      }

      // Arrow keys (escape sequences)
      if (key === "\x1b[A" || key === "k") {
        // Up
        cursor = (cursor - 1 + items.length) % items.length;
        render(true);
        return;
      }
      if (key === "\x1b[B" || key === "j") {
        // Down
        cursor = (cursor + 1) % items.length;
        render(true);
        return;
      }

      // 'a' — toggle all
      if (key === "a") {
        const allChecked = checked.every(Boolean);
        checked.fill(!allChecked);
        render(true);
        return;
      }
    }

    stdin.on("data", onData);
  });
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

  // Detect installed tools system-wide
  const detected = [];
  for (const [id, platform] of Object.entries(PLATFORMS)) {
    if (platform.detect()) {
      detected.push(id);
    }
  }

  // Build checkbox items — detected tools are checked by default
  const allIds = Object.keys(PLATFORMS);
  const items = allIds.map((id) => ({
    label: PLATFORMS[id].name + (detected.includes(id) ? " \x1b[2m(detected)\x1b[0m" : ""),
    checked: detected.includes(id),
  }));

  const title = detected.length > 0
    ? "Select which tools to set up:"
    : "No AI tools detected. Select which to set up:";

  const selectedIndices = await checkbox(title, items);

  if (selectedIndices.length === 0) {
    console.log("\n  No tools selected. Exiting.\n");
    return;
  }

  const selected = selectedIndices.map((i) => allIds[i]);

  console.log();

  // Install for each selected platform
  for (const id of selected) {
    const platform = PLATFORMS[id];
    console.log(`  Setting up ${platform.name}...`);
    console.log("  " + "\u2500".repeat(40));

    platform.setup(platform);

    console.log();
  }

  // Summary
  console.log("  Done! Next steps:");
  console.log("  " + "\u2500".repeat(40));
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

  console.log("  The AI will walk you through the rest \u2014");
  console.log("  detecting your app, connecting to ULink, and");
  console.log("  configuring deep links automatically.");
  console.log();
}

main().catch((err) => {
  console.error("Setup failed:", err.message);
  process.exit(1);
});
