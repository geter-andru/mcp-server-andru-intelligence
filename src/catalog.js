import { TOOL_DESCRIPTIONS } from './toolDescriptions.js';
/**
 * Static Tool & Resource Catalog
 *
 * Contains all MCP tool definitions and resource definitions so the server
 * can respond to ListTools/ListResources without calling the backend.
 * Tool *execution* still proxies to the Andru API.
 *
 * Source of truth: backend/src/mcp/tools/*.js + backend/src/mcp/resources/*.js
 *
 * v0.2.0 — Founder-pain descriptions + cold-start product context params
 */

// ── Cold-Start Product Context Params ───────────────────────────────────────
// Added to 7 tools that support cold-start (no pipeline data required when these are provided).
// Claude reads inputSchema.description before calling tools — these descriptions
// guide Claude to infer from conversation context or ask the user.

const COLD_START_PARAMS = {
  productDescription: {
    type: 'string',
    description: 'A brief description of what the user\'s product does and who it\'s for. Infer this from the conversation if the user has already described their product. If the user hasn\'t mentioned their product yet, ask them: "What does your product do, and who do you sell to?" before calling this tool.',
  },
  vertical: {
    type: 'string',
    description: 'The industry the user sells into (e.g., "fintech", "healthcare", "defense"). Infer from conversation context — the user\'s product description, company name, or the companies they\'re asking about. If unclear, ask.',
  },
  targetRole: {
    type: 'string',
    description: 'The buyer role being evaluated (e.g., "CFO", "CTO", "VP Sales"). Infer from context — often explicit in the user\'s question. If not mentioned, default to the most senior relevant role for their vertical.',
  },
};

// ── Tool Annotations ─────────────────────────────────────────────────────────
// MCP SDK annotations for directory compliance (Claude Desktop, OpenAI, etc.)
const READ_ONLY = { readOnlyHint: true, openWorldHint: true };
const WRITE_OP  = { readOnlyHint: false, destructiveHint: false, openWorldHint: true };
// Paid tools that otherwise only read (Geter 2026-10-23: "I approve marking the 7 paid tools as not
// read-only"). Claude runs read-only tools without asking each time; these charge the person's wallet,
// so they ask first. They change no data and delete nothing.
const PAID_ASKS_FIRST = { readOnlyHint: false, destructiveHint: false, openWorldHint: true };

// ── 19 Tools ────────────────────────────────────────────────────────────────

export const tools = [
  {
    name: 'get_icp_fit_score',
    description: 'Tells you in seconds whether the company you\'re thinking about is worth your time — scores them against who actually buys from you and why, across 5 dimensions. No AI calls, instant results.',
    annotations: READ_ONLY,
    inputSchema: {
      type: 'object',
      properties: {
        companyName: { type: 'string', description: 'Company name to evaluate' },
        domain: { type: 'string', description: 'Company website domain' },
        industry: { type: 'string', description: 'Industry vertical' },
        employeeCount: { type: 'number', description: 'Number of employees' },
        revenue: { type: 'string', description: 'Revenue range (e.g., "$1M-$5M")' },
        geography: { type: 'string', description: 'HQ location' },
        techStack: {
          type: 'array',
          items: { type: 'string' },
          description: 'Technologies the company uses',
        },
        painPoints: {
          type: 'array',
          items: { type: 'string' },
          description: 'Known pain points or challenges they face',
        },
        triggerEvents: {
          type: 'array',
          items: { type: 'string' },
          description: 'Recent trigger events (e.g., "just raised Series B", "new CTO hired")',
        },
        ...COLD_START_PARAMS,
      },
    },
  },

  {
    name: 'get_persona_profile',
    description: 'Look up who you\'re actually talking to before the call — what they care about at 7 AM, what they need before they say yes, and exactly how to open. Returns persona details including communication preferences, empathy map and messaging angles.',
    annotations: READ_ONLY,
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Job title of the person you\'re meeting (e.g., "VP Engineering", "CTO", "Head of Sales")' },
        industry: { type: 'string', description: 'Their industry' },
        companySize: { type: 'string', description: 'Their company size range' },
        ...COLD_START_PARAMS,
      },
      required: ['title'],
    },
  },

  {
    name: 'get_disqualification_signals',
    description: 'Find out if you\'re wasting time on a deal that won\'t close. Runs the company through three layers of signal — ICP fit, anti-pattern matching, and churn patterns — and tells you whether to keep investing or walk away.',
    annotations: READ_ONLY,
    inputSchema: {
      type: 'object',
      properties: {
        companyName: { type: 'string', description: 'Company name to check' },
        industry: { type: 'string', description: 'Industry' },
        employeeCount: { type: 'number', description: 'Number of employees' },
        revenue: { type: 'string', description: 'Revenue range' },
        geography: { type: 'string', description: 'Location' },
        techStack: { type: 'array', items: { type: 'string' }, description: 'Technologies they use' },
        dealContext: {
          type: 'object',
          properties: {
            dealValue: { type: 'number', description: 'Deal value' },
            stage: { type: 'string', description: 'Current deal stage' },
            daysInPipeline: { type: 'number', description: 'Days since deal entered pipeline' },
            championIdentified: { type: 'boolean', description: 'Has a champion been identified?' },
          },
          description: 'Current deal context (if applicable)',
        },
        ...COLD_START_PARAMS,
      },
    },
  },

  {
    name: 'get_messaging_framework',
    description: 'Words that fit each buyer, by buyer type, channel and funnel stage, adapted to how each person prefers to communicate, so the analytical CTO and the results-driven VP Sales each get a version that fits them. Returns value propositions, answers to the concerns each buyer raises, voice variants and outbound templates. Set `mbtiCategory` for one communication style, or leave it out to get all four. Use `get_persona_profile` to learn who the buyer is, and `get_pre_brief` to prepare for one specific meeting.',
    annotations: READ_ONLY,
    inputSchema: {
      type: 'object',
      properties: {
        segment: { type: 'string', description: 'Target segment or vertical' },
        stage: {
          type: 'string',
          enum: ['awareness', 'consideration', 'decision'],
          description: 'Where the buyer is in their journey',
        },
        channel: { type: 'string', description: 'Channel (email, linkedin, phone, etc.)' },
        personaType: { type: 'string', description: 'Target buyer title' },
        ...COLD_START_PARAMS,
      },
    },
  },

  {
    name: 'get_competitive_positioning',
    description: 'How you compare with a specific competitor, from the buyer\'s point of view. Pass the competitor\'s features in `competitorFeatures` to get where you overlap, where you\'re different, and where you\'re the better fit; without them you get the concerns this buyer is likely to raise.',
    annotations: READ_ONLY,
    inputSchema: {
      type: 'object',
      properties: {
        competitorName: { type: 'string', description: 'Competitor company name' },
        competitorFeatures: {
          type: 'array',
          items: { type: 'string' },
          description: 'Known competitor features or capabilities',
        },
        context: {
          type: 'string',
          description: 'Additional context (e.g., "enterprise deal", "competing on price")',
        },
        ...COLD_START_PARAMS,
      },
      required: ['competitorName'],
    },
  },

  {
    name: 'classify_opportunity',
    description: 'Run a full read on a deal in one call — fit score, persona match, risk flags, disqualification check, and a verdict: pursue, pause, or walk away. Combines multiple scoring engines for a comprehensive assessment.',
    annotations: READ_ONLY,
    inputSchema: {
      type: 'object',
      properties: {
        companyName: { type: 'string', description: 'Company name' },
        contactTitle: { type: 'string', description: 'Primary contact job title' },
        industry: { type: 'string', description: 'Industry' },
        employeeCount: { type: 'number', description: 'Number of employees' },
        revenue: { type: 'string', description: 'Revenue range' },
        geography: { type: 'string', description: 'Location' },
        dealValue: { type: 'number', description: 'Estimated deal value' },
        dealStage: { type: 'string', description: 'Current deal stage' },
        techStack: { type: 'array', items: { type: 'string' }, description: 'Technologies used' },
        painPoints: { type: 'array', items: { type: 'string' }, description: 'Known pain points' },
        triggerEvents: { type: 'array', items: { type: 'string' }, description: 'Trigger events' },
        championIdentified: { type: 'boolean', description: 'Has a champion been identified?' },
        competitorInvolved: { type: 'string', description: 'Known competitor in the deal' },
        ...COLD_START_PARAMS,
      },
      required: ['companyName'],
    },
  },

  {
    name: 'get_account_plan',
    description: 'Builds an account plan for a target company in your Andru account: the buying committee, the opportunities that fit what you sell, the champion to work with, talk tracks and next steps, from sourced research. Returns the link to the plan with a short summary. A plan for the same company from the last 30 days comes back at once. Takes 1 to 3 minutes: returns a job_id; call get_asset with it.',
    annotations: WRITE_OP,
    inputSchema: {
      type: 'object',
      properties: {
        accountName: {
          type: 'string',
          description: 'The company to plan for.'
        },
        productDescription: {
          type: 'string',
          description: 'What you sell to this account, if different from the product saved in Andru (a sentence or two).'
        },
        refresh: {
          type: 'boolean',
          description: 'Build a new plan even if one from the last 30 days exists ($12). Default false.'
        }
      },
      required: [
        'accountName'
      ]
    }
  },

  {
    name: 'get_evaluation_criteria',
    description: 'Scores how well you match what this buyer needs — across pain coverage, outcome clarity, capability fit, and 3 more dimensions. Returns 0-100 per dimension plus overall alignment score. Pass the buyer\'s `buyerPainPoints` and `requiredCapabilities`; pain coverage and capability fit are scored against them. Use `get_icp_fit_score` to check whether a company is worth pursuing at all, and this tool once you know what the buyer needs.',
    annotations: READ_ONLY,
    inputSchema: {
      type: 'object',
      properties: {
        buyerPainPoints: {
          type: 'array',
          items: { type: 'string' },
          description: 'Pain points the buyer has expressed or you expect them to have',
        },
        buyerIndustry: { type: 'string', description: 'Buyer\'s industry' },
        buyerSize: { type: 'string', description: 'Buyer company size' },
        requiredCapabilities: {
          type: 'array',
          items: { type: 'string' },
          description: 'Capabilities the buyer needs from a solution',
        },
        ...COLD_START_PARAMS,
      },
    },
  },

  {
    name: 'get_icp_profile',
    description: 'Returns everything Andru knows about your ideal customer — all 5 intelligence layers, the 7 critical buyer questions, and the patterns that predict churn. Optionally filter to specific layers.',
    annotations: READ_ONLY,
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  {
    name: 'discover_prospects',
    description: 'Finds real companies likely to buy your product. Searches the web for companies showing they have the problem you solve right now (hiring, launches, funding, expansion) and links the page behind every piece of evidence. Uses the product saved on your account. Takes up to a couple of minutes. Only companies with sourced evidence are returned.',
    annotations: PAID_ASKS_FIRST,
    inputSchema: {
      type: 'object',
      properties: {
        companyName: {
          type: 'string',
          description: 'Your company name. Defaults to the product saved on your account.',
        },
        productDescription: {
          type: 'string',
          description: 'What your product does and who it\'s for. Defaults to the product saved on your account.',
        },
        coreCapability: {
          type: 'string',
          description: 'The single most important thing your product does — the core capability that makes customers buy',
        },
        industry: {
          type: 'string',
          description: 'Target industry to search within',
        },
        targetMarket: {
          type: 'string',
          description: 'Target market segment (e.g., "Series A SaaS companies")',
        },
      },
    },
  },

  {
    name: 'get_pre_brief',
    description: "Writes your pre-call prep so you don't walk in cold — talk track, discovery questions tuned to this buyer, the concerns this buyer is likely to raise and what they need to hear, and the one thing you need to get done in this meeting. Provide a company name and Andru checks your calendar automatically.",
    annotations: PAID_ASKS_FIRST,
    inputSchema: {
      type: 'object',
      properties: {
        meetingId: {
          type: 'string',
          description: 'The meeting from the person\'s calendar (an id from a previous reply). Leave it out and describe the meeting in `meeting` instead.',
        },
        meeting: {
          type: 'string',
          description: 'The meeting in a sentence if it isn\'t on their calendar, e.g. \'pricing call with the company\'s VP of Finance and their IT lead\'.',
        },
        companyName: {
          type: 'string',
          description: 'Company you\'re meeting. Andru looks for the matching meeting on the person\'s calendar.',
        },
        situation: {
          type: 'string',
          enum: ['discovery', 'deal', 'customer_review'],
          description: 'What kind of meeting: a discovery call, where they speak first; a deal meeting (demo, pricing, pilot, procurement); or a customer review.',
        },
        stage: {
          type: 'integer',
          minimum: 0,
          maximum: 7,
          description: 'Where the deal is, by the last thing the buyer did (required for a deal meeting).',
        },
        room: {
          type: 'array',
          maxItems: 8,
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              buyerKey: { type: 'string' },
            },
            required: ['title'],
          },
          description: 'Who will be there: up to 8 people, each with their title and, if you know it, which of the six buyers they are.',
        },
      },
    },
  },

  {
    name: 'batch_fit_score',
    description: 'Score up to 50 companies at once — gives each a tier and score so you can rank a list in under a second. Returns individual scores plus aggregate statistics.',
    annotations: READ_ONLY,
    inputSchema: {
      type: 'object',
      properties: {
        companies: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              companyName: { type: 'string', description: 'Company name' },
              domain: { type: 'string', description: 'Company domain' },
              industry: { type: 'string', description: 'Industry vertical' },
              employeeCount: { type: 'number', description: 'Number of employees' },
              revenue: { type: 'string', description: 'Revenue range' },
              geography: { type: 'string', description: 'HQ location' },
              techStack: { type: 'array', items: { type: 'string' }, description: 'Technologies used' },
              painPoints: { type: 'array', items: { type: 'string' }, description: 'Known pain points' },
              triggerEvents: { type: 'array', items: { type: 'string' }, description: 'Recent trigger events' },
            },
          },
          description: 'Companies to score (max 50)',
        },
      },
      required: ['companies'],
    },
  },

  {
    name: 'get_sales_blueprint',
    description: 'Builds everything you need to make your first sales hire — job description, comp structure, interview questions that actually reveal sales ability, 90-day ramp plan, and weekly activity targets tied to your ARR goal.',
    annotations: PAID_ASKS_FIRST,
    inputSchema: {
      type: 'object',
      properties: {
        companyStage: {
          type: 'string',
          enum: ['Pre-Seed', 'Seed', 'Series A', 'Series B'],
          description: 'Current funding stage. Infer from conversation context if the user has mentioned it.',
        },
        arrTarget: {
          type: 'string',
          description: 'Annual recurring revenue target (e.g., "$2M", "$5M", "$10M"). Ask the user if not mentioned.',
        },
        dealSize: {
          type: 'string',
          description: 'Average deal size (e.g., "$15K ACV", "$50K ACV"). Infer from context or ask.',
        },
        avgCycleLength: {
          type: 'string',
          description: 'Average sales cycle length (e.g., "30 days", "60 days", "90+ days"). Infer or ask.',
        },
        teamSize: {
          type: 'number',
          description: 'Current team size. Infer from context if mentioned.',
        },
      },
      required: ['companyStage', 'arrTarget'],
    },
  },

  {
    name: 'get_thesis_match',
    description: 'Finds up to 3 VC firms investing now in companies like yours, each with a recent deal or stated focus and a link to the page it came from (a live web search, about 30 seconds). Only firms with sourced evidence are returned.',
    annotations: PAID_ASKS_FIRST,
    inputSchema: {
      type: 'object',
      properties: {
        productDescription: {
          type: 'string',
          description: 'What the company does and who it serves. Infer from conversation context if the user has already described their product.',
        },
        stage: {
          type: 'string',
          enum: ['Pre-Seed', 'Seed', 'Series A', 'Series B', 'Series C+'],
          description: 'Current funding stage. Infer from context if mentioned.',
        },
        arrRange: {
          type: 'string',
          description: 'Current ARR range (e.g., "$0-$500K", "$500K-$2M", "$2M-$10M"). Infer or ask.',
        },
        vertical: {
          type: 'string',
          description: 'Industry vertical (e.g., "AI/ML", "FinTech", "HealthTech", "SaaS"). Infer from product description.',
        },
      },
      required: ['productDescription', 'stage'],
    },
  },

  {
    name: 'simulate_buyer_persona',
    description: 'Prepare for a meeting with the people who\'ll be in the room. Andru writes a brief of what each person likely thinks going in (10 briefs a day), then plays them, one or several at once, in a Deal Prep session of 25 turns, asking what your real buyers ask. Say "End role-play. How did I do?" for a scored debrief and what to take into the meeting.',
    annotations: WRITE_OP,
    inputSchema: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          enum: ['meetings', 'brief', 'opening', 'reply', 'list'],
          description: 'meetings = the user\'s calendar meetings in the next 7 days (free). brief = the free brief for a meeting (10 a day). opening = open a session ($5) from a brief_id, or with one buyer. reply = the founder\'s next message; speaker picks who answers. list = the user\'s six buyers (free).',
        },
        situation: {
          type: 'string',
          enum: ['discovery', 'deal', 'customer_review'],
          description: 'discovery, deal or customer_review.',
        },
        stage: {
          type: 'number',
          enum: [0, 1, 2, 3, 4, 5, 6, 7],
          description: 'The deal\'s stage, 0–7.',
        },
        meeting_id: {
          type: 'string',
          description: 'A meeting from mode=meetings.',
        },
        meeting: {
          type: 'string',
          description: 'The meeting in a sentence, when it isn\'t on the calendar.',
        },
        room: {
          type: 'array',
          description: 'Who\'s in the room, 1–8 people, each with persona (one of the six buyers) and an optional title and name.',
          items: {
            type: 'object',
            properties: {
              persona: { type: 'string' },
              title: { type: 'string' },
              name: { type: 'string' },
            },
            required: ['persona'],
          },
        },
        brief_id: {
          type: 'string',
          description: 'The brief to open a session from.',
        },
        speaker: {
          type: 'string',
          description: 'Who answers this turn (p1, p2…, from the brief).',
        },
        persona: {
          type: 'string',
          description: 'Which of the user\'s six buyers to simulate (mode=list shows them, from their buying committee). Pick based on who the user is preparing to meet.',
        },
        stageId: {
          type: 'number',
          enum: [1, 2, 3, 4, 5, 6, 7],
          description: 'Buyer journey stage (1=Researching, 2=Quantifying, 3=Exploring, 4=Comparing, 5=Business Case, 6=Implementing, 7=Advocating). Default: 3 (Exploring).',
        },
        productDescription: {
          type: 'string',
          description: 'What the user\'s product does. Defaults to the product in their ICP.',
        },
        productName: {
          type: 'string',
          description: 'Product name. Defaults to the product in their ICP.',
        },
        session_id: {
          type: 'string',
          description: 'The Deal Prep session to continue (returned by mode=opening). Required for mode=reply.',
        },
        message: {
          type: 'string',
          description: 'mode=reply: what the seller says to the buyer. "End role-play. How did I do?" ends with a debrief.',
        },
        session_key: {
          type: 'string',
          description: 'Optional idempotency key for opening a session: retrying with the same key never charges twice.',
        },
      },
      required: [],
    },
  },
  // ── Memory Tools ──────────────────────────────────────────────────────────

  {
    name: 'get_revenue_memory',
    description: "Query this founder's accumulated revenue memory: metrics, deal patterns, account history, decisions and habits Andru has learned over time. Filter by category, key pattern or memory type.",
    annotations: READ_ONLY,
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['metric', 'account', 'priority', 'preference', 'decision', 'deadline'],
          description: 'Filter to a specific memory category. Omit to search all.',
        },
        keyPattern: {
          type: 'string',
          description: 'Filter keys matching this pattern (supports * wildcards, e.g., "*mrr*", "acme_*").',
        },
        memoryType: {
          type: 'string',
          enum: ['episodic', 'semantic', 'procedural'],
          description: 'Filter by memory type. episodic=specific facts, semantic=patterns, procedural=behavioral habits.',
        },
      },
    },
  },

  {
    name: 'log_revenue_insight',
    description: "Save a revenue insight, decision, metric or pattern to Andru's memory so it compounds over time. Use after a deal decision, ICP refinement, metric update or strategic pivot. Saving an existing key keeps the previous value in its history.",
    annotations: WRITE_OP,
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['metric', 'account', 'priority', 'preference', 'decision', 'deadline'],
          description: 'What kind of memory this is.',
        },
        key: {
          type: 'string',
          description: 'Unique identifier for this memory (lowercase_underscored, e.g., "current_arr", "acme_deal_stage").',
        },
        value: {
          type: 'string',
          description: 'The memory content — a concise, specific fact or insight.',
        },
        memoryType: {
          type: 'string',
          enum: ['episodic', 'semantic', 'procedural'],
          description: 'episodic=time-bound fact, semantic=general pattern, procedural=behavioral habit. Default: episodic.',
        },
        domain: {
          type: 'string',
          enum: ['revenue', 'product', 'team', 'investor', 'market', 'general'],
          description: 'Business domain this memory relates to. Default: general.',
        },
        confidence: {
          type: 'number',
          description: 'How confident this memory is (0.0-1.0). Default: 1.0 for founder-stated facts.',
        },
      },
      required: ['category', 'key', 'value'],
    },
  },

  {
    name: 'get_founder_context',
    description: "Everything Andru knows about this founder in one read: profile, product, and memory grouped as What I Know, Patterns I've Noticed and How You Operate. Use it to prime any revenue conversation.",
    annotations: READ_ONLY,
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  {
    name: 'get_memory_history',
    description: 'The version history of one memory: how a metric, deal stage or priority changed over time. Answers "What was my MRR 3 months ago?" or "When did my biggest deal move into procurement?".',
    annotations: READ_ONLY,
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Memory category (e.g., "metric", "account").',
        },
        key: {
          type: 'string',
          description: 'Memory key (e.g., "mrr", "acme_deal_stage").',
        },
      },
      required: ['category', 'key'],
    },
  },

  // ── Tier-2/3 outcome tools (market + portfolio intelligence + agent consultation) ──
  {
    name: 'get_market_signals',
    description: "Surfaces what's moving in your market right now — relevance-ranked industry signals (trends, buyer pain, competitor moves, regulatory/tech shifts, hiring + funding) each with its buyer impact and a recommended action. Use it for deal/market context before a screen, or to time GTM moves.",
    annotations: READ_ONLY,
    inputSchema: {
      type: 'object',
      properties: {
        signalType: { type: 'string', enum: ['market_trend', 'buyer_pain', 'competitor_move', 'regulatory', 'technology_shift', 'hiring_trend', 'funding_landscape'], description: 'Optional filter to one signal category.' },
        industry: { type: 'string', description: 'Optional industry/vertical filter.' },
        windowDays: { type: 'number', description: 'Look-back window in days (1–30). Default 7.' },
        limit: { type: 'number', description: 'Max signals (1–25). Default 10.' },
        minRelevance: { type: 'number', description: 'Minimum relevance 0–1. Default 0.5.' },
      },
    },
  },
  {
    name: 'assess_company_readiness',
    description: "Scores a company's Revenue Readiness Index (0–100) from its operating metrics — stage-fit, confidence, NRR / CAC-payback / pipeline-coverage, and the #1 growth constraint. Use it to screen a target or assess a portfolio company. Pass the metrics you have; more metrics = higher confidence.",
    annotations: PAID_ASKS_FIRST,
    inputSchema: {
      type: 'object',
      properties: {
        companyName: { type: 'string', description: 'Optional label for the company being assessed.' },
        metrics: { type: 'object', description: 'Operating metrics (any subset): arr, mrr, momGrowth or yoyGrowth (%), netRevenueRetention (%), grossMargin (%), monthlyChurn (%), cac, ltv, burnMultiple, customerCount, pipelineValue, salesCycleDays. Percentages as numbers (110 = 110%; 1.1 is read as 110% for retention and margin). The more provided, the higher the confidence.' },
      },
      required: ['metrics'],
    },
  },
  {
    name: 'get_portfolio_readiness_rollup',
    description: 'A board-ready scorecard of every portfolio company by Revenue Readiness Index — comparable by construction — with aggregates (avg readiness, at-risk count, customer-concentration risk). For PE/VC operators monitoring a book.',
    annotations: PAID_ASKS_FIRST,
    inputSchema: {
      type: 'object',
      properties: {
        portfolioId: { type: 'string', description: 'The portfolio to roll up. whoami lists yours with their ids.' }, // copy batch 16 P2
      },
      required: ['portfolioId'],
    },
  },
  {
    name: 'generate_portfolio_brief',
    description: "A brief on your portfolio's go-to-market activity for a period: what Andru's work across your portfolio companies found (targets, opportunities, overlaps), each company's public go-to-market news, and the market signals around their buyers, with sources. Not a financial or performance report. Send the companies (name and website, up to 15) or a portfolioId; with neither, Andru suggests the companies on your firm's website for you to confirm. Takes a few minutes: returns a job_id; call get_asset with it.",
    annotations: WRITE_OP,
    inputSchema: {
      type: 'object',
      properties: {
        companies: {
          type: 'array',
          maxItems: 15,
          description: 'The portfolio companies to brief, up to 15. Saved as a portfolio on your account the first time.',
          items: {
            type: 'object',
            properties: { name: { type: 'string' }, website: { type: 'string', description: 'e.g. example.com; tells companies with similar names apart.' } },
            required: ['name'],
          },
        },
        portfolioId: { type: 'string', description: 'A portfolio already on your account (returned by an earlier brief). With companies, they are added to it.' },
        periodType: { type: 'string', enum: ['quarterly', 'monthly', 'annual'], description: 'Reporting period type. Default quarterly.' },
        periodStart: { type: 'string', description: 'Optional ISO date for the period start. Default: the start of the last full period.' },
        periodEnd: { type: 'string', description: 'Optional ISO date for the period end. Default: the end of the last full period.' },
      },
    },
  },
  {
    name: 'consult_agent',
    description: "Consult one of Andru's domain expert agents in natural language and get a domain-scoped answer (it may call lookup tools; tools that cost money must be called directly). One consultation turn per call; pass prior turns as `history` to continue. Use `module` to pick the expert (e.g. 'market-clarity', 'deal-acceleration', 'due-diligence', 'portfolio-ops').",
    annotations: PAID_ASKS_FIRST,
    inputSchema: {
      type: 'object',
      properties: {
        module: { type: 'string', description: "Which domain agent to consult (e.g. 'market-clarity', 'due-diligence', 'portfolio-ops')." },
        message: { type: 'string', description: 'Your question / request for the agent (up to 4,000 characters).' },
        history: { type: 'array', description: 'Optional prior turns: [{ role, content }]. At most 10 turns of 2,000 characters each.', items: { type: 'object' } },
      },
      required: ['module', 'message'],
    },
  },
  // ── Asset catalog (1.6.0): find, generate and collect any of Andru's 139 assets ──
  {
    name: 'list_assets',
    description: "Search Andru's catalog of sales, hiring, fundraising and buying assets — 139 deliverables from email drafts to board decks. Each entry says what it is, the business outcome, its price, whether it needs your own data, and whether it can be generated today. Then call generate_asset with the asset's name.",
    annotations: READ_ONLY,
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: "Keywords for what you need, e.g. 'board deck', 'buying committee', 'first sales hire'." },
        group: { type: 'string', enum: ['Core', 'Advanced', 'Strategic', 'Buy-side'], description: 'Optional catalog group.' },
        available_only: { type: 'boolean', description: 'Only assets that can be generated today.' },
        limit: { type: 'number', description: 'Maximum results (default 15).' },
      },
    },
  },
  {
    name: 'generate_asset',
    description: "Generate an asset from Andru's catalog (find it with list_assets) — e.g. 'Board Presentation', 'Buying Committee Navigation'. Built from everything Andru knows about your company and saved to your Andru library. Takes up to a few minutes: returns a job_id — call get_asset with it to receive the asset as markdown.",
    annotations: WRITE_OP,
    inputSchema: {
      type: 'object',
      properties: {
        asset: { type: 'string', description: 'The asset name from list_assets.' },
        prospectCompany: { type: 'string', description: 'For a prospect asset (Pre-Call Intelligence Brief, Deal Reengagement Strategy, Personalized Cost of Inaction One-Pager): the company it is for.' },
        prospectContact: { type: 'string', description: 'For a prospect asset: the person it is for, name and title.' },
      },
      required: ['asset'],
    },
  },
  {
    name: 'get_asset',
    description: 'Collect an asset started with generate_asset, a brief started with generate_portfolio_brief, or an account plan started with get_account_plan. While it is building you get its progress; when it is done you get the asset or brief in full as markdown, or the account plan\'s link and summary (all saved to your Andru account).',
    annotations: READ_ONLY,
    inputSchema: {
      type: 'object',
      properties: {
        job_id: {
          type: 'string',
          description: 'The job_id returned by generate_asset, generate_portfolio_brief or get_account_plan.'
        }
      },
      required: [
        'job_id'
      ]
    }
  },
  // ── Product context (2026-10-07): say what you sell once ──────────────────
  {
    name: 'set_product_context',
    description: 'Tell Andru what you sell, once. Give your company website (Andru reads it and remembers your product) or a short product description. Every later call uses it, so tools stop asking for product context. Call with no arguments to see what Andru has saved.',
    annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        website: { type: 'string', description: 'Your company website, e.g. acme.com. Andru reads the homepage once.' },
        productDescription: { type: 'string', description: 'Or: what your product does and who it is for (2-3 sentences).' },
        vertical: { type: 'string', description: 'Optional: the industry you sell into.' },
        targetRole: { type: 'string', description: 'Optional: the buyer role you target, e.g. CFO.' },
      },
    },
  },
];

// ── 1 Resource ─────────────────────────────────────────────────────────────

export const resources = [
  {
    uri: 'andru://accounts',
    name: 'Account Plans',
    description: 'Your account plans: each target account\'s tier, pipeline value, number of opportunities and contacts, likely champion, and whether the plan is ready. Read this before asking get_account_plan for a company, to see what already exists.',
    mimeType: 'application/json',
  },
];

// ── Account tools (AGENT_PLATFORM_PLAN_2026-10-22) ──────────────────────────
// Outside the 28 intelligence tools: free, answered by the API before tool routing. The first four
// need no API key, so an agent can sign its person up from inside the conversation. Wording:
// approved 2026-10-18 (signup_verify, get_topup_link) and in copy batch 1 C4/C8 (Geter 2026-10-22).

/** Tools that work with no API key. */
export const KEYLESS_TOOLS = new Set(['signup_start', 'signup_verify', 'signup_status', 'preview_company']);

const FOUND_VIA = {
  type: 'string',
  description: 'Optional: how the person or their agent found Andru: moltbook, a2a_directory, mcp_registry (includes Smithery), npm, search, ai_assistant, person or other. Other text is kept as written.',
};
const FREE_TOOL = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };

export const accountTools = [
  {
    name: 'preview_company',
    description: "See what Andru reads about a company from its website before signing up: who it sells to, the buyers who decide, and what the site says versus what those buyers need to hear. Send the company's website. No account needed. Takes about a minute: you get a preview_id; call again with it to collect the read. If the person signs up with signup_start and this preview_id, the read becomes their first ICP.",
    annotations: READ_ONLY,
    inputSchema: {
      type: 'object',
      properties: {
        website: { type: 'string', description: "The company's website, e.g. acme.com." },
        previewId: { type: 'string', description: 'From an earlier call, to collect the read.' },
      },
    },
  },
  {
    name: 'signup_start',
    description: "Create an Andru account, or sign in to yours, without leaving your agent. Send the person's email. Andru emails them a 6-digit code and an Approve button. If they read you the code, call signup_verify. If they tap Approve, call signup_status with the request_id until it returns your key. They also choose how much you can spend without asking them; it starts at nothing beyond the daily free calls.",
    annotations: FREE_TOOL,
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: "The person's email. The code goes here." },
        website: { type: 'string', description: 'Optional: their company website, e.g. acme.com. Andru reads it so its answers are about what they sell.' },
        agentName: { type: 'string', description: "Optional: your agent's name. The key is named after it." },
        foundVia: FOUND_VIA,
        previewId: { type: 'string', description: 'Optional: from preview_company. The read becomes their first ICP.' },
      },
      required: ['email'],
    },
  },
  {
    name: 'signup_verify',
    description: 'Finish signing up: send the email and the 6-digit code the person received. Returns an Andru API key for this agent.',
    annotations: FREE_TOOL,
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'The email the code was sent to.' },
        code: { type: 'string', description: 'The 6-digit code from the email.' },
        agentName: { type: 'string', description: "Optional: your agent's name. The key is named after it." },
        foundVia: FOUND_VIA,
      },
      required: ['email', 'code'],
    },
  },
  {
    name: 'signup_status',
    description: 'Check whether the person has approved you. Send the request_id from signup_start. Returns "waiting" (ask again after the number of seconds it gives), your API key once they approve (shown once; save it), or "expired".',
    annotations: FREE_TOOL,
    inputSchema: {
      type: 'object',
      properties: { requestId: { type: 'string', description: 'The request_id from signup_start.' } },
      required: ['requestId'],
    },
  },
  {
    name: 'whoami',
    description: "What this API key can do: the account it belongs to, the key's name, how much it can spend today and this month without asking, the wallet balance, and free calls left today.",
    annotations: READ_ONLY,
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'quote',
    description: "The exact price of a call before you make it. Send the tool name and its arguments. Returns the price, whether today's free calls cover it, the wallet balance, how much this key can still spend without asking, and a quote_id that holds the price for 30 minutes. Pass quote_id with the call to pay the quoted price.",
    annotations: READ_ONLY,
    inputSchema: {
      type: 'object',
      properties: {
        tool: { type: 'string', description: 'The tool you plan to call, e.g. get_pre_brief.' },
        arguments: { type: 'object', description: 'The arguments you plan to send with it.' },
      },
      required: ['tool'],
    },
  },
  // No top-up tool (Geter 2026-10-23: "remove the top-up tool"): money is added only on Andru's own
  // billing page, which a low-wallet result links to.
];

// ── Paid tools: the billing terms (copy batch 1 C9) ─────────────────────────
// The tools the backend lists with these terms: agentPricing.js priceFor(name).counts. generate_asset
// is not one: its job charges the asset's catalog price, which its own description states.
export const PAID_TOOLS = new Set([
  'get_account_plan', 'get_pre_brief', 'simulate_buyer_persona', 'discover_prospects', 'get_thesis_match',
  'get_sales_blueprint', 'consult_agent', 'assess_company_readiness',
  'get_portfolio_readiness_rollup', 'generate_portfolio_brief',
]);
// Copy batch 13 X (Geter 2026-10-23: "approve batch 13 with X yes"): paid tools say they cost money,
// with no price; the price is in quote and every result.
export const PAID_TOOL_LINE = 'Paid. Check the price with quote before running.';
const BILLING_PARAMS = {
  idempotencyKey: { type: 'string', description: 'Optional: any unique string for this call. Retrying with the same key returns the first result and never charges twice.' },
  quoteId: { type: 'string', description: 'Optional: the quote_id from quote, to pay the quoted price (held for 30 minutes).' },
  // Copy batch 6 J1 (approved by Geter 2026-10-23); the same parameter the backend lists.
  maxAmountCents: { type: 'integer', minimum: 0, description: 'Optional: the most this call may cost, in cents. If the price is higher, nothing runs and nothing is charged.' },
};

/** Every tool a client sees: the account tools, then the 28 intelligence tools with billing terms on paid ones. */
/**
 * Tool titles (copy batch 12 T1–T37, approved by Geter 2026-10-23): what Claude shows a person when it
 * asks to run a tool. Short and plain; no prices or promotion.
 */
export const TOOL_TITLES = {
  preview_company: "Preview a company",
  signup_start: "Start sign-up",
  signup_verify: "Finish sign-up with a code",
  signup_status: "Check sign-up approval",
  whoami: "Show this key's account and limits",
  quote: "Get the price of a call",
  set_product_context: "Tell Andru what you sell",
  get_icp_profile: "Read your ideal customer profile",
  get_icp_fit_score: "Score a company's fit",
  batch_fit_score: "Score a list of companies",
  get_disqualification_signals: "Check whether a buyer is ready",
  classify_opportunity: "Read a deal",
  get_persona_profile: "Profile a buyer",
  get_messaging_framework: "Put your story in each buyer's terms",
  get_competitive_positioning: "Weigh the buyer's alternatives",
  get_evaluation_criteria: "Score fit to a buyer's needs",
  get_account_plan: "Build an account plan",
  discover_prospects: "Find likely buyers",
  get_pre_brief: "Prepare for a meeting",
  simulate_buyer_persona: "Prepare with buyer role-play",
  get_sales_blueprint: "Plan your first sales hire",
  get_thesis_match: "Find investors who fit",
  get_market_signals: "See what's moving in your market",
  get_founder_context: "Read what Andru knows about you",
  get_revenue_memory: "Search revenue memory",
  get_memory_history: "Show how a memory changed",
  log_revenue_insight: "Save a revenue insight",
  consult_agent: "Ask an Andru specialist",
  list_assets: "Search the asset catalog",
  generate_asset: "Build an asset",
  get_asset: "Collect a finished result",
  assess_company_readiness: "Score a company's revenue readiness",
  get_portfolio_readiness_rollup: "Portfolio readiness scorecard",
  generate_portfolio_brief: "Brief on portfolio go-to-market",
};

/** Server instructions (copy batch 12 I, approved by Geter 2026-10-23): when to use Andru, how to start, when not to. */
export const SERVER_INSTRUCTIONS = 'Andru helps B2B founders and PE/VC operating partners understand their buyers and prepare to sell. Use it when the person asks who to sell to, whether a company or deal is worth pursuing, who is on a buying committee and what each person needs, how to prepare for a specific sales meeting, how to make a first sales hire, which investors fit their company, or how their portfolio companies\' go-to-market is going.\n\nIf a tool says it needs to know what you sell, call set_product_context, then try that tool again. Lookups that read the person\'s own data are free. Some tools cost money: quote returns the exact price first, and a paid call is charged only when it delivers. Tools that take minutes return a job_id; collect the result with get_asset.\n\nDon\'t use Andru for general web research, for companies unrelated to the person\'s own sales or portfolio, or to send messages to anyone.';

export function listedTools() {
  // Copy batches 15 and 16: the approved "Use this when…" descriptions (toolDescriptions.js).
  const described = (t) => (TOOL_DESCRIPTIONS[t.name] ? { ...t, description: TOOL_DESCRIPTIONS[t.name] } : t);
  const priced = tools.map(described).map((t) => (PAID_TOOLS.has(t.name)
    ? {
      ...t,
      description: `${t.description} ${PAID_TOOL_LINE}`,
      inputSchema: { ...t.inputSchema, properties: { ...(t.inputSchema?.properties || {}), ...BILLING_PARAMS } },
    }
    : t));
  return [...accountTools.map(described), ...priced].map((t) => ({ ...t, title: TOOL_TITLES[t.name] }));
}
