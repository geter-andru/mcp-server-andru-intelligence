# Andru Revenue Intelligence MCP Server

Strategic revenue intelligence for technical SaaS founders. ICP scoring, persona profiling, competitive positioning, buyer journey mapping, and pre-meeting briefs — powered by 20 years of B2B sales wisdom.

## Installation

```bash
npm install -g @andru/mcp-server-intelligence
```

Or run directly:

```bash
ANDRU_API_KEY=sk_live_... npx @andru/mcp-server-intelligence
```

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANDRU_API_KEY` | Yes | — | Your Andru Platform API key |
| `ANDRU_API_URL` | No | `https://api.andru.ai` | API base URL |

Get your API key at [app.andru.ai/settings/api-keys](https://app.andru.ai/settings/api-keys).

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "andru-intelligence": {
      "command": "npx",
      "args": ["@andru/mcp-server-intelligence"],
      "env": {
        "ANDRU_API_KEY": "sk_live_your_key_here"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add andru-intelligence npx @andru/mcp-server-intelligence \
  --env ANDRU_API_KEY=sk_live_your_key_here
```

## Available Tools

| Tool | Description | Latency |
|------|-------------|---------|
| `get_icp_fit_score` | Score a company against your ICP criteria | <100ms |
| `get_persona_profile` | Look up buyer persona from ICP data | <50ms |
| `get_disqualification_signals` | 3-layer opportunity classification | <200ms |
| `get_messaging_framework` | MBTI-adapted messaging frameworks | <50ms |
| `get_competitive_positioning` | Competitive battlecards and positioning | <100ms |
| `classify_opportunity` | Full opportunity classification | <200ms |
| `get_account_plan` | Structured account plan with MEDDICC | <100ms |
| `get_capability_profile` | Machine-readable capability profile | <50ms |
| `get_evaluation_criteria` | 6-value alignment scoring | <100ms |
| `get_icp_profile` | Full Pure Signal ICP profile (5 layers) | <100ms |
| `discover_prospects` | AI-powered prospect discovery | 15-30s |
| `get_pre_brief` | Pre-meeting brief with talk track | 10-20s |
| `get_syndication_status` | CRM syndication status | <200ms |
| `trigger_syndication` | Trigger CRM syndication | 5-15s |
| `batch_fit_score` | Batch score up to 50 companies | <500ms |

## Available Resources

| URI | Description |
|-----|-------------|
| `andru://icp/profile` | Canonical ICP profile |
| `andru://pipeline/runs` | Pipeline run summaries |
| `andru://accounts` | Account and prospect data |

## How It Works

This MCP server is a thin proxy that authenticates with your Andru API key and forwards tool/resource requests to the Andru backend. All intelligence generation, ICP scoring, and data access happens server-side — the MCP server itself is stateless.

```
Claude Desktop/Code  →  MCP Server (stdio)  →  Andru API (HTTPS)
```

## A2A Protocol

Andru also supports the Agent-to-Agent (A2A) protocol for direct agent-to-agent communication. The AgentCard is available at:

```
https://api.andru.ai/.well-known/agent.json
```

## License

MIT
