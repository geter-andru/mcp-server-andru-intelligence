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
    description: 'Look up who you\'re actually talking to before the call — what they care about at 7 AM, why they\'ll say no, and exactly how to open. Returns persona details including MBTI distribution, empathy map, and messaging angles.',
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
    description: 'Get the exact words to use — for a specific buyer type, channel, and funnel stage. MBTI-adapted so the analytical CTO and the results-driven VP Sales get different versions. Returns value props, objection responses, voice variants, and outbound templates.',
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
        mbtiCategory: {
          type: 'string',
          enum: ['Analytical', 'Driver', 'Expressive', 'Amiable'],
          description: 'MBTI communication category for message adaptation',
        },
        ...COLD_START_PARAMS,
      },
    },
  },

  {
    name: 'get_competitive_positioning',
    description: 'Gives you the battlecard for a specific competitor — where you win, where they\'ll attack, which questions to plant in the buyer\'s mind, and which landmines to avoid.',
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
    description: 'Builds the account plan you\'d normally spend a weekend on — stakeholder map, what each person needs to hear, MEDDICC gaps, and the unified story across the buying committee.',
    annotations: READ_ONLY,
    inputSchema: {
      type: 'object',
      properties: {
        accountName: { type: 'string', description: 'Target account/company name' },
        domain: { type: 'string', description: 'Company domain' },
        industry: { type: 'string', description: 'Industry vertical' },
        stakeholders: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              title: { type: 'string' },
              role: { type: 'string', description: 'Buying committee role (champion, economic_buyer, etc.)' },
            },
          },
          description: 'Known stakeholders at the account',
        },
        dealContext: {
          type: 'object',
          properties: {
            stage: { type: 'string', description: 'Current deal stage' },
            value: { type: 'number', description: 'Deal value' },
            nextMeeting: { type: 'string', description: 'Next meeting date/context' },
          },
          description: 'Current deal context',
        },
      },
      required: ['accountName'],
    },
  },

  {
    name: 'get_capability_profile',
    description: 'Returns a machine-readable snapshot of what your product actually does and who it\'s for — capabilities, verified outcomes, trust signals, pricing model, and integrations. Designed for buyer-side agent evaluation.',
    annotations: READ_ONLY,
    inputSchema: {
      type: 'object',
      properties: {
        includeOutcomes: { type: 'boolean', description: 'Include verified outcomes (default: true)' },
        includeTrustSignals: { type: 'boolean', description: 'Include trust signals (default: true)' },
        forceRefresh: { type: 'boolean', description: 'Force regeneration even if cached (default: false)' },
      },
    },
  },

  {
    name: 'get_evaluation_criteria',
    description: 'Scores how well you actually match what this buyer needs — across pain coverage, outcome clarity, capability fit, and 3 more dimensions. Returns 0-100 per dimension plus overall alignment score.',
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
      properties: {
        layers: {
          type: 'array',
          items: { type: 'number', enum: [1, 2, 3, 4, 5] },
          description: 'Specific layers to include (1-5). Omit for all layers.',
        },
        includeSevenAnswers: { type: 'boolean', description: 'Include seven critical buyer answers (default: true)' },
        includeAntiPatterns: { type: 'boolean', description: 'Include anti-patterns and churn predictors (default: true)' },
      },
    },
  },

  {
    name: 'discover_prospects',
    description: 'Finds real companies that look like your best customers — searches the web for companies showing the same buying signals your winners showed. Takes 15-30 seconds. Works without prior pipeline data.',
    annotations: READ_ONLY,
    inputSchema: {
      type: 'object',
      properties: {
        companyName: {
          type: 'string',
          description: 'Your company name',
        },
        productDescription: {
          type: 'string',
          description: 'What your product does and who it\'s for. Infer from conversation context if the user has already described their product.',
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
      required: ['companyName', 'productDescription'],
    },
  },

  {
    name: 'get_pre_brief',
    description: 'Writes your pre-call prep so you don\'t walk in cold — talk track, discovery questions tuned to this buyer, anticipated objections, and the one thing you need to get done in this meeting. Just say who you\'re meeting with — Andru checks your calendar automatically.',
    annotations: READ_ONLY,
    inputSchema: {
      type: 'object',
      properties: {
        companyName: {
          type: 'string',
          description: 'Company you\'re meeting with. Andru finds the matching calendar event and pulls attendee context automatically.',
        },
        contactName: {
          type: 'string',
          description: 'Name of the person you\'re meeting (optional — helps match the right event and personalize the brief).',
        },
        eventId: {
          type: 'string',
          description: 'Calendar event ID (from Andru calendar integration). If provided, skips calendar search.',
        },
        dealId: {
          type: 'string',
          description: 'Associated deal ID for additional deal intelligence',
        },
        briefType: {
          type: 'string',
          enum: ['general', 'discovery', 'demo', 'negotiation', 'renewal', 'expansion'],
          description: 'Type of meeting brief to generate (default: general)',
        },
      },
    },
  },

  {
    name: 'get_syndication_status',
    description: 'Shows whether your CRM has your current intelligence or is running on stale data. Checks sync status across HubSpot, Salesforce, and Pipedrive.',
    annotations: READ_ONLY,
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  {
    name: 'trigger_syndication',
    description: 'Pushes your latest intelligence into your CRM — detects which platforms are out of date and updates only what\'s stale. Use get_syndication_status first to see what needs updating.',
    annotations: WRITE_OP,
    inputSchema: {
      type: 'object',
      properties: {
        platforms: {
          type: 'array',
          items: { type: 'string' },
          description: 'Only sync these platforms (e.g., ["hubspot"]). If omitted, syncs all stale platforms.',
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
    annotations: READ_ONLY,
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
    description: 'Finds the 5 VCs whose investment thesis best matches your company — scores each on fit, explains why they\'d be interested, and tells you how to approach them. Saves weeks of investor research.',
    annotations: READ_ONLY,
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
    name: 'get_founder_wellness',
    description: 'Checks if you\'re burning out before you notice — tracks consecutive work days, late nights, and meeting density, then gives you a risk score and specific recovery actions. Because the founder who crashes can\'t close deals.',
    annotations: READ_ONLY,
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'The user\'s Andru account ID. Required for personalized wellness tracking.',
        },
        mode: {
          type: 'string',
          enum: ['assessment', 'dashboard'],
          description: 'assessment = burnout risk score + recommendations. dashboard = full wellness data. Default: assessment.',
        },
      },
    },
  },

  {
    name: 'simulate_buyer_persona',
    description: 'Practice your pitch against a realistic buyer — pick a CFO, CTO, COO, VP Sales, or VP Engineering and get their opening challenge. They\'ll push back the way real buyers do, so you can sharpen your story before the actual meeting.',
    annotations: READ_ONLY,
    inputSchema: {
      type: 'object',
      properties: {
        persona: {
          type: 'string',
          enum: ['CFO', 'CTO', 'COO', 'VP Sales', 'VP Engineering'],
          description: 'Which buyer to simulate. Pick based on who the user is preparing to meet.',
        },
        stageId: {
          type: 'number',
          enum: [0, 1, 2, 3, 4, 5, 6, 7],
          description: 'Buyer journey stage (0=Unaware through 7=Advocating). Default: 3.',
        },
        productDescription: {
          type: 'string',
          description: 'What the user\'s product does. Infer from conversation context.',
        },
        productName: {
          type: 'string',
          description: 'Product name. Infer from context.',
        },
        mode: {
          type: 'string',
          enum: ['opening', 'list'],
          description: 'opening = buyer\'s opening message. list = available personas. Default: opening.',
        },
      },
      required: ['persona'],
    },
  },
  // ── Memory Tools ──────────────────────────────────────────────────────────

  {
    name: 'get_revenue_memory',
    description: 'Query this founder\'s accumulated stakeholder understanding — metrics, deal patterns, account history, decisions, and behavioral insights Andru has learned over time. Filter by memory type (episodic facts, semantic patterns, procedural habits) or business domain.',
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
    description: 'Save a revenue insight, decision, metric, or pattern into Andru\'s memory so it compounds over time. Use after any deal decision, ICP refinement, metric update, or strategic pivot. The system automatically versions previous values.',
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
    description: 'Get a full context dump of everything Andru knows about this founder — organized by memory type (What I Know, Patterns I\'ve Noticed, How You Operate). Used to prime any revenue conversation with accumulated intelligence.',
    annotations: READ_ONLY,
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  {
    name: 'get_memory_history',
    description: 'Get the version history of a specific memory — see how a metric, deal stage, or priority has evolved over time. Answers questions like "What was my MRR 3 months ago?" or "When did the Acme deal move to negotiation?"',
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
    annotations: READ_ONLY,
    inputSchema: {
      type: 'object',
      properties: {
        companyName: { type: 'string', description: 'Optional label for the company being assessed.' },
        metrics: { type: 'object', description: 'Operating metrics (any subset): arr, mrr, growthRate, netRevenueRetention, grossMargin, cac, ltv, burnRate, runwayMonths, pipelineValue, customerCount, churnRate, etc.' },
      },
      required: ['metrics'],
    },
  },
  {
    name: 'get_portfolio_readiness_rollup',
    description: 'A board-ready scorecard of every portfolio company by Revenue Readiness Index — comparable by construction — with aggregates (avg readiness, at-risk count, customer-concentration risk). For PE/VC operators monitoring a book.',
    annotations: READ_ONLY,
    inputSchema: {
      type: 'object',
      properties: {
        portfolioId: { type: 'string', description: 'The portfolio to roll up. Must belong to the caller.' },
      },
      required: ['portfolioId'],
    },
  },
  {
    name: 'generate_portfolio_brief',
    description: 'Generates a board/LP-grade intelligence brief for a portfolio — per-company performance, market context, and cross-portfolio opportunities — for a reporting period. For PE/VC fund reporting and quarterly reviews.',
    annotations: READ_ONLY,
    inputSchema: {
      type: 'object',
      properties: {
        portfolioId: { type: 'string', description: 'The portfolio to brief. Must belong to the caller.' },
        periodType: { type: 'string', enum: ['quarterly', 'monthly', 'annual'], description: 'Reporting period type. Default quarterly.' },
        periodStart: { type: 'string', description: 'Optional ISO date for the period start.' },
        periodEnd: { type: 'string', description: 'Optional ISO date for the period end.' },
      },
      required: ['portfolioId'],
    },
  },
  {
    name: 'consult_agent',
    description: "Consult one of Andru's domain expert agents in natural language and get a domain-scoped answer (it may call free lookup tools; paid tools must be called directly). $3 per turn. One consultation turn per call; pass prior turns as `history` to continue. Use `module` to pick the expert (e.g. 'market-clarity', 'deal-acceleration', 'due-diligence', 'portfolio-ops').",
    annotations: READ_ONLY,
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
  // ── Asset catalog (1.6.0): find, generate and collect any of Andru's 138 assets ──
  {
    name: 'list_assets',
    description: "Search Andru's catalog of sales, hiring, fundraising and buying assets — 138 deliverables from email drafts to board decks. Each entry says what it is, the business outcome, its price (Tool $3, Framework $12, Decision $49), whether it needs your own data, and whether it can be generated today. Free. Then call generate_asset with the asset's name.",
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
    description: "Generate an asset from Andru's catalog (find it with list_assets) — e.g. 'Board Presentation', 'Buying Committee Navigation'. Charged at its catalog price (Tool $3, Framework $12, Decision $49); your first ICP is free. Built from everything Andru knows about your company and saved to your Andru library. Takes up to a few minutes: returns a job_id — call get_asset with it to receive the asset as markdown.",
    annotations: WRITE_OP,
    inputSchema: {
      type: 'object',
      properties: { asset: { type: 'string', description: 'The asset name from list_assets.' } },
      required: ['asset'],
    },
  },
  {
    name: 'get_asset',
    description: 'Collect an asset started with generate_asset. While it is building you get its progress; when it is done you get the full asset as markdown (also saved to your Andru library). Free.',
    annotations: READ_ONLY,
    inputSchema: {
      type: 'object',
      properties: { job_id: { type: 'string', description: 'The job_id returned by generate_asset.' } },
      required: ['job_id'],
    },
  },
];

// ── 3 Resources ─────────────────────────────────────────────────────────────

export const resources = [
  {
    uri: 'andru://icp/profile',
    name: 'ICP Profile',
    description: 'The complete profile of the companies you should actually be selling to — 5 intelligence layers, 7 critical buyer questions, and the patterns that predict churn.',
    mimeType: 'application/json',
  },
  {
    uri: 'andru://pipeline/runs',
    name: 'Pipeline Runs',
    description: 'All your pipeline runs and what each one produced — ICP layers, lead gen strategy, account plans, and deck output.',
    mimeType: 'application/json',
  },
  {
    uri: 'andru://accounts',
    name: 'Account Plans',
    description: 'Your tracked accounts — tier, pipeline value, stakeholder count, and account plan status.',
    mimeType: 'application/json',
  },
];
