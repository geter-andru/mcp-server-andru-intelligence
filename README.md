# Andru MCP Server

An enterprise buyer specialist that already knows your buyers. Your agent builds the assets technical founders sell with, and prepares them for real buyer conversations.

Andru is an enterprise buyer specialist for complex B2B deals: it already knows your buyers and scores deals the same way every time. Give your agent 30 tools and a catalog of 139 assets, built from what Andru knows about your company and buyers. Start with:

- **Pure Signal Market Resonance:** who needs your product most, and why now (every account starts with a free cold-read ICP)
- **Buying Committee Navigation:** the committee, its objectors and the order to engage them
- **Champion Enablement Kit:** what your champion needs for the meetings you're not in
- **Technical Sales Translator:** technical features in the language buyers pay for
- **Executive Business Case Builder:** the case your champion takes to the people who sign

Prepare for real conversations with buyer role-play and pre-meeting briefs (up to 10 a day). Lookups are free. Assets and role-play draw on one prepaid wallet, at the same prices as the platform: andru-ai.com/pricing.

Build any of them with `generate_asset` (for example `generate_asset` with `asset: "Champion Enablement Kit"`), and find the rest with `list_assets`.

## Installation

```bash
npm install -g mcp-server-andru-intelligence
```

Or run directly:

```bash
npx mcp-server-andru-intelligence
```

Or connect to the hosted server at https://mcp.andru-ai.com/mcp.

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANDRU_API_KEY` | No | — | Your Andru API key. Without one, your agent can sign you up from the conversation. |
| `ANDRU_API_URL` | No | `https://api.andru-ai.com` | API base URL. The default is Andru's production API; you don't need to change it. Your key is only sent to `*.andru-ai.com` or this machine; set `ANDRU_ALLOW_CUSTOM_API_URL=true` to use another host on purpose. |

Get your API key at [platform.andru-ai.com/settings/developer](https://platform.andru-ai.com/settings/developer).

No key yet? Start the server without one and ask your agent to sign you up. It calls signup_start with your email; you get a code and an Approve button; the session then uses the new key.

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "andru-intelligence": {
      "command": "npx",
      "args": ["mcp-server-andru-intelligence"]
    }
  }
}
```

Already have a key? Add `"env": { "ANDRU_API_KEY": "<your key>" }`. Without one, ask your agent to sign you up.

### Claude Code

```bash
claude mcp add andru-intelligence npx mcp-server-andru-intelligence
```

Already have a key? Add `--env ANDRU_API_KEY=<your key>`.

## Available Tools

### Qualification & Scoring

| Tool | What It Does | Latency |
|------|-------------|---------|
| `get_icp_fit_score` | Tells you in seconds whether a company is worth your time — scores across 5 dimensions against who actually buys from you | <100ms |
| `batch_fit_score` | Score up to 50 companies at once — tier and score so you can rank a list in under a second | <500ms |
| `classify_opportunity` | Full read on a deal — fit score, persona match, risk flags, disqualification check, and a verdict: pursue, pause, or walk away | <200ms |
| `get_disqualification_signals` | Find out if you're wasting time on a deal that won't close — three layers of signal and a clear recommendation | <200ms |

### Stakeholder Understanding

| Tool | What It Does | Latency |
|------|-------------|---------|
| `get_persona_profile` | Look up who you're actually talking to — what they care about at 7 AM, what they need before they say yes, and exactly how to open | <50ms |
| `get_messaging_framework` | Your story in one buyer's terms: what they respond to, the problem in their words, and the concerns they need answered, built from your ICP | <50ms |
| `get_competitive_positioning` | When a buyer is weighing another option: where it fits them better, where yours does, and questions that help them decide for themselves | <100ms |
| `get_evaluation_criteria` | Scores how well you match what a buyer needs — across pain coverage, outcome clarity, capability fit, and 3 more dimensions | <100ms |

### Account & Pipeline

| Tool | What It Does | Latency |
|------|-------------|---------|
| `get_account_plan` | Builds the account plan in your Andru account and returns its link with a short summary. A plan from the last 30 days comes back at once. Returns a job_id; `get_asset` collects it | 1–3 min |
| `get_icp_profile` | Your ICP, built from what you sell: the buyers who decide, what each is measured on and needs answered, the signals a company is ready to change, and who isn't a fit | <100ms |

### Prospecting & Meetings

| Tool | What It Does | Latency |
|------|-------------|---------|
| `discover_prospects` | Finds real companies likely to buy your product — searches the web live and links the page behind every piece of evidence | up to ~2 min |
| `get_pre_brief` | What the meeting is for and what each person in the room likely thinks going in, built from your buying committee and labelled as assumptions to correct | 10-20s |

### Founder Tools

| Tool | What It Does | Latency |
|------|-------------|---------|
| `get_sales_blueprint` | First sales hire blueprint — JD, comp model, interview questions, and 90-day ramp plan for the stage you're at | 10-20s |
| `get_thesis_match` | Up to 3 VC firms investing now in companies like yours, each with a recent deal or stated focus and a link to the page it came from | ~30s |
| `simulate_buyer_persona` | Prepare for a meeting with the people who'll be in the room: a brief of what each person likely thinks going in (10 a day), then a Deal Prep session where Andru plays them, one or several at once | 5-15s |


### What Andru Remembers

| Tool | What It Does | Latency |
|------|-------------|---------|
| `get_revenue_memory` | Query what Andru has learned about your business over time: metrics, deal patterns, account history, decisions | varies |
| `log_revenue_insight` | Save an insight, decision, metric or pattern to Andru's memory; earlier values are versioned automatically | varies |
| `get_founder_context` | Everything Andru knows about you, organised by memory type | varies |
| `get_memory_history` | How a metric, deal stage or priority has changed over time ("What was my MRR 3 months ago?") | varies |

### Market & Portfolio Intelligence

| Tool | What It Does | Latency |
|------|-------------|---------|
| `get_market_signals` | What's moving in your market now: ranked signals, each with its buyer impact and a recommended action | varies |
| `assess_company_readiness` | Scores a company's Revenue Readiness Index (0–100) from its operating metrics, with its #1 growth constraint | varies |
| `get_portfolio_readiness_rollup` | A board-ready scorecard of every portfolio company by Revenue Readiness Index, with aggregates | varies |
| `generate_portfolio_brief` | A brief on your portfolio's sales activity for a period, with sources (not a financial or performance report) | a few min |

### Consultation

| Tool | What It Does | Latency |
|------|-------------|---------|
| `consult_agent` | Ask one of Andru's domain expert agents in natural language and get a domain-scoped answer | varies |

### Asset Catalog

| Tool | What It Does |
|------|-------------|
| `list_assets` | Search Andru's catalog of 139 assets, from enterprise deals to hiring, fundraising and buying: what each is, its business outcome, and whether it can be generated today |
| `generate_asset` | Generate any catalog asset from everything Andru knows about your company; saved to your Andru library |
| `get_asset` | Collect a generated asset or portfolio brief as markdown, or an account plan's link and summary |
| `cancel_job` | Stop an asset that `generate_asset` is still building; what it had written is discarded. A build that already finished stays as it is |
| `list_my_assets` | List the assets saved to your Andru library: each one's name, when it was built, and whether it was built in part. Open one with `get_asset` and its asset_id |

### Product Context

| Tool | What It Does |
|------|-------------|
| `set_product_context` | Tell Andru what you sell, once: your company website (Andru reads it) or a short description. Every later call uses it |

## Pricing

Andru charges from a prepaid wallet, at the same prices as the platform: [andru-ai.com/pricing](https://andru-ai.com/pricing). Answers from your own data are free, and a call that only asks you for more information is never charged. Your wallet balance is at [platform.andru-ai.com/settings/billing](https://platform.andru-ai.com/settings/billing).

## CLI

These tools are also available from the command line via the companion [`andru-intel`](https://www.npmjs.com/package/andru-intel) package:

```bash
npx andru-intel assets board            # search the asset catalog (free)
npx andru-intel generate "Board Presentation" --out board-deck.md   # build it, save as markdown
npx andru-intel list                    # see all tools
npx andru-intel score "AI code review"  # instant ICP (works offline)
npx andru-intel persona CFO             # buyer persona deep dive
npx andru-intel blueprint --stage "Series A" --arr "$2M"
npx andru-intel thesis "AI sales platform" --stage "Seed"
npx andru-intel roleplay CTO
npx andru-intel wellness
npx andru-intel run get_competitive_positioning --competitorName "<the alternative>"
```

## Cold-Start Support

7 tools work without any pipeline data — just describe your product:

- `get_icp_fit_score`, `get_persona_profile`, `get_messaging_framework`, `get_competitive_positioning`, `get_evaluation_criteria`, `classify_opportunity`, `get_disqualification_signals`

Andru only needs to know what you sell once:

- **Signed up with a company email?** Andru reads your company's website and remembers your product. Nothing to do.
- **Client shows forms** (Claude Code, Cursor, VS Code)? The first tool that needs it asks for your website in one field, then answers.
- **Otherwise:** call `set_product_context` with your website (or a description) once.

You can still pass `productDescription`, `vertical`, and `targetRole` on any call; what you send first is remembered. The tools use pre-built stakeholder understanding (5 pre-built buyer personas, 3 vertical segment profiles) to deliver results immediately.

Run a full ICP pipeline at [platform.andru-ai.com](https://platform.andru-ai.com) for understanding tuned to your specific product and market.

## Available Resources

| URI | Description |
|-----|-------------|
| `andru://accounts` | Your tracked accounts — tier, pipeline value, stakeholder count, and account plan status |

## How It Works

This MCP server is a thin proxy that authenticates with your Andru API key and forwards tool/resource requests to the Andru backend. All intelligence generation, ICP scoring, and data access happens server-side — the MCP server itself is stateless.

When your AI app connects, the server tells Andru the app's name and version. Each tool call is recorded by tool name, outcome and cost; what you typed isn't part of that record.

```
Claude Desktop/Code  →  MCP Server (stdio)  →  Andru API (HTTPS)
```

## A2A Protocol

Andru also supports the Agent-to-Agent (A2A) protocol for direct agent-to-agent communication. The AgentCard is available at:

```
https://api.andru-ai.com/.well-known/agent-card.json
```

## Intelligence Briefs

Free signal reads for the questions technical founders ask at 11 PM:

- [I've Done 30 Customer Interviews and Still Can't Define My ICP](https://andru-ai.com/answers/customer-interviews-icp)
- [I Know My ICP But My Outreach Still Isn't Working](https://andru-ai.com/answers/icp-outreach-not-working)
- [My Pipeline Is Full of Companies That Like Us But Nobody's Buying Urgently](https://andru-ai.com/answers/pipeline-no-urgency)
- [As a Technical Founder, What Am I Getting Wrong About Sales?](https://andru-ai.com/answers/technical-founder-sales-mistakes)
- [Why Does My Messaging Fall Flat Even When I'm Talking to the Right Companies?](https://andru-ai.com/answers/messaging-falls-flat)

## License

MIT
