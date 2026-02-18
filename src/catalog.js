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

// ── 15 Tools ────────────────────────────────────────────────────────────────

export const tools = [
  {
    name: 'get_icp_fit_score',
    description: 'Tells you in seconds whether the company you\'re thinking about is worth your time — scores them against who actually buys from you and why, across 5 dimensions. No AI calls, instant results.',
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
    description: 'Writes your pre-call prep so you don\'t walk in cold — talk track, discovery questions tuned to this buyer, anticipated objections, and the one thing you need to get done in this meeting. Requires a calendar event ID.',
    inputSchema: {
      type: 'object',
      properties: {
        eventId: {
          type: 'string',
          description: 'Calendar event ID (from Andru calendar integration). Pulls all context automatically.',
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
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  {
    name: 'trigger_syndication',
    description: 'Pushes your latest intelligence into your CRM — detects which platforms are out of date and updates only what\'s stale. Use get_syndication_status first to see what needs updating.',
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
