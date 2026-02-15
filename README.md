# ULink AI Setup

> Set up ULink deep linking with one command using Claude Code, Cursor, or Antigravity.

## Quick Start

```bash
npx @ulinkly/setup
```

This detects your AI coding tools and configures the ULink MCP server + onboarding skill automatically. Then open your AI assistant in your project and ask it to **"setup ulink"**.

## Manual Setup

### Claude Code

```bash
# Install the plugin (includes MCP server + onboarding skill)
claude plugin marketplace add FlywheelStudio/ulink-ai-setup
claude plugin install ulink-onboarding@ulink
```

Restart Claude Code, then run `/setup-ulink` in your project.

### Cursor

**1. Add MCP server** — add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "ulink": {
      "command": "npx",
      "args": ["-y", "@ulinkly/mcp-server@0.1.9"]
    }
  }
}
```

**2. Install skill** — copy `skills/setup-ulink/` to `~/.cursor/skills/setup-ulink/`.

Restart Cursor, then ask the agent: **"setup ulink"**.

### Antigravity

**1. Add MCP server** — add to `~/.gemini/antigravity/mcp_config.json`:

```json
{
  "mcpServers": {
    "ulink": {
      "command": "npx",
      "args": ["-y", "@ulinkly/mcp-server@0.1.9"]
    }
  }
}
```

**2. Install skill** — copy `skills/setup-ulink/` to `~/.gemini/antigravity/skills/setup-ulink/`.

Restart Antigravity, then ask the agent: **"setup ulink"**.

## What the AI Does

1. **Detect project** — scans your directory to identify Flutter, iOS, or Android
2. **Connect to ULink** — authenticates via MCP and connects to your ULink project
3. **Select domain** — pick an existing domain or create a new one
4. **Configure platforms** — sets up Associated Domains (iOS), App Links (Android), or both (Flutter)
5. **Edit local files** — proposes changes and applies them only after your approval
6. **Verify** — runs the ULink CLI to validate your deep link configuration
7. **Summarize** — shows everything that was configured and next steps

## ULink CLI

The AI uses the CLI for verification. Install it with:

```bash
curl -fsSL https://ulink.ly/install.sh | bash
```

## Supported Platforms

- Flutter
- Native iOS
- Native Android

## License

MIT
