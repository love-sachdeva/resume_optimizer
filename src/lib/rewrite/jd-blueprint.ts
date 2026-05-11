import { ROLE_PACKS, SEMANTIC_CLUSTERS, STOPWORDS } from "@/lib/constants";
import type {
  EvidenceMapItem,
  JobDescriptionProfile,
  QuestionnaireAnswers,
  ResumeProfile
} from "@/lib/schemas";
import { titleCase } from "@/lib/utils";

type RolePack = (typeof ROLE_PACKS)[number];

export type JdPositioningBlueprint = {
  positioningArchetype: string;
  priorityKeywords: string[];
  operatingLanguage: string[];
  successMetrics: string[];
  recruiterStory: string;
  evidenceMap: EvidenceMapItem[];
  supportedKeywords: string[];
  adjacentKeywords: string[];
  questionNeededKeywords: string[];
  unsupportedCriticalGaps: string[];
  scoreReachability: "target-90" | "best-effort" | "capped";
};

const ROLE_ARCHETYPES = [
  {
    id: "applied-ai-engineering",
    label: "Applied AI Engineering",
    signals: ["applied ai", "ai engineer", "llm", "rag", "model evaluation", "prompt", "inference"],
    keywords: ["LLMs", "RAG", "Model Evaluation", "Python", "APIs", "Deployment", "Experimentation"]
  },
  {
    id: "people-hr",
    label: "People / HR",
    signals: ["hr", "human resources", "people ops", "talent acquisition", "recruiting", "employee engagement"],
    keywords: ["Talent Acquisition", "Employee Engagement", "HR Ops", "Stakeholder Management", "Onboarding", "HRIS"]
  },
  {
    id: "founders-office",
    label: "Founder’s Office / BizOps",
    signals: ["founder's office", "founders office", "chief of staff", "ceo office", "bizops", "founder"],
    keywords: ["OKRs", "Business Metrics", "Operating Cadence", "Cross-functional Execution", "Leadership Reviews"]
  },
  {
    id: "finance-fpa",
    label: "Finance / FP&A",
    signals: ["fp&a", "finance", "financial planning", "forecast", "budget", "variance", "p&l"],
    keywords: ["Financial Modeling", "Forecasting", "Variance Analysis", "P&L", "Budgeting", "ROI"]
  },
  {
    id: "data-analytics",
    label: "Data / Analytics",
    signals: ["data analyst", "analytics", "dashboard", "sql", "business intelligence", "reporting"],
    keywords: ["SQL", "Dashboarding", "KPI Tracking", "Data Quality", "Cohort Analysis", "Executive Reporting"]
  },
  {
    id: "marketing-growth",
    label: "Marketing / Growth",
    signals: ["marketing", "growth", "performance marketing", "seo", "content", "campaign", "conversion"],
    keywords: ["Campaigns", "Conversion Funnel", "Performance Marketing", "SEO", "ROAS", "Lifecycle Marketing"]
  },
  {
    id: "operations-program",
    label: "Operations / Program Management",
    signals: ["program manager", "program management", "operations", "launch", "rollout", "process", "sop"],
    keywords: ["Program Management", "Launch Execution", "SOPs", "Stakeholder Management", "KPI Tracking", "Risk Management"]
  },
  {
    id: "product-management",
    label: "Product Management",
    signals: ["product manager", "product management", "product development", "feature development", "prd", "roadmap", "mvp", "user research"],
    keywords: ["PRDs", "Roadmaps", "User Research", "MVP Definition", "Product Development", "Product Metrics", "Prioritization"]
  },
  {
    id: "sales-customer-success",
    label: "Sales / Customer Success",
    signals: ["sales", "customer success", "account management", "renewal", "pipeline", "crm"],
    keywords: ["Pipeline", "Customer Success", "Renewals", "CRM", "Account Health", "Stakeholder Management"]
  }
] as const;

const METRIC_PATTERNS = [
  "CAC",
  "ROAS",
  "LTV",
  "ARR",
  "MRR",
  "NPS",
  "CTR",
  "CPC",
  "conversion",
  "activation",
  "retention",
  "repeat rate",
  "fill rate",
  "order frequency",
  "revenue",
  "margin",
  "cost",
  "uptime",
  "latency",
  "accuracy",
  "precision",
  "recall",
  "time to hire",
  "attrition",
  "engagement"
];

const HARD_GAP_PATTERNS = [
  /\b(ca|cfa|cpa|frm|acca)\b/i,
  /\b(workday|successfactors|greenhouse|lever)\b/i,
  /\b(rag|llmops|model evaluation|fine[-\s]?tuning)\b/i,
  /\b(sql|python|tableau|power bi|excel)\b/i,
  /\b(\d+\+?\s+years?)\b/i
];

function normalizeText(...parts: Array<string | undefined>) {
  return parts.filter(Boolean).join(" ").toLowerCase().replace(/[–—-]/g, " ");
}

function normalizePhrase(value: string) {
  return value
    .replace(/[^\w+#./& -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mergeUnique(...groups: Array<ReadonlyArray<string | undefined> | undefined>) {
  const seen = new Set<string>();
  const output: string[] = [];

  groups.flat().forEach((item) => {
    const clean = normalizePhrase(String(item ?? ""));
    if (!clean) {
      return;
    }
    const key = clean.toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    output.push(normalizeAcronyms(clean));
  });

  return output;
}

function normalizeAcronyms(value: string) {
  return value
    .replace(/\bAi\b/g, "AI")
    .replace(/\bLlm(s?)\b/g, "LLM$1")
    .replace(/\bRag\b/g, "RAG")
    .replace(/\bApi(s?)\b/g, "API$1")
    .replace(/\bSql\b/g, "SQL")
    .replace(/\bHris\b/g, "HRIS")
    .replace(/\bOkrs\b/g, "OKRs")
    .replace(/\bKpi\b/g, "KPI")
    .replace(/\bCac\b/g, "CAC")
    .replace(/\bRoas\b/g, "ROAS")
    .replace(/\bFpa\b/g, "FP&A")
    .replace(/\bP&l\b/g, "P&L");
}

function extractNgrams(text: string) {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9+#/& -]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
  const phrases: string[] = [];

  for (let size = 3; size >= 1; size -= 1) {
    for (let index = 0; index <= tokens.length - size; index += 1) {
      const phrase = tokens.slice(index, index + size).join(" ");
      if (phrase.length >= 4) {
        phrases.push(phrase);
      }
    }
  }

  const counts = new Map<string, number>();
  phrases.forEach((phrase) => counts.set(phrase, (counts.get(phrase) ?? 0) + 1));

  return [...counts.entries()]
    .filter(([phrase, count]) => count > 1 || /ai|sql|hr|gtm|finance|analytics|launch|customer|marketing|operations|product|program/.test(phrase))
    .sort((left, right) => right[1] - left[1] || right[0].length - left[0].length)
    .slice(0, 18)
    .map(([phrase]) => titleCase(phrase));
}

function buildResumeEvidence(resume: ResumeProfile, answers?: QuestionnaireAnswers) {
  return [
    { source: "skills" as const, text: resume.skills.join(", ") },
    { source: "certification" as const, text: resume.certifications.join(" ") },
    { source: "answers" as const, text: Object.values(answers ?? {}).join(" ") },
    ...resume.experiences.flatMap((experience) =>
      experience.bullets.map((bullet) => ({
        source: "resume" as const,
        text: `${experience.title} ${experience.company} ${bullet}`
      }))
    ),
    ...resume.projects.flatMap((project) =>
      [project.description, ...project.bullets, ...project.technologies].map((text) => ({
        source: "project" as const,
        text: `${project.name} ${text}`
      }))
    )
  ].filter((item) => item.text.trim());
}

function keywordTokens(keyword: string) {
  return keyword
    .toLowerCase()
    .replace(/[^a-z0-9+#]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

function tokenVariants(token: string) {
  const variants = new Set([token]);
  if (token.endsWith("s")) {
    variants.add(token.slice(0, -1));
  } else {
    variants.add(`${token}s`);
  }
  if (token.endsWith("ies")) {
    variants.add(`${token.slice(0, -3)}y`);
  }
  return [...variants].filter((item) => item.length > 2);
}

function textHasToken(text: string, token: string) {
  return tokenVariants(token).some((variant) => text.includes(variant));
}

function evidenceForKeyword(keyword: string, evidenceItems: ReturnType<typeof buildResumeEvidence>): EvidenceMapItem {
  const lowerKeyword = keyword.toLowerCase();
  const tokens = keywordTokens(keyword);
  const exact = evidenceItems.find((item) => item.text.toLowerCase().includes(lowerKeyword));
  if (exact) {
    return {
      keyword,
      status: "directly-supported",
      evidence: [exact.text.slice(0, 180)],
      source: exact.source,
      confidence: 0.95
    };
  }

  const adjacent = evidenceItems.find((item) => {
    const lowerText = item.text.toLowerCase();
    return tokens.length > 0 && tokens.some((token) => textHasToken(lowerText, token));
  });

  if (adjacent && tokens.length <= 2) {
    return {
      keyword,
      status: "adjacent",
      evidence: [adjacent.text.slice(0, 180)],
      source: adjacent.source,
      confidence: 0.72
    };
  }

  if (adjacent && tokens.length > 2 && tokens.filter((token) => textHasToken(adjacent.text.toLowerCase(), token)).length >= 2) {
    return {
      keyword,
      status: "adjacent",
      evidence: [adjacent.text.slice(0, 180)],
      source: adjacent.source,
      confidence: 0.68
    };
  }

  return {
    keyword,
    status: HARD_GAP_PATTERNS.some((pattern) => pattern.test(keyword)) ? "question-needed" : "unsupported",
    evidence: [],
    source: "none",
    confidence: 0
  };
}

function inferArchetype(jd: JobDescriptionProfile) {
  const haystack = normalizeText(
    jd.roleTitle,
    jd.roleFamily,
    jd.rawText,
    jd.mustHaveKeywords.join(" "),
    jd.domainKeywords.join(" "),
    jd.responsibilities.join(" ")
  );

  const scored = ROLE_ARCHETYPES.map((archetype) => ({
    archetype,
    score: archetype.signals.reduce(
      (total, signal) => total + (haystack.includes(signal) ? signal.split(/\s+/).length : 0),
      0
    )
  })).sort((left, right) => right.score - left.score);

  return scored[0]?.score ? scored[0].archetype : null;
}

function extractPriorityKeywords(jd: JobDescriptionProfile, archetype: (typeof ROLE_ARCHETYPES)[number] | null, rolePack: RolePack | null) {
  const jdText = [
    jd.roleTitle,
    jd.roleFamily,
    jd.rawText,
    ...jd.responsibilities,
    ...jd.qualifications
  ].join(" ");
  const metricKeywords = METRIC_PATTERNS.filter((metric) => jdText.toLowerCase().includes(metric.toLowerCase()));
  const clusterKeywords = Object.entries(SEMANTIC_CLUSTERS)
    .filter(([, words]) => words.some((word) => jdText.toLowerCase().includes(word.toLowerCase())))
    .flatMap(([, words]) => words.slice(0, 3).map(titleCase));

  return mergeUnique(
    jd.mustHaveKeywords,
    jd.toolsKeywords,
    jd.domainKeywords,
    metricKeywords,
    archetype?.keywords,
    rolePack?.keywords,
    clusterKeywords,
    extractNgrams(jdText)
  ).slice(0, 36);
}

function findHardUnsupportedGaps(jd: JobDescriptionProfile, evidenceMap: EvidenceMapItem[]) {
  const critical = new Set(
    jd.mustHaveKeywords
      .filter((keyword) => HARD_GAP_PATTERNS.some((pattern) => pattern.test(keyword)))
      .map((keyword) => keyword.toLowerCase())
  );
  jd.hardFilters.forEach((filter) => {
    if (filter.required) {
      critical.add(filter.value.toLowerCase());
    }
  });

  return evidenceMap
    .filter((item) =>
      critical.has(item.keyword.toLowerCase()) &&
      item.status !== "directly-supported" &&
      item.status !== "adjacent"
    )
    .map((item) => item.keyword);
}

function inferReachability(evidenceMap: EvidenceMapItem[], unsupportedCriticalGaps: string[]) {
  if (unsupportedCriticalGaps.length > 0) {
    return "capped" as const;
  }
  const supportedCount = evidenceMap.filter((item) => item.status === "directly-supported" || item.status === "adjacent").length;
  const ratio = supportedCount / Math.max(evidenceMap.length, 1);
  if (ratio >= 0.72) {
    return "target-90" as const;
  }
  return "best-effort" as const;
}

export function buildJdPositioningBlueprint(input: {
  resume: ResumeProfile;
  jd: JobDescriptionProfile;
  answers?: QuestionnaireAnswers;
  rolePack: RolePack | null;
}): JdPositioningBlueprint {
  const archetype = inferArchetype(input.jd);
  const priorityKeywords = extractPriorityKeywords(input.jd, archetype, input.rolePack);
  const evidenceItems = buildResumeEvidence(input.resume, input.answers);
  const evidenceMap = priorityKeywords.map((keyword) => evidenceForKeyword(keyword, evidenceItems));
  const supportedKeywords = evidenceMap
    .filter((item) => item.status === "directly-supported" || (item.status === "adjacent" && item.confidence >= 0.68))
    .map((item) => item.keyword);
  const adjacentKeywords = evidenceMap.filter((item) => item.status === "adjacent").map((item) => item.keyword);
  const questionNeededKeywords = evidenceMap.filter((item) => item.status === "question-needed").map((item) => item.keyword);
  const unsupportedCriticalGaps = findHardUnsupportedGaps(input.jd, evidenceMap);
  const scoreReachability = inferReachability(evidenceMap, unsupportedCriticalGaps);
  const positioningArchetype = archetype?.id ?? input.rolePack?.id ?? "jd-derived-general";
  const operatingLanguage = mergeUnique(
    input.jd.responsibilities,
    input.jd.qualifications,
    priorityKeywords.filter((keyword) => /launch|operate|execute|build|manage|own|analy|lead|partner|design|develop/i.test(keyword))
  ).slice(0, 8);
  const successMetrics = priorityKeywords.filter((keyword) =>
    METRIC_PATTERNS.some((metric) => keyword.toLowerCase().includes(metric.toLowerCase()))
  );

  return {
    positioningArchetype,
    priorityKeywords,
    operatingLanguage,
    successMetrics,
    recruiterStory: `${input.jd.roleTitle || archetype?.label || "Target role"} positioning built around ${priorityKeywords.slice(0, 5).join(", ")}.`,
    evidenceMap,
    supportedKeywords,
    adjacentKeywords,
    questionNeededKeywords,
    unsupportedCriticalGaps,
    scoreReachability
  };
}
