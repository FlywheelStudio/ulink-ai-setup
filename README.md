# ULink AI Setup

> One-command AI-assisted setup for ULink deep linking. Works with Claude Code, Cursor, Codex, OpenCode, and 50+ other AI coding tools.

## Quick Start

```bash
npx skills add https://ulink.ly
```

Installs the ULink onboarding skill via the [open agent-skills CLI](https://github.com/vercel-labs/skills). Then open your AI assistant in your project directory and ask it to **"setup ulink"** — the agent walks you through detecting your platform, connecting to your ULink project, configuring dashboard settings, editing local files, and verifying deep links.

> **Heads up — keep the `https://`.** The agent-skills CLI parses bare hostnames as GitHub shorthand. `npx skills add ulink.ly` will fail with a clone error; `npx skills add https://ulink.ly` triggers the well-known endpoint correctly.

## What the AI Does

1. **Detect project** — scans your directory to identify Flutter, iOS, or Android
2. **Connect to ULink** — authenticates via MCP and connects to your ULink project
3. **Select domain** — pick an existing domain or create a new one
4. **Configure platforms** — sets up Associated Domains (iOS), App Links (Android), or both (Flutter)
5. **Edit local files** — proposes changes and applies them only after your approval
6. **Verify** — runs the ULink CLI to validate your deep link configuration
7. **Summarize** — shows everything that was configured and next steps

## Alternative installs

### Install from GitHub

```bash
npx skills add FlywheelStudio/ulink-ai-setup
```

Same skill, fetched from this repo directly. Useful if you want to pin to a specific commit.

### Legacy installer (Claude Code, Cursor, Antigravity only)

```bash
npx @ulinkly/setup
```

Older one-liner with narrower agent support. Prefer `npx skills add https://ulink.ly` above for the broader agent-skills ecosystem.

### Manual setup per agent

The [`skills/setup-ulink/SKILL.md`](skills/setup-ulink/SKILL.md) file is a standard agent-skills SKILL.md — copy it into your agent's skills directory, and add the ULink MCP server to that agent's MCP config:

```json
{
  "mcpServers": {
    "ulink": {
      "command": "npx",
      "args": ["-y", "@ulinkly/mcp-server@0.1.17"]
    }
  }
}
```

Common MCP config locations:

- **Claude Code** — `~/.claude.json` (or per-project `.mcp.json`)
- **Cursor** — `~/.cursor/mcp.json`
- **Antigravity** — `~/.gemini/antigravity/mcp_config.json`
- **Other agents** — see your agent's MCP config docs

Restart the agent after editing, then ask: **"setup ulink"**.

### Claude Code marketplace

```bash
claude plugin marketplace add FlywheelStudio/ulink-ai-setup
claude plugin install ulink-onboarding@ulink
```

Then run `/setup-ulink` in your project. Equivalent to the one-liner above for Claude Code users.

## Where the skill is published

| Channel | Install command |
|---|---|
| `ulink.ly` well-known endpoint | `npx skills add https://ulink.ly` |
| GitHub | `npx skills add FlywheelStudio/ulink-ai-setup` |
| npm | `npx @ulinkly/setup` *(legacy installer)* |
| Claude Code marketplace | `claude plugin install ulink-onboarding@ulink` |

## ULink CLI

The skill uses the [ULink CLI](https://docs.ulink.ly/getting-started/overview) for verification. If not installed, the skill will offer to install it for you:

```bash
curl -fsSL https://ulink.ly/install.sh | bash
```

## Supported Platforms

- **Flutter** — detects `pubspec.yaml`, configures iOS + Android
- **Native iOS** — detects Xcode projects, sets up Associated Domains and URL schemes
- **Native Android** — detects Gradle projects, sets up App Links and intent filters

## Links

- [Documentation](https://docs.ulink.ly/getting-started/ai-setup)
- [ULink dashboard](https://ulink.ly/dashboard)
- [Open agent-skills CLI (vercel-labs/skills)](https://github.com/vercel-labs/skills)

## License

MIT
