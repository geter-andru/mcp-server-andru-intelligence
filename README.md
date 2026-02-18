# Andru Revenue Intelligence MCP Server

The revenue intelligence system that technical founders wish existed when they were Googling "how to interview a VP Sales" at 2 AM. ICP scoring, buyer persona profiling, competitive battlecards, MBTI-adapted messaging, and pre-meeting briefs — built on 20 years of B2B sales pattern data.

Works immediately — no pipeline data required. Describe your product and Andru delivers pre-built buyer intelligence in seconds. Run a full pipeline for intelligence tuned to your specific market.

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

### Qualification & Scoring

| Tool | What It Does | Latency |
|------|-------------|---------|
| `get_icp_fit_score` | Tells you in seconds whether a company is worth your time — scores across 5 dimensions against who actually buys from you | <100ms |
| `batch_fit_score` | Score up to 50 companies at once — tier and score so you can rank a list in under a second | <500ms |
| `classify_opportunity` | Full read on a deal — fit score, persona match, risk flags, disqualification check, and a verdict: pursue, pause, or walk away | <200ms |
| `get_disqualification_signals` | Find out if you're wasting time on a deal that won't close — three layers of signal and a clear recommendation | <200ms |

### Buyer Intelligence

| Tool | What It Does | Latency |
|------|-------------|---------|
| `get_persona_profile` | Look up who you're actually talking to — what they care about at 7 AM, why they'll say no, and exactly how to open | <50ms |
| `get_messaging_framework` | Get the exact words to use — MBTI-adapted so the analytical CTO and the results-driven VP Sales get different versions | <50ms |
| `get_competitive_positioning` | Battlecard for a specific competitor — where you win, where they'll attack, which questions to plant | <100ms |
| `get_evaluation_criteria` | Scores how well you match what a buyer needs — across pain coverage, outcome clarity, capability fit, and 3 more dimensions | <100ms |

### Account & Pipeline

| Tool | What It Does | Latency |
|------|-------------|---------|
| `get_account_plan` | Builds the account plan you'd normally spend a weekend on — stakeholder map, MEDDICC gaps, and the unified story | <100ms |
| `get_icp_profile` | Returns everything Andru knows about your ideal customer — all 5 intelligence layers and the patterns that predict churn | <100ms |
| `get_capability_profile` | Machine-readable snapshot of what your product does and who it's for — designed for buyer-side evaluation | <50ms |

### Prospecting & Meetings

| Tool | What It Does | Latency |
|------|-------------|---------|
| `discover_prospects` | Finds real companies showing the same buying signals your best customers showed — searches the web live | 15-30s |
| `get_pre_brief` | Pre-call prep so you don't walk in cold — talk track, discovery questions, anticipated objections, and the one thing to get done | 10-20s |

### CRM Syndication

| Tool | What It Does | Latency |
|------|-------------|---------|
| `get_syndication_status` | Shows whether your CRM has your current intelligence or is running on stale data | <200ms |
| `trigger_syndication` | Pushes latest intelligence into your CRM — detects which platforms are out of date and updates only what's stale | 5-15s |

## Cold-Start Support

7 tools work without any pipeline data — just describe your product:

- `get_icp_fit_score`, `get_persona_profile`, `get_messaging_framework`, `get_competitive_positioning`, `get_evaluation_criteria`, `classify_opportunity`, `get_disqualification_signals`

Pass `productDescription`, `vertical`, and `targetRole` parameters, or let Claude infer them from your conversation. The tools use pre-built buyer intelligence (5 named buyer personas, 3 vertical segment profiles) to deliver results immediately.

Run a full Pure Signal ICP pipeline at [app.andru.ai](https://app.andru.ai) for intelligence tuned to your specific product and market.

## Available Resources

| URI | Description |
|-----|-------------|
| `andru://icp/profile` | The complete profile of the companies you should actually be selling to — 5 intelligence layers, 7 critical questions, and churn prediction patterns |
| `andru://pipeline/runs` | All your pipeline runs and what each one produced — ICP layers, lead gen strategy, account plans, and deck output |
| `andru://accounts` | Your tracked accounts — tier, pipeline value, stakeholder count, and account plan status |

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
