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
  execSync: vi.fn(),
}));

import { existsSync, readFileSync, writeFileSync, mkdirSync, cpSync } from "node:fs";
import { execSync } from "node:child_process";

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
});

// ── MCP_ENTRY ───────────────────────────────────────────────────────
describe("MCP_ENTRY", () => {
  it("has the expected command and args", () => {
    expect(MCP_ENTRY).toEqual({
      command: "npx",
      args: ["-y", "@ulinkly/mcp-server@latest"],
    });
  });
});

// ── commandExists ───────────────────────────────────────────────────
describe("commandExists", () => {
  it("returns true when execSync succeeds", () => {
    execSync.mockReturnValue(Buffer.from(""));
    expect(commandExists("node")).toBe(true);
    expect(execSync).toHaveBeenCalledWith(
      "which node 2>/dev/null || where node 2>nul",
      { stdio: "ignore" }
    );
  });

  it("returns false when execSync throws", () => {
    execSync.mockImplementation(() => {
      throw new Error("not found");
    });
    expect(commandExists("nonexistent")).toBe(false);
  });
});

// ── writeMcpConfig ──────────────────────────────────────────────────
describe("writeMcpConfig", () => {
  it("creates a new config when file does not exist", () => {
    readFileSync.mockImplementation(() => {
      throw new Error("ENOENT");
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

    writeMcpConfig("/home/user/.cursor/mcp.json");

    const written = JSON.parse(writeFileSync.mock.calls[0][1]);
    expect(written.mcpServers.other).toEqual({ command: "other-cmd", args: [] });
    expect(written.mcpServers.ulink).toEqual(MCP_ENTRY);
    expect(written.extraKey).toBe(true);
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
      throw new Error("ENOENT");
    });

    writeMcpConfig("/deep/nested/dir/mcp.json");

    expect(mkdirSync).toHaveBeenCalledWith("/deep/nested/dir", { recursive: true });
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

    copySkill("/dest/skills", "/source/skills");

    expect(mkdirSync).toHaveBeenCalledWith("/dest/skills", { recursive: true });
    expect(cpSync).toHaveBeenCalledWith("/source/skills", "/dest/skills", {
      recursive: true,
    });
    expect(console.log).toHaveBeenCalledWith(
      "  Skill installed to /dest/skills"
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
