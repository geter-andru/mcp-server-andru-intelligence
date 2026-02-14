/**
 * Static Tool & Resource Catalog
 *
 * Contains all MCP tool definitions and resource definitions so the server
 * can respond to ListTools/ListResources without calling the backend.
 * Tool *execution* still proxies to the Andru API.
 *
 * Source of truth: backend/src/mcp/tools/*.js + backend/src/mcp/resources/*.js
 */

// ── 15 Tools ────────────────────────────────────────────────────────────────

export const tools = [
  {
    name: 'get_icp_fit_score',
    description: 'Score a company against your ICP criteria. Returns a score (0-100), tier (A/B/C/D), and breakdown across 5 dimensions: firmographics, technographics, pain points, budget fit, and behavioral signals. No AI calls — pure algorithmic scoring.',
    inputSchema: {
      type: 'object',
      properties: {
        companyName: { type: 'string', description: 'Company name' },
        domain: { type: 'string', description: 'Company domain' },
        industry: { type: 'string', description: 'Industry vertical' },
        employeeCount: { type: 'number', description: 'Number of employees' },
        revenue: { type: 'string', description: 'Revenue range (e.g., "$1M-$5M")' },
        geography: { type: 'string', description: 'HQ location' },
        techStack: {
          type: 'array',
          items: { type: 'string' },
          description: 'Technologies used',
        },
        painPoints: {
          type: 'array',
          items: { type: 'string' },
          description: 'Known pain points or challenges',
        },
        triggerEvents: {
          type: 'array',
          items: { type: 'string' },
          description: 'Recent trigger events (e.g., "just raised Series B", "new CTO hired")',
        },
      },
    },
  },

  {
    name: 'get_persona_profile',
    description: 'Find the best-matching buyer persona from your ICP for a given job title, industry, and company size. Returns persona details including MBTI distribution, pain points, empathy map, and messaging angles.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Job title (e.g., "VP Engineering", "CTO", "Head of Sales")' },
        industry: { type: 'string', description: 'Industry context' },
        companySize: { type: 'string', description: 'Company size range' },
      },
      required: ['title'],
    },
  },

  {
    name: 'get_disqualification_signals',
    description: 'Classify an opportunity using 3-layer scoring: ICP fit score, anti-pattern matching, and learned churn patterns. Returns STRONG/MODERATE/MARGINAL/ANTI_PATTERN classification with reasoning chain.',
    inputSchema: {
      type: 'object',
      properties: {
        companyName: { type: 'string', description: 'Company name' },
        industry: { type: 'string', description: 'Industry' },
        employeeCount: { type: 'number', description: 'Number of employees' },
        revenue: { type: 'string', description: 'Revenue range' },
        geography: { type: 'string', description: 'Location' },
        techStack: { type: 'array', items: { type: 'string' }, description: 'Technologies used' },
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
      },
    },
  },

  {
    name: 'get_messaging_framework',
    description: 'Get messaging framework for a specific segment, funnel stage, or persona type. Returns value props, MBTI-adapted message templates, objection responses, voice variants, and content recommendations.',
    inputSchema: {
      type: 'object',
      properties: {
        segment: { type: 'string', description: 'Target segment or vertical' },
        stage: {
          type: 'string',
          enum: ['awareness', 'consideration', 'decision'],
          description: 'Buyer journey stage',
        },
        channel: { type: 'string', description: 'Channel (email, linkedin, phone, etc.)' },
        personaType: { type: 'string', description: 'Target persona title' },
        mbtiCategory: {
          type: 'string',
          enum: ['Analytical', 'Driver', 'Expressive', 'Amiable'],
          description: 'MBTI communication category for message adaptation',
        },
      },
    },
  },

  {
    name: 'get_competitive_positioning',
    description: 'Get competitive positioning intelligence against a specific competitor. Returns differentiation points, landmines to avoid, winning themes, and battlecard data.',
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
      },
      required: ['competitorName'],
    },
  },

  {
    name: 'classify_opportunity',
    description: 'Classify an opportunity with full analysis: ICP fit score, persona match, disqualification check, risk assessment, and recommended next actions. Combines multiple engines for a comprehensive assessment.',
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
      },
      required: ['companyName'],
    },
  },

  {
    name: 'get_account_plan',
    description: 'Get a structured account plan for a target company. Returns stakeholder map, value propositions, capability gaps, meeting prep, MEDDICC assessment, and CRM update package. Requires an existing Pure Signal ICP pipeline.',
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
    description: "Get a structured capability profile for the authenticated user's product. Returns capabilities, target customer, verified outcomes, trust signals, pricing model, and integrations. Includes values-based alignment scoring. Designed for buyer-side agent evaluation.",
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
    description: "Evaluate seller-buyer alignment across Andru's 6 values: Empathy (pain point coverage), Clarity (outcome specificity), Authenticity (claim verification), Focus (feature relevance), Accountability (outcome tracking), Alignment (mutual investment). Returns scores 0-100 per dimension plus overall.",
    inputSchema: {
      type: 'object',
      properties: {
        buyerPainPoints: {
          type: 'array',
          items: { type: 'string' },
          description: "Buyer's known pain points",
        },
        buyerIndustry: { type: 'string', description: "Buyer's industry" },
        buyerSize: { type: 'string', description: 'Buyer company size' },
        requiredCapabilities: {
          type: 'array',
          items: { type: 'string' },
          description: 'Capabilities the buyer needs',
        },
      },
    },
  },

  {
    name: 'get_icp_profile',
    description: 'Get the full Pure Signal ICP profile. Returns all 5 intelligence layers (Product-Market, Role, Psychological, Timing, Channel), the seven critical buyer questions, and anti-patterns/disqualifiers. Optionally filter to specific layers.',
    inputSchema: {
      type: 'object',
      properties: {
        layers: {
          type: 'array',
          items: { type: 'number', enum: [1, 2, 3, 4, 5] },
          description: 'Specific layers to include (1-5). Omit for all layers.',
        },
        includeSevenAnswers: { type: 'boolean', description: 'Include seven answers (default: true)' },
        includeAntiPatterns: { type: 'boolean', description: 'Include anti-patterns (default: true)' },
      },
    },
  },

  {
    name: 'discover_prospects',
    description: 'Discover companies that match your ICP using AI-powered web search. Returns a list of prospects with confidence scores and evidence. NOTE: This is an expensive operation that calls Claude API with web search — it may take 15-30 seconds and consumes AI credits.',
    inputSchema: {
      type: 'object',
      properties: {
        companyName: {
          type: 'string',
          description: 'Your company name',
        },
        productDescription: {
          type: 'string',
          description: 'Description of your product or service',
        },
        coreCapability: {
          type: 'string',
          description: 'Your core capability or "pure signal" — the single most important thing your product does',
        },
        industry: {
          type: 'string',
          description: 'Target industry to search within (optional)',
        },
        targetMarket: {
          type: 'string',
          description: 'Target market segment (optional, e.g., "Series A SaaS companies")',
        },
      },
      required: ['companyName', 'productDescription'],
    },
  },

  {
    name: 'get_pre_brief',
    description: 'Generate a pre-meeting brief with talk track, discovery questions, objection prep, and contextual intelligence. Provide an eventId for calendar-linked briefs, or provide meeting context directly. NOTE: This calls the AI API and consumes credits.',
    inputSchema: {
      type: 'object',
      properties: {
        eventId: {
          type: 'string',
          description: 'Calendar event ID (from Andru calendar integration). If provided, pulls all context automatically.',
        },
        dealId: {
          type: 'string',
          description: 'Associated deal ID for additional deal intelligence (optional)',
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
    description: 'Check the sync status of your ICP intelligence across connected CRM platforms (HubSpot, Salesforce, Pipedrive). Shows which platforms are up to date, which are stale, and the last sync time for each.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  {
    name: 'trigger_syndication',
    description: 'Manually trigger ICP intelligence syndication to your connected CRM platforms (HubSpot, Salesforce, Pipedrive). Detects which platforms are stale and pushes updated ICP data. Use get_syndication_status first to check which platforms need updating.',
    inputSchema: {
      type: 'object',
      properties: {
        platforms: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional filter — only sync these platforms (e.g., ["hubspot"]). If omitted, syncs all stale platforms.',
        },
      },
    },
  },

  {
    name: 'batch_fit_score',
    description: 'Score multiple companies against ICP criteria in a single batch. Returns individual scores plus aggregate statistics. Max 50 companies per call.',
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
    description: 'Your canonical Ideal Customer Profile — the Pure Signal ICP output including all 5 layers of intelligence, 7 critical answers, and anti-patterns.',
    mimeType: 'application/json',
  },
  {
    uri: 'andru://pipeline/runs',
    name: 'Pipeline Runs',
    description: 'Your GTM pipeline runs — lists all completed pipeline runs with their stage outputs (ICP, Lead Gen Strategy, Account Plans, Overview Deck).',
    mimeType: 'application/json',
  },
  {
    uri: 'andru://accounts',
    name: 'Account Plans',
    description: 'Your account plans — company summaries, tiers, pipeline values, stakeholder counts, and generation status.',
    mimeType: 'application/json',
  },
];
