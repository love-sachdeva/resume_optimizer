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
  "skills",
  "technical skills",
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
  fintech: ["payments", "lending", "merchant", "banking", "fintech", "card"],
  saas: ["saas", "subscription", "b2b", "platform", "workflow", "crm"],
  ai: ["ai", "machine learning", "llm", "automation", "genai", "model"],
  ecommerce: ["ecommerce", "checkout", "cart", "conversion", "catalog"],
  consumer: ["consumer", "b2c", "retention", "engagement", "onboarding"],
  enterprise: ["enterprise", "governance", "admin", "procurement", "security"],
  consulting: ["client", "stakeholder", "advisory", "strategy", "workstream"]
};

export const ROLE_ADJACENCY: Record<string, string[]> = {
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
  consultant: ["strategy analyst", "business analyst", "engagement manager"]
};

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
    "backlog"
  ],
  execution: [
    "launch",
    "delivery",
    "coordination",
    "cross-functional",
    "execution",
    "implementation"
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
    "reporting"
  ],
  leadership: [
    "stakeholder",
    "founder",
    "executive",
    "leadership",
    "ownership",
    "decision"
  ],
  technical: [
    "api",
    "integration",
    "automation",
    "data pipeline",
    "system",
    "architecture"
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
