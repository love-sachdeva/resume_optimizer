export const SECTION_HEADINGS = [
  "summary",
  "professional summary",
  "profile",
  "experience",
  "work experience",
  "professional experience",
  "employment",
  "work history",
  "internship",
  "internships",
  "projects",
  "project experience",
  "live projects",
  "business projects",
  "selected deals",
  "automation projects",
  "strategy projects",
  "growth projects",
  "skills",
  "technical skills",
  "business skills",
  "management skills",
  "industry knowledge",
  "tools & technologies",
  "education",
  "certification",
  "certifications",
  "awards",
  "achievements",
  "initiatives",
  "initiatives and achievements",
  "rewards & recognition",
  "founder's ops",
  "founders ops",
  "leadership",
  "positions of responsibility",
  "positions of",
  "por",
  "co-curriculars",
  "co-curricular",
  "extra-curricular",
  "extra curricular",
  "extracurricular",
  "extra-curriculars",
  "activities",
  "community",
  "social",
  "interests",
  "others"
] as const;

export const STOPWORDS = new Set([
  "a",
  "about",
  "across",
  "after",
  "all",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "into",
  "is",
  "experience",
  "experiences",
  "of",
  "on",
  "or",
  "own",
  "our",
  "that",
  "the",
  "their",
  "this",
  "to",
  "with",
  "you",
  "your",
  "will",
  "can",
  "should",
  "have",
  "has",
  "had",
  "using",
  "use",
  "must",
  "required",
  "preferred",
  "plus",
  "year",
  "years"
]);

export const KNOWN_TOOLS = [
  "sql",
  "python",
  "excel",
  "tableau",
  "power bi",
  "jira",
  "confluence",
  "figma",
  "mixpanel",
  "amplitude",
  "ga4",
  "google analytics",
  "notion",
  "salesforce",
  "hubspot",
  "snowflake",
  "bigquery",
  "api",
  "apis",
  "postman",
  "github",
  "looker",
  "metabase",
  "aws",
  "azure",
  "gcp",
  "chatgpt",
  "claude",
  "cursor",
  "copilot",
  "openai"
];

export const DOMAIN_KEYWORDS: Record<string, string[]> = {
  fintech: [
    "payments",
    "lending",
    "digital lending",
    "credit lines",
    "underwriting",
    "kyc",
    "repayment",
    "collections",
    "risk analytics",
    "merchant",
    "banking",
    "fintech",
    "card"
  ],
  saas: ["saas", "subscription", "b2b", "platform", "workflow", "crm"],
  ai: ["ai", "machine learning", "llm", "automation", "genai", "model"],
  ecommerce: ["ecommerce", "checkout", "cart", "conversion", "catalog"],
  consumer: ["consumer", "b2c", "retention", "engagement", "onboarding"],
  enterprise: ["enterprise", "governance", "admin", "procurement", "security"],
  consulting: ["client", "stakeholder", "advisory", "strategy", "workstream"],
  finance: ["finance", "portfolio", "valuation", "forecasting", "risk", "markets"],
  operations: ["process", "sop", "controls", "change management", "operating cadence"],
  growth: ["gtm", "seo", "aeo", "content", "performance marketing", "funnel"]
};

export const ROLE_ADJACENCY: Record<string, string[]> = {
  "chief of staff": [
    "founder's office",
    "founders office",
    "founder office",
    "bizops",
    "business operations",
    "strategy associate",
    "ceo office"
  ],
  "product manager": [
    "associate product manager",
    "program manager",
    "business analyst",
    "founder's office",
    "strategy analyst",
    "growth manager"
  ],
  "software engineer": [
    "developer",
    "full stack engineer",
    "backend engineer",
    "frontend engineer"
  ],
  analyst: ["business analyst", "data analyst", "operations analyst"],
  consultant: ["strategy analyst", "business analyst", "engagement manager"],
  "finance strategy": [
    "strats",
    "strategy analyst",
    "finance analyst",
    "investment analyst",
    "fp&a analyst"
  ],
  "operations transformation": [
    "operations analyst",
    "program manager",
    "process excellence",
    "business transformation",
    "transformation associate"
  ],
  "growth marketing": [
    "growth manager",
    "performance marketing",
    "gtm manager",
    "content strategy",
    "seo strategist"
  ]
};

// Optional role-pack boosters. Dynamic JD keyword extraction remains the primary path;
// these packs only add extra candidate phrases when a JD clearly matches a known role family.
export const ROLE_PACKS = [
  {
    id: "chief-of-staff",
    label: "Founder’s Office / Chief of Staff",
    matchPhrases: [
      "chief of staff",
      "founder's office",
      "founders office",
      "founder office",
      "ceo office",
      "bizops",
      "business operations"
    ],
    keywords: [
      "Founder’s Office",
      "BizOps",
      "OKRs",
      "QBRs",
      "Board Decks",
      "Investor Updates",
      "Operating Cadence",
      "Executive Dashboards",
      "Business Metrics",
      "Cross-functional Governance",
      "Founder Bandwidth"
    ],
    truthSensitiveKeywords: [
      "Board Decks",
      "Investor Updates",
      "Fundraising Support",
      "Hiring Ops",
      "Talent Sourcing"
    ]
  },
  {
    id: "finance-strats",
    label: "Finance / Strats",
    matchPhrases: [
      "strats",
      "finance strategy",
      "private finance",
      "portfolio analytics",
      "financial modeling",
      "investment analyst",
      "fp&a"
    ],
    keywords: [
      "Financial Modeling",
      "Portfolio Analytics",
      "Forecasting",
      "Optimization",
      "Risk Controls",
      "Time Series",
      "Regression",
      "Business Metrics"
    ],
    truthSensitiveKeywords: [
      "Portfolio Analytics",
      "Financial Modeling",
      "Regression",
      "Time Series"
    ]
  },
  {
    id: "ops-transformation",
    label: "Operations Transformation",
    matchPhrases: [
      "operations transformation",
      "business transformation",
      "process excellence",
      "change management",
      "end-state design",
      "risk controls"
    ],
    keywords: [
      "Process Mapping",
      "End-State Design",
      "SOPs",
      "Risk Controls",
      "Change Management",
      "Impact Metrics",
      "Operating Cadence",
      "Stakeholder Management"
    ],
    truthSensitiveKeywords: ["Risk Controls", "Change Management", "End-State Design"]
  },
  {
    id: "fintech-lending-pm",
    label: "Fintech Lending Product",
    matchPhrases: [
      "digital lending",
      "credit line",
      "credit lines",
      "lending product",
      "underwriting",
      "repayment",
      "collections",
      "kyc",
      "portfolio quality",
      "risk analytics"
    ],
    keywords: [
      "Digital Lending",
      "Credit Lines",
      "Onboarding",
      "KYC",
      "Underwriting",
      "Repayment",
      "Collections",
      "Risk Analytics",
      "Compliance",
      "Product Metrics",
      "PRDs",
      "Roadmaps",
      "Activation",
      "Retention",
      "A/B Tests"
    ],
    truthSensitiveKeywords: ["KYC", "Underwriting", "Repayment", "Collections", "Risk Analytics"]
  },
  {
    id: "product-growth",
    label: "Product / Growth",
    matchPhrases: [
      "product manager",
      "growth product",
      "growth manager",
      "activation",
      "retention",
      "funnel"
    ],
    keywords: [
      "MVP Definition",
      "PRDs",
      "Roadmaps",
      "Prioritization",
      "User Research",
      "Product Metrics",
      "Experimentation",
      "Funnel Analysis",
      "Launch Planning",
      "Activation",
      "Retention",
      "A/B Tests"
    ],
    truthSensitiveKeywords: ["User Research", "Product Metrics", "Experimentation"]
  },
  {
    id: "consulting",
    label: "Consulting / Strategy",
    matchPhrases: [
      "consultant",
      "strategy consultant",
      "business analyst",
      "workstream",
      "client outcomes"
    ],
    keywords: [
      "Workstream Ownership",
      "Client Outcomes",
      "Executive Communication",
      "Problem Structuring",
      "Stakeholder Alignment",
      "Business Case"
    ],
    truthSensitiveKeywords: ["Client Outcomes", "Executive Communication", "Business Case"]
  },
  {
    id: "analytics-data",
    label: "Analytics / Data",
    matchPhrases: [
      "data analyst",
      "business analyst",
      "analytics",
      "dashboard",
      "sql",
      "metrics"
    ],
    keywords: [
      "SQL",
      "Dashboarding",
      "KPI Tracking",
      "Funnel Analysis",
      "Forecasting",
      "Data Quality",
      "Executive Reporting"
    ],
    truthSensitiveKeywords: ["SQL", "Forecasting", "Executive Reporting"]
  },
  {
    id: "gtm-marketing",
    label: "GTM / Marketing",
    matchPhrases: [
      "gtm",
      "seo",
      "aeo",
      "answer engine optimization",
      "performance marketing",
      "content strategy",
      "digital growth"
    ],
    keywords: [
      "GTM",
      "Performance Marketing",
      "SEO Strategy",
      "AEO",
      "Content Engine",
      "Conversion Funnel",
      "AI-led Growth"
    ],
    truthSensitiveKeywords: ["Performance Marketing", "SEO Strategy", "AEO", "Content Engine"]
  },
  {
    id: "gtm-program-launch",
    label: "GTM / Program Launch",
    matchPhrases: [
      "gtm lead",
      "go-to-market",
      "go to market",
      "city launch",
      "city launches",
      "market expansion",
      "category rollout",
      "category rollouts",
      "program manager",
      "program management",
      "quick commerce",
      "hyperlocal",
      "community building",
      "apartment activation"
    ],
    keywords: [
      "City Launches",
      "Hyperlocal GTM",
      "Category Rollouts",
      "Community Building",
      "Apartment Activation",
      "Launch Playbooks",
      "Cross-functional Execution",
      "KPI Tracking",
      "CAC",
      "Repeat Rate",
      "Fill Rate",
      "Funnel Analysis",
      "Performance Tracking",
      "Consumer Intelligence"
    ],
    truthSensitiveKeywords: [
      "City Launches",
      "Apartment Activation",
      "CAC",
      "Repeat Rate",
      "Fill Rate"
    ]
  }
] as const;

export const SENIORITY_KEYWORDS: Record<string, string[]> = {
  intern: ["intern", "trainee"],
  entry: ["associate", "junior", "analyst", "coordinator"],
  mid: ["manager", "specialist", "lead"],
  senior: ["senior", "principal", "staff", "director", "head"]
};

export const SEMANTIC_CLUSTERS: Record<string, string[]> = {
  discovery: [
    "research",
    "interview",
    "survey",
    "customer feedback",
    "discovery",
    "insight"
  ],
  planning: [
    "roadmap",
    "scope",
    "prioritization",
    "prd",
    "requirements",
    "backlog",
    "mvp",
    "end-state",
    "end state"
  ],
  execution: [
    "launch",
    "delivery",
    "coordination",
    "cross-functional",
    "execution",
    "implementation",
    "rollout",
    "change management"
  ],
  growth: [
    "activation",
    "conversion",
    "retention",
    "funnel",
    "growth",
    "experimentation"
  ],
  analytics: [
    "analysis",
    "dashboard",
    "sql",
    "metric",
    "forecast",
    "reporting",
    "kpi",
    "business metrics"
  ],
  leadership: [
    "stakeholder",
    "founder",
    "executive",
    "leadership",
    "ownership",
    "decision",
    "operating cadence",
    "board deck",
    "investor update"
  ],
  technical: [
    "api",
    "integration",
    "automation",
    "data pipeline",
    "system",
    "architecture"
  ],
  operations: [
    "process mapping",
    "sop",
    "risk control",
    "governance",
    "operating cadence",
    "service reliability"
  ],
  finance: [
    "financial modeling",
    "portfolio",
    "valuation",
    "forecasting",
    "regression",
    "time series",
    "risk"
  ],
  gtm: [
    "gtm",
    "seo",
    "aeo",
    "content engine",
    "performance marketing",
    "roas",
    "conversion",
    "city launch",
    "hyperlocal",
    "category rollout",
    "community",
    "apartment activation",
    "launch playbook",
    "cac",
    "repeat rate",
    "fill rate"
  ]
};

export const MONTH_NAMES = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec"
];
