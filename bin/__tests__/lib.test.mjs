import { describe, it, expect, vi, beforeEach } from "vitest";
import { commandExists, writeMcpConfig, copySkill, MCP_ENTRY } from "../lib.mjs";

// ── Mock node built-ins ─────────────────────────────────────────────
vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  cpSync: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(),
}));

vi.mock("node:os", () => ({
  homedir: vi.fn(() => "/mock-home"),
}));

import { existsSync, readFileSync, writeFileSync, mkdirSync, cpSync } from "node:fs";
import { execFileSync } from "node:child_process";

function enoentError(path) {
  const err = new Error(`ENOENT: no such file or directory, open '${path}'`);
  err.code = "ENOENT";
  return err;
}

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

// ── MCP_ENTRY ───────────────────────────────────────────────────────
describe("MCP_ENTRY", () => {
  it("has a pinned version (not @latest)", () => {
    expect(MCP_ENTRY).toEqual({
      command: "npx",
      args: ["-y", expect.stringMatching(/^@ulinkly\/mcp-server@\d+\.\d+\.\d+$/)],
    });
    // Must NOT use @latest — supply chain risk
    expect(MCP_ENTRY.args[1]).not.toContain("@latest");
  });
});

// ── commandExists ───────────────────────────────────────────────────
describe("commandExists", () => {
  it("returns true for allowed commands when execFileSync succeeds", () => {
    execFileSync.mockReturnValue(Buffer.from(""));
    expect(commandExists("node")).toBe(true);
    // Should use execFileSync (no shell) not execSync
    expect(execFileSync).toHaveBeenCalledWith(
      "which",
      ["node"],
      { stdio: "ignore" }
    );
  });

  it("returns false when execFileSync throws", () => {
    execFileSync.mockImplementation(() => {
      throw new Error("not found");
    });
    expect(commandExists("ulink")).toBe(false);
  });

  it("rejects commands not in the allowlist (prevents injection)", () => {
    // These should be rejected without even calling execFileSync
    expect(commandExists("rm")).toBe(false);
    expect(commandExists("cat")).toBe(false);
    expect(commandExists("; rm -rf /")).toBe(false);
    expect(commandExists("node; echo pwned")).toBe(false);
    expect(commandExists("")).toBe(false);
    // execFileSync should NOT have been called for disallowed commands
    expect(execFileSync).not.toHaveBeenCalled();
  });

  it("allows all expected commands", () => {
    execFileSync.mockReturnValue(Buffer.from(""));
    const allowed = ["ulink", "node", "npx", "npm", "flutter", "xcodebuild", "keytool", "curl", "claude", "cursor", "antigravity"];
    for (const cmd of allowed) {
      expect(commandExists(cmd)).toBe(true);
    }
  });
});

// ── writeMcpConfig ──────────────────────────────────────────────────
describe("writeMcpConfig", () => {
  it("creates a new config when file does not exist", () => {
    readFileSync.mockImplementation(() => {
      throw enoentError("/tmp/test/mcp.json");
    });

    writeMcpConfig("/tmp/test/mcp.json");

    expect(mkdirSync).toHaveBeenCalledWith("/tmp/test", { recursive: true });
    expect(writeFileSync).toHaveBeenCalledWith(
      "/tmp/test/mcp.json",
      JSON.stringify({ mcpServers: { ulink: MCP_ENTRY } }, null, 2) + "\n"
    );
  });

  it("merges into an existing config preserving other servers", () => {
    const existing = {
      mcpServers: { other: { command: "other-cmd", args: [] } },
      extraKey: true,
    };
    readFileSync.mockReturnValue(JSON.stringify(existing));

    writeMcpConfig("/mock-home/.cursor/mcp.json");

    const written = JSON.parse(writeFileSync.mock.calls[0][1]);
    expect(written.mcpServers.other).toEqual({ command: "other-cmd", args: [] });
    expect(written.mcpServers.ulink).toEqual(MCP_ENTRY);
    expect(written.extraKey).toBe(true);
  });

  it("redacts home directory in log output", () => {
    readFileSync.mockImplementation(() => {
      throw enoentError("/mock-home/.cursor/mcp.json");
    });

    writeMcpConfig("/mock-home/.cursor/mcp.json");

    // Should log with ~ instead of full home path
    expect(console.log).toHaveBeenCalledWith(
      "  MCP config written to ~/.cursor/mcp.json"
    );
  });

  it("overwrites existing ulink entry and logs updating message", () => {
    const existing = {
      mcpServers: { ulink: { command: "old", args: [] } },
    };
    readFileSync.mockReturnValue(JSON.stringify(existing));

    writeMcpConfig("/tmp/mcp.json");

    expect(console.log).toHaveBeenCalledWith(
      "  MCP server already configured, updating..."
    );
    const written = JSON.parse(writeFileSync.mock.calls[0][1]);
    expect(written.mcpServers.ulink).toEqual(MCP_ENTRY);
  });

  it("creates parent directories recursively", () => {
    readFileSync.mockImplementation(() => {
      throw enoentError("/deep/nested/dir/mcp.json");
    });

    writeMcpConfig("/deep/nested/dir/mcp.json");

    expect(mkdirSync).toHaveBeenCalledWith("/deep/nested/dir", { recursive: true });
  });

  it("warns and starts fresh when config file has invalid JSON", () => {
    readFileSync.mockReturnValue("not valid json {{{");

    writeMcpConfig("/tmp/mcp.json");

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("Warning: could not parse")
    );
    const written = JSON.parse(writeFileSync.mock.calls[0][1]);
    expect(written.mcpServers.ulink).toEqual(MCP_ENTRY);
  });

  it("adds mcpServers key if existing config lacks it", () => {
    readFileSync.mockReturnValue(JSON.stringify({ someOther: "data" }));

    writeMcpConfig("/tmp/mcp.json");

    const written = JSON.parse(writeFileSync.mock.calls[0][1]);
    expect(written.mcpServers).toBeDefined();
    expect(written.mcpServers.ulink).toEqual(MCP_ENTRY);
    expect(written.someOther).toBe("data");
  });
});

// ── copySkill ───────────────────────────────────────────────────────
describe("copySkill", () => {
  it("copies recursively when source exists", () => {
    existsSync.mockReturnValue(true);

    copySkill("/mock-home/skills", "/source/skills");

    expect(mkdirSync).toHaveBeenCalledWith("/mock-home/skills", { recursive: true });
    expect(cpSync).toHaveBeenCalledWith("/source/skills", "/mock-home/skills", {
      recursive: true,
    });
    // Should redact home directory in log output
    expect(console.log).toHaveBeenCalledWith(
      "  Skill installed to ~/skills"
    );
  });

  it("creates destination directory before copying", () => {
    existsSync.mockReturnValue(true);

    copySkill("/new/dir/skills", "/source/skills");

    // mkdirSync should be called before cpSync
    const mkdirOrder = mkdirSync.mock.invocationCallOrder[0];
    const cpOrder = cpSync.mock.invocationCallOrder[0];
    expect(mkdirOrder).toBeLessThan(cpOrder);
  });

  it("logs warning and skips when source is missing", () => {
    existsSync.mockReturnValue(false);

    copySkill("/dest/skills", "/missing/source");

    expect(console.log).toHaveBeenCalledWith(
      "  Warning: skill source not found, skipping skill install"
    );
    expect(mkdirSync).not.toHaveBeenCalled();
    expect(cpSync).not.toHaveBeenCalled();
  });
});
