# ULink Onboarding Plugin for Claude Code

Guides you through integrating ULink deep linking into your iOS, Android, or Flutter project — directly from Claude Code.

## Install

```bash
claude plugin install ulink-onboarding
```

## Prerequisites

### ULink MCP Server (bundled)

The MCP server is bundled with this plugin and starts automatically. If it doesn't activate, add it manually:

```bash
claude mcp add ulink -- npx -y @ulinkly/mcp-server@latest
```

### ULink CLI

```bash
curl -fsSL https://ulink.ly/install.sh | bash
```

## Usage

Run the following command in your project directory:

```
/setup-ulink
```

## What it does

1. **Detect project** — Scans your working directory to identify the project type (Flutter, iOS, or Android) and its structure.
2. **Connect to ULink** — Authenticates with the ULink platform via the MCP server to access your account and projects.
3. **Select domain** — Lets you pick an existing ULink domain or create a new one for your deep links.
4. **Configure platforms** — Sets up platform-specific configuration (Associated Domains for iOS, App Links for Android, or both for Flutter).
5. **Edit local files with confirmation** — Proposes changes to your project files (entitlements, manifests, config files) and applies them only after your approval.
6. **Verify with CLI** — Runs the ULink CLI to validate that your deep link configuration is correct and working.
7. **Summarize** — Provides a complete summary of all changes made and next steps to start using deep links in your app.

## Supported Platforms

- Flutter
- Native iOS
- Native Android
