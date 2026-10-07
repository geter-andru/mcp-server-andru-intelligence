# Andru MCP Server — Operational Empathy for B2B

28 tools for technical founders and PE/VC operators navigating high-stakes B2B interactions. ICP scoring, buyer persona simulation, competitive battlecards, MBTI-adapted messaging, deal classification, sales hiring blueprints, VC thesis matching, founder wellness, and pre-meeting briefs — built on 20 years of B2B sales pattern data.

Works immediately — no pipeline data required. Describe your product and Andru delivers stakeholder understanding in seconds. Run a full pipeline for empathy tuned to your specific market.

## Installation

```bash
npm install -g mcp-server-andru-intelligence
```

Or run directly:

```bash
ANDRU_API_KEY=sk_live_... npx mcp-server-andru-intelligence
```

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANDRU_API_KEY` | Yes | — | Your Andru Platform API key |
| `ANDRU_API_URL` | No | `https://api.andru-ai.com` | API base URL. The default is Andru's production API; you don't need to change it. |

Get your API key at [platform.andru-ai.com/settings/developer](https://platform.andru-ai.com/settings/developer).

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "andru-intelligence": {
      "command": "npx",
      "args": ["mcp-server-andru-intelligence"],
      "env": {
        "ANDRU_API_KEY": "sk_live_your_key_here"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add andru-intelligence npx mcp-server-andru-intelligence \
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

### Stakeholder Understanding

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

### Founder Tools

| Tool | What It Does | Latency |
|------|-------------|---------|
| `get_sales_blueprint` | First sales hire blueprint — JD, comp model, interview questions, and 90-day ramp plan for the stage you're at | 10-20s |
| `get_thesis_match` | Match your company against VC investment theses — top 5 fits with reasoning for why each thesis applies | 10-20s |
| `get_founder_wellness` | Burnout risk assessment with recovery recommendations — because 54% of founders are severely stressed and 81% hide it | <200ms |
| `simulate_buyer_persona` | A Deal Prep session ($5, 25 turns): practice your pitch against a simulated CFO, CTO, or VP Sales — get the objections before the real meeting | 5-15s |


### Revenue Memory

| Tool | What It Does | Latency |
|------|-------------|---------|
| `get_revenue_memory` | Query what Andru has learned about your business over time: metrics, deal patterns, account history, decisions | varies |
| `log_revenue_insight` | Save an insight, decision, metric or pattern to Andru's memory; earlier values are versioned automatically | varies |
| `get_founder_context` | Everything Andru knows about you, organised by memory type, to prime any revenue conversation | varies |
| `get_memory_history` | How a metric, deal stage or priority has changed over time ("What was my MRR 3 months ago?") | varies |

### Market & Portfolio Intelligence

| Tool | What It Does | Latency |
|------|-------------|---------|
| `get_market_signals` | What's moving in your market now: ranked signals, each with its buyer impact and a recommended action | varies |
| `assess_company_readiness` | Scores a company's Revenue Readiness Index (0–100) from its operating metrics, with its #1 growth constraint | varies |
| `get_portfolio_readiness_rollup` | A board-ready scorecard of every portfolio company by Revenue Readiness Index, with aggregates | varies |
| `generate_portfolio_brief` | A board/LP-grade brief for a portfolio: per-company performance, market context, cross-portfolio opportunities | varies |

### Consultation

| Tool | What It Does | Latency |
|------|-------------|---------|
| `consult_agent` | Ask one of Andru's domain expert agents in natural language and get a domain-scoped answer ($3 per turn) | varies |

### Asset Catalog

| Tool | What It Does | Price |
|------|-------------|-------|
| `list_assets` | Search Andru's catalog of 138 sales, hiring, fundraising and buying assets: what each is, its business outcome, price, and whether it can be generated today | Free |
| `generate_asset` | Generate any catalog asset from everything Andru knows about your company; saved to your Andru library | Its catalog price: Tool $3, Framework $12, Decision $49 (your first ICP is free) |
| `get_asset` | Collect a generated asset as markdown | Free |

### Product Context

| Tool | What It Does | Price |
|------|-------------|-------|
| `set_product_context` | Tell Andru what you sell, once: your company website (Andru reads it) or a short description. Every later call uses it | Free |

## Pricing

The same work costs the same as in the Andru platform, from the same wallet:
- **Answers from your own data** (fit scores, ICP, personas, account plan…): always free.
- **Tool, $3:** a pre-meeting brief, a diagnostic, one expert-agent turn, or a single-piece catalog asset.
- **Framework, $12** and **Decision, $49:** the rest of the catalog.
- **Deal Prep session, $5:** 25 turns of buyer role-play and coaching (`simulate_buyer_persona`).

**5 free calls a day,** shared with A2A, cover paid calls priced $3 or less (pre-meeting brief, diagnostic); Deal Prep sessions, consultations and catalog assets are always paid. A call that only asks you for more information is never charged. Check your balance and free calls with `andru-intel usage`.

## CLI

19 of these tools are also available from the command line via the companion [`andru-intel`](https://www.npmjs.com/package/andru-intel) package:

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
npx andru-intel run get_competitive_positioning --companyName "Acme"
```

## Cold-Start Support

7 tools work without any pipeline data — just describe your product:

- `get_icp_fit_score`, `get_persona_profile`, `get_messaging_framework`, `get_competitive_positioning`, `get_evaluation_criteria`, `classify_opportunity`, `get_disqualification_signals`

Andru only needs to know what you sell once:

- **Signed up with a company email?** Andru reads your company's website and remembers your product. Nothing to do.
- **Client shows forms** (Claude Code, Cursor, VS Code)? The first tool that needs it asks for your website in one field, then answers.
- **Otherwise:** call `set_product_context` with your website (or a description) once.

You can still pass `productDescription`, `vertical`, and `targetRole` on any call; what you send first is remembered. The tools use pre-built stakeholder understanding (5 named buyer personas, 3 vertical segment profiles) to deliver results immediately.

Run a full ICP pipeline at [platform.andru-ai.com](https://platform.andru-ai.com) for understanding tuned to your specific product and market.

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
https://api.andru-ai.com/.well-known/agent.json
```

## Also Available As

**Chrome Extension** — Sales intelligence on LinkedIn profiles, Gmail compose, and any company page. [Install from Chrome Web Store](https://platform.andru-ai.com/tools/chrome-extension).

## Intelligence Briefs

Free signal reads for the questions technical founders ask at 11 PM:

- [I've Done 30 Customer Interviews and Still Can't Define My ICP](https://platform.andru-ai.com/intelligence/customer-interviews-icp)
- [I Know My ICP But My Outreach Still Isn't Working](https://platform.andru-ai.com/intelligence/icp-outreach-not-working)
- [My Pipeline Is Full of Companies That Like Us But Nobody's Buying Urgently](https://platform.andru-ai.com/intelligence/pipeline-no-urgency)
- [As a Technical Founder, What Am I Getting Wrong About Sales?](https://platform.andru-ai.com/intelligence/technical-founder-sales-mistakes)
- [Why Does My Messaging Fall Flat Even When I'm Talking to the Right Companies?](https://platform.andru-ai.com/intelligence/messaging-falls-flat)

## License

MIT
