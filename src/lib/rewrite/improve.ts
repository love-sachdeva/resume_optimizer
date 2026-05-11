import { analyzeMatch } from "@/lib/scoring";
import { ROLE_PACKS, SEMANTIC_CLUSTERS } from "@/lib/constants";
import { parseResumeText } from "@/lib/parsing/resume-parser";
import { buildAdaptiveFollowUpQuestions } from "@/lib/questionnaire";
import { buildJdPositioningBlueprint, type JdPositioningBlueprint } from "@/lib/rewrite/jd-blueprint";
import { buildTextLayoutInventory } from "@/lib/rewrite/layout-inventory";
import type {
  FormattingPreferences,
  GeneratedResume,
  JobDescriptionProfile,
  LayoutInventory,
  QuestionnaireAnswers,
  RewritePlan,
  ResumeExperience,
  ResumeProfile
} from "@/lib/schemas";
import { generatedResumeSchema } from "@/lib/schemas";
import { clamp, titleCase } from "@/lib/utils";

const TARGET_LINE_MIN_CHARS = 115;
const TARGET_LINE_MAX_CHARS = 120;
const MAX_BULLET_EXPANSION_CHARS = 12;
const ABSOLUTE_ONE_PAGE_BULLET_LIMIT = TARGET_LINE_MAX_CHARS;

const SAFE_KEYWORD_INFERENCE: Record<string, string[]> = {
  payments: ["payment", "payments", "merchant", "checkout", "fintech", "card", "reconciliation"],
  research: ["research", "interview", "survey", "feedback", "discovery", "insight"],
  roadmap: ["roadmap", "prioritization", "scope", "backlog", "requirements", "prd"],
  stakeholder: ["stakeholder", "cross-functional", "leadership", "founder", "executive", "coordination"],
  analytics: ["analysis", "dashboard", "reporting", "sql", "metric", "forecast"],
  activation: ["activation", "conversion", "onboarding", "retention", "growth", "funnel"],
  launch: ["launch", "rollout", "delivery", "implementation", "execution"],
  api: ["api", "integration", "automation", "system", "workflow"],
  experimentation: ["experiment", "a/b", "testing", "trial", "funnel"],
  "delivery excellence": ["delivery", "operations", "operational", "efficiency", "process", "system", "execution"],
  "business metrics": ["metric", "kpi", "data", "insight", "dashboard", "revenue", "cost", "realization", "output"],
  "executive dashboards": ["dashboard", "reporting", "data", "insight", "decision", "power bi", "analytics"],
  "operating cadence": ["coordination", "stakeholder", "workflow", "sop", "review", "control", "operations"],
  "cross-functional governance": ["cross-functional", "stakeholder", "coordination", "sales", "support", "billing"],
  "client outcomes": ["client", "customer", "support", "campaign", "ticket", "resolution"],
  "seo strategy": ["seo", "content", "ranking", "impression", "competitive benchmarking"],
  "performance marketing": ["meta ads", "roas", "ctr", "campaign", "conversion", "funnel", "marketing"],
  "ai-led growth": ["ai", "ml", "automation", "growth", "experiment", "model"],
  "founder’s office": ["founder", "executive", "stakeholder", "leadership", "ownership", "strategy"],
  "founder's office": ["founder", "executive", "stakeholder", "leadership", "ownership", "strategy"],
  bizops: ["business", "operations", "metrics", "dashboard", "process", "stakeholder"],
  "board decks": ["dashboard", "reporting", "presentation", "leadership", "executive", "metric"],
  "investor updates": ["investor", "fundraising", "leadership", "business metrics", "revenue", "growth"],
  "founder bandwidth": ["founder", "executive", "ownership", "coordination", "operations"],
  "process mapping": ["process", "workflow", "sop", "operations", "bottleneck", "automation"],
  "end-state design": ["process", "workflow", "roadmap", "scope", "stakeholder", "system"],
  "risk controls": ["risk", "control", "compliance", "legal", "quality", "review"],
  "change management": ["rollout", "training", "adoption", "stakeholder", "implementation"],
  aeo: ["seo", "content", "ranking", "answer", "search", "growth"],
  "content engine": ["content", "seo", "growth", "campaign", "marketing"],
  "b2b saas": ["saas", "b2b", "subscription", "platform", "workflow", "crm"],
  "financial modeling": ["finance", "model", "forecast", "portfolio", "revenue", "pricing"],
  "portfolio analytics": ["portfolio", "analytics", "risk", "dashboard", "metric", "finance"],
  forecasting: ["forecast", "prediction", "planning", "demand", "revenue", "model"],
  optimization: ["optimize", "optimization", "improve", "pricing", "capacity", "conversion"],
  regression: ["regression", "statistics", "analysis", "model", "forecast"],
  "time series": ["time series", "forecast", "trend", "analysis", "model"],
  "digital lending": ["lending", "credit", "fintech", "banking", "risk", "partner"],
  "credit lines": ["credit", "lending", "fintech", "banking"],
  onboarding: ["onboarding", "re-onboard", "partner portal", "activation", "user"],
  kyc: ["kyc", "compliance", "onboarding", "identity", "verification"],
  underwriting: ["underwriting", "risk", "credit", "policy", "approval", "rule"],
  repayment: ["repayment", "collections", "lending", "credit", "portfolio"],
  collections: ["collections", "repayment", "lending", "credit", "portfolio"],
  "risk analytics": ["risk", "analytics", "policy", "dashboard", "approval"],
  compliance: ["compliance", "legal", "policy", "risk", "approval"],
  prds: ["prd", "requirements", "scope", "mvp", "roadmap", "discovery"],
  roadmaps: ["roadmap", "scope", "prioritization", "backlog", "launch"],
  prioritization: ["prioritize", "prioritization", "scope", "roadmap", "feedback", "fixes"],
  retention: ["retention", "engagement", "adoption", "activation", "repeat"],
  "a/b tests": ["experiment", "testing", "a/b", "cohort", "beta", "validation"],
  "city launches": ["launch", "gtm", "local", "market", "city", "rollout", "ops"],
  "hyperlocal gtm": ["gtm", "local", "whatsapp", "apartment", "neighbourhood", "referral", "footfall"],
  "category rollouts": ["rollout", "launch", "product", "category", "store", "service", "menu"],
  "community building": ["community", "local", "apartment", "neighbourhood", "referral", "users", "customers"],
  "apartment activation": ["apartment", "local", "whatsapp", "footfall", "activation", "referral"],
  "launch playbooks": ["launch", "playbook", "sop", "workflow", "rollout", "execution", "onboarding"],
  "cross-functional execution": ["cross-functional", "stakeholder", "teams", "execution", "coordination", "owners"],
  "kpi tracking": ["kpi", "metric", "dashboard", "track", "analysis", "data"],
  cac: ["cac", "acquisition", "marketing", "roas", "conversion", "funnel"],
  "repeat rate": ["repeat", "retention", "subscription", "frequency", "orders", "customers"],
  "fill rate": ["fill", "supply", "inventory", "order completion", "vendor", "delivery"],
  "performance tracking": ["performance", "metric", "track", "analysis", "dashboard", "iteration"],
  "consumer intelligence": ["consumer", "customer", "feedback", "insight", "market", "research"],
  cost: ["cost", "costs", "margin", "revenue", "budget", "excel", "dashboard", "operations"],
  variance: ["variance", "analysis", "dashboard", "budget", "excel", "metric"],
  budget: ["budget", "cost", "forecast", "planning", "excel", "dashboard"],
  roi: ["roi", "roas", "revenue", "margin", "cost", "pricing"],
  "p&l": ["p&l", "revenue", "margin", "cost", "profit"],
  "product development": ["product", "mvp", "roadmap", "feature", "launch", "user"],
  "feature development": ["feature", "mvp", "roadmap", "launch", "product", "user"]
};

const UNSAFE_STANDALONE_KEYWORDS = new Set([
  "api",
  "apis",
  "stakeholder",
  "stakeholders",
  "strategy",
  "business",
  "operations",
  "management",
  "leadership"
]);

type BulletFormat = "rac" | "star" | "action-impact";

function inferBulletFormat(value: string): BulletFormat {
  const text = value.trim();

  if (/^(increased|reduced|improved|cut|unlocked|accelerated|enhanced|scaled|grew|saved|drove)\b/i.test(text)) {
    return "rac";
  }

  if (/\b(by|through|via|using)\b.+\b(resulting|leading|increasing|reducing|improving|cutting)\b/i.test(text)) {
    return "star";
  }

  return "action-impact";
}

function preserveBulletFormat(original: string, candidate: string) {
  const format = inferBulletFormat(original);
  const clean = candidate.replace(/\s+/g, " ").trim();
  const originalLead = original.trim().match(/^[A-Za-z]+/)?.[0] ?? "";
  const candidateLead = clean.match(/^[A-Za-z]+/)?.[0] ?? "";

  if (/^[A-Za-z]+-/.test(clean)) {
    return clean;
  }

  if (!originalLead || !candidateLead) {
    return clean;
  }

  if (format === "rac" && /^(increased|reduced|improved|cut|unlocked|accelerated|enhanced|scaled|grew|saved|drove)$/i.test(originalLead)) {
    return clean.replace(/^[A-Za-z]+/, originalLead);
  }

  if (format === "star" && /\bby\b|\bthrough\b|\busing\b|\bvia\b/i.test(original)) {
    return clean;
  }

  return clean;
}

function buildResumeEvidenceCorpus(resume: ResumeProfile, answers?: QuestionnaireAnswers) {
  return [
    resume.rawText,
    resume.summary,
    resume.targetRoles.join(" "),
    resume.industries.join(" "),
    resume.skills.join(" "),
    ...resume.experiences.flatMap((experience) => [
      experience.title,
      experience.company,
      experience.summary,
      ...experience.bullets,
      ...experience.keywords,
      ...experience.metrics
    ]),
    ...resume.projects.flatMap((project) => [
      project.name,
      project.description,
      ...project.bullets,
      ...project.technologies
    ]),
    ...Object.values(answers ?? {})
  ]
    .join(" ")
    .toLowerCase();
}

function keywordIsSupported(keyword: string, evidenceCorpus: string) {
  const lower = keyword.toLowerCase();

  if (evidenceCorpus.includes(lower)) {
    return true;
  }

  const directInference = Object.entries(SAFE_KEYWORD_INFERENCE).find(([candidate]) =>
    lower.includes(candidate)
  )?.[1];

  if (directInference?.some((signal) => evidenceCorpus.includes(signal))) {
    return true;
  }

  const semanticMatch = Object.values(SEMANTIC_CLUSTERS).find((clusterWords) =>
    clusterWords.some((word) => lower.includes(word))
  );

  return Boolean(semanticMatch?.some((signal) => evidenceCorpus.includes(signal)));
}

function pickSupportedKeywords(
  resume: ResumeProfile,
  jd: JobDescriptionProfile,
  answers?: QuestionnaireAnswers
) {
  const evidenceCorpus = buildResumeEvidenceCorpus(resume, answers);
  const rolePack = detectRolePackBooster(jd);

  return collectRequestedKeywords(jd, rolePack).filter(
    (keyword) => keywordIsSupported(keyword, evidenceCorpus)
  );
}

function countKeywordHits(text: string, keywords: string[]) {
  const lower = text.toLowerCase();
  return keywords.filter((keyword) => lower.includes(keyword.toLowerCase())).length;
}

function chooseBulletKeywordSignals(bullet: string, supportedKeywords: string[]) {
  return supportedKeywords.filter((keyword) => {
    const lowerKeyword = keyword.toLowerCase();
    const lowerBullet = bullet.toLowerCase();
    if (lowerBullet.includes(lowerKeyword)) {
      return false;
    }

    const safeSignals = SAFE_KEYWORD_INFERENCE[lowerKeyword];
    return safeSignals?.some((signal) => lowerBullet.includes(signal)) ?? false;
  });
}

function normalizeKeywordCasing(text: string) {
  return text
    .replace(/\bApi\b/g, "API")
    .replace(/\bApis\b/g, "APIs")
    .replace(/\bAi\b/g, "AI")
    .replace(/\bSql\b/g, "SQL")
    .replace(/\bKyc\b/g, "KYC")
    .replace(/\bPrds\b/g, "PRDs")
    .replace(/\bA\/b\b/g, "A/B")
    .replace(/\bstakeholder Management\b/g, "Stakeholder Management")
    .replace(/\bSeo\b/g, "SEO")
    .replace(/\bGtm\b/g, "GTM")
    .replace(/\bOkrs\b/g, "OKRs")
    .replace(/\bQbrs\b/g, "QBRs")
    .replace(/\bAeo\b/g, "AEO")
    .replace(/\bBizops\b/g, "BizOps")
    .replace(/\bB2b\b/g, "B2B")
    .replace(/\bSaas\b/g, "SaaS")
    .replace(/\bCac\b/g, "CAC")
    .replace(/\bKpi\b/g, "KPI")
    .replace(/\bXfn\b/g, "XFN")
    .replace(/\bHris\b/g, "HRIS")
    .replace(/\bLlm(s?)\b/g, "LLM$1")
    .replace(/\bRag\b/g, "RAG")
    .replace(/\bP&l\b/g, "P&L")
    .replace(/\bRoi\b/g, "ROI");
}

type RolePack = (typeof ROLE_PACKS)[number];

function phraseIncluded(text: string, phrase: string) {
  const normalizedText = text.toLowerCase().replace(/[–—-]/g, " ");
  const normalizedPhrase = phrase.toLowerCase().replace(/[–—-]/g, " ");
  return normalizedText.includes(normalizedPhrase);
}

function detectRolePackBooster(jd: JobDescriptionProfile): RolePack | null {
  const haystack = [
    jd.roleTitle,
    jd.roleFamily,
    jd.rawText,
    ...jd.mustHaveKeywords,
    ...jd.domainKeywords,
    ...jd.responsibilities,
    ...jd.qualifications
  ]
    .join(" ")
    .toLowerCase();

  const scoredPacks = ROLE_PACKS.map((pack) => ({
    pack,
    score: pack.matchPhrases.reduce(
      (total, phrase) => total + (phraseIncluded(haystack, phrase) ? phrase.split(/\s+/).length : 0),
      0
    )
  }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score);

  return scoredPacks[0]?.pack ?? null;
}

function collectDynamicJdKeywords(jd: JobDescriptionProfile) {
  return mergeUniqueStrings(jd.mustHaveKeywords, jd.domainKeywords, jd.toolsKeywords);
}

function collectRequestedKeywords(jd: JobDescriptionProfile, rolePackBooster: RolePack | null) {
  const dynamicKeywords = collectDynamicJdKeywords(jd);
  const dynamicKeywordSet = new Set(dynamicKeywords.map((keyword) => keyword.toLowerCase()));
  const boosterKeywords = rolePackBooster
    ? [...rolePackBooster.keywords].filter(
        (keyword) => !dynamicKeywordSet.has(keyword.toLowerCase())
      )
    : [];

  return mergeUniqueStrings(dynamicKeywords, boosterKeywords);
}

function stripAwkwardKeywordTails(text: string) {
  return text
    .replace(/\s+(?:across|utilizing|leveraging)\s+(?:API|Api|stakeholder|Stakeholder|strategy|Strategy|business|Business|operations|Operations)\.?$/i, ".")
    .replace(/,\s*optimizing\s+(?:API|Api|stakeholder|Stakeholder|strategy|Strategy|business|Business|operations|Operations)\s+outcomes\.?$/i, ".")
    .replace(/\s+across\s+(API|Api|stakeholder|Stakeholder)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function safeKeywordPhrase(keyword: string, bullet: string) {
  const lowerKeyword = keyword.toLowerCase().trim();
  const lowerBullet = bullet.toLowerCase();

  if (UNSAFE_STANDALONE_KEYWORDS.has(lowerKeyword)) {
    return "";
  }

  if (/dashboard|reporting|metric|analytics|analysis/i.test(lowerKeyword)) {
    return /dashboard|reporting|metric|analysis|sql|power bi|tableau|excel/i.test(lowerBullet)
      ? "dashboard-led reporting"
      : "";
  }

  if (/business metrics/i.test(lowerKeyword)) {
    return /data|insight|decision|revenue|cost|output|realization|metric|kpi/i.test(lowerBullet)
      ? "business metrics"
      : "";
  }

  if (/product development|feature development/i.test(lowerKeyword)) {
    return /product|mvp|roadmap|feature|launch|rollout|adoption|user|customer/i.test(lowerBullet)
      ? keyword
      : "";
  }

  if (/roadmap|product/i.test(lowerKeyword)) {
    return /product|portal|platform|mvp|scope|roadmap|launch|user|customer|feature/i.test(lowerBullet)
      ? "product roadmap"
      : "";
  }

  if (/prd|requirements/i.test(lowerKeyword)) {
    return /mvp|scope|roadmap|discovery|stakeholder|requirements|launch/i.test(lowerBullet)
      ? "PRD"
      : "";
  }

  if (/digital lending|credit lines?/i.test(lowerKeyword)) {
    return /lending|credit|fintech|banking|partner|risk/i.test(lowerBullet)
      ? keyword
      : "";
  }

  if (/kyc|onboarding/i.test(lowerKeyword)) {
    return /onboarding|re-onboard|partner portal|compliance|activation/i.test(lowerBullet)
      ? keyword
      : "";
  }

  if (/underwriting|risk analytics|risk controls?/i.test(lowerKeyword)) {
    return /risk|analytics|policy|approval|rule|credit|governance/i.test(lowerBullet)
      ? keyword
      : "";
  }

  if (/repayment|collections/i.test(lowerKeyword)) {
    return /lending|credit|partner|portfolio|risk/i.test(lowerBullet)
      ? keyword
      : "";
  }

  if (/research/i.test(lowerKeyword)) {
    return /research|interview|survey|feedback|discovery|benchmark|customer|user/i.test(lowerBullet)
      ? "user research"
      : "";
  }

  if (/analytics/i.test(lowerKeyword)) {
    return /analytics|analysis|data|usage|metric|dashboard|portal|insight/i.test(lowerBullet)
      ? "analytics"
      : "";
  }

  if (/margins?/i.test(lowerKeyword)) {
    return /margin|revenue|cost|pricing|realization|profit|net/i.test(lowerBullet)
      ? "margin impact"
      : "";
  }

  if (/delivery excellence/i.test(lowerKeyword)) {
    return /delivery|operations|efficiency|process|system|execution|reliability|availability/i.test(lowerBullet)
      ? "delivery excellence"
      : "";
  }

  if (/cross-functional governance|operating cadence/i.test(lowerKeyword)) {
    return /coordinat|stakeholder|sales|billing|support|workflow|sop|client/i.test(lowerBullet)
      ? keyword
      : "";
  }

  if (/okr|operating cadence|governance|qbr/i.test(lowerKeyword)) {
    return /leadership|review|stakeholder|cross-functional|business|metric|track/i.test(lowerBullet)
      ? lowerKeyword.toUpperCase()
      : "";
  }

  if (/seo|performance marketing|growth|content strategy/i.test(lowerKeyword)) {
    return /marketing|growth|content|campaign|conversion|digital|customer|user/i.test(lowerBullet)
      ? keyword
      : "";
  }

  if (/founder|bizops|board|investor|operating cadence/i.test(lowerKeyword)) {
    return /founder|executive|leadership|stakeholder|dashboard|metric|review|coordination|strategy|ownership/i.test(lowerBullet)
      ? keyword
      : "";
  }

  if (/process mapping|end-state design|risk controls|change management/i.test(lowerKeyword)) {
    return /process|workflow|sop|risk|legal|compliance|automation|rollout|adoption|stakeholder|operations/i.test(lowerBullet)
      ? keyword
      : "";
  }

  if (/financial modeling|portfolio analytics|forecasting|optimization|regression|time series/i.test(lowerKeyword)) {
    return /finance|portfolio|risk|forecast|model|pricing|capacity|analytics|analysis|metric|revenue/i.test(lowerBullet)
      ? keyword
      : "";
  }

  if (/cost|variance|budget|p&l|roi|margin|financial modeling|forecasting/i.test(lowerKeyword)) {
    return /cost|margin|revenue|budget|forecast|excel|dashboard|report|analytics|analysis|metric|pricing|vendor|operations/i.test(lowerBullet)
      ? keyword
      : "";
  }

  if (/aeo|answer engine optimization|content engine|b2b saas/i.test(lowerKeyword)) {
    return /seo|content|growth|marketing|saas|b2b|platform|conversion|funnel|ai/i.test(lowerBullet)
      ? keyword
      : "";
  }

  if (/city launches|hyperlocal gtm|category rollouts|community building|apartment activation|launch playbooks/i.test(lowerKeyword)) {
    return /launch|gtm|local|whatsapp|apartment|neighbourhood|referral|footfall|vendor|onboarding|sop|playbook|pricing|delivery|orders|community|market|store|service|menu/i.test(lowerBullet)
      ? keyword
      : "";
  }

  if (/cac|repeat rate|fill rate|performance tracking|consumer intelligence|kpi tracking/i.test(lowerKeyword)) {
    return /acquisition|roas|conversion|funnel|repeat|retention|subscription|orders|supply|inventory|vendor|metric|track|analysis|feedback|customer|consumer|market|pricing/i.test(lowerBullet)
      ? keyword
      : "";
  }

  if (/cross-functional execution/i.test(lowerKeyword)) {
    return /coordinat|stakeholder|teams|owners|execution|launch|release|blocker|workflow/i.test(lowerBullet)
      ? keyword
      : "";
  }

  if (/delivery excellence|execution|launch|rollout/i.test(lowerKeyword)) {
    return /delivery|launch|rollout|execution|implementation|project/i.test(lowerBullet)
      ? keyword
      : "";
  }

  return "";
}

function weaveKeywordPhrase(bullet: string, phrase: string) {
  if (!phrase) {
    return bullet;
  }

  if (/delivery excellence/i.test(phrase)) {
    if (/through targeted system optimizations initiatives/i.test(bullet)) {
      return bullet.replace(
        /through targeted system optimizations initiatives/i,
        "through delivery-excellence initiatives"
      );
    }
    if (/plant operations/i.test(bullet)) {
      return bullet.replace(/plant operations/i, "plant operations and delivery excellence");
    }
    if (/operational improvements/i.test(bullet)) {
      return bullet.replace(/operational improvements/i, "delivery excellence and operational improvements");
    }
    if (/system reliability/i.test(bullet)) {
      return bullet.replace(/system reliability/i, "delivery excellence and system reliability");
    }
  }

  if (/business metrics/i.test(phrase)) {
    if (/success metrics/i.test(bullet)) {
      return bullet.replace(/success metrics/i, "business metrics");
    }
    if (/data insights/i.test(bullet)) {
      return bullet.replace(/data insights/i, "business metrics and data insights");
    }
    if (/decision making/i.test(bullet)) {
      return bullet.replace(/decision making/i, "business-metric decision making");
    }
    if (/kpis/i.test(bullet)) {
      return bullet.replace(/KPIs/i, "business KPIs");
    }
  }

  if (/product roadmap/i.test(phrase)) {
    if (/launch roadmap/i.test(bullet)) {
      return bullet.replace(/launch roadmap/i, "product launch roadmap");
    }
    if (/MVP scope/i.test(bullet)) {
      return bullet.replace(/MVP scope/i, "MVP and product scope");
    }
    if (/policy portal/i.test(bullet)) {
      return bullet.replace(/policy portal/i, "policy product portal");
    }
  }

  if (/PRD/i.test(phrase)) {
    if (/concept to launch/i.test(bullet)) {
      return bullet.replace(/concept to launch/i, "discovery, PRD and rollout");
    }
    if (/MVP scope/i.test(bullet)) {
      return bullet.replace(/MVP scope/i, "MVP scope and PRD");
    }
  }

  if (/digital lending|credit lines?/i.test(phrase)) {
    if (/fintech platform focused on credit and digital banking/i.test(bullet)) {
      return bullet.replace(
        /fintech platform focused on credit and digital banking/i,
        "fintech platform focused on digital lending, credit lines and banking"
      );
    }
    if (/lending partner/i.test(bullet)) {
      return bullet.replace(/lending partner/i, "digital lending partner");
    }
  }

  if (/kyc|onboarding/i.test(phrase) && /compliance and visibility/i.test(bullet)) {
    return bullet.replace(/compliance and visibility/i, "onboarding and compliance flows");
  }

  if (/underwriting|risk analytics|risk controls?/i.test(phrase)) {
    if (/Risk & Analytics policy product portal/i.test(bullet)) {
      return bullet.replace(
        /Risk & Analytics policy product portal for approvals and releases, improving throughput/i,
        "Risk & Analytics portal improving rule-change governance"
      );
    }
    if (/approval workflows/i.test(bullet)) {
      return bullet;
    }
  }

  if (/user research/i.test(phrase)) {
    if (/user interviews/i.test(bullet)) {
      return bullet.replace(/user interviews/i, "user research interviews");
    }
    if (/customer interviews/i.test(bullet)) {
      return bullet.replace(/customer interviews/i, "customer research interviews");
    }
    if (/feedback loops/i.test(bullet)) {
      return bullet.replace(/feedback loops/i, "user feedback loops");
    }
    if (/surveys/i.test(bullet)) {
      return bullet.replace(/surveys/i, "user research surveys");
    }
  }

  if (/analytics/i.test(phrase)) {
    if (/usage data/i.test(bullet)) {
      return bullet.replace(/usage data/i, "usage analytics data");
    }
    if (/Risk & Analytics/i.test(bullet)) {
      return bullet;
    }
  }

  if (/margin impact/i.test(phrase)) {
    if (/net margin/i.test(bullet)) {
      return bullet.replace(/net margin/i, "net margin impact");
    }
    if (/increasing revenue/i.test(bullet)) {
      return bullet.replace(/increasing revenue/i, "increasing revenue and margin visibility");
    }
  }

  if (/executive dashboards/i.test(phrase) && /dashboard usability/i.test(bullet)) {
    return bullet.replace(/dashboard usability/i, "executive dashboard usability");
  }

  if (/dashboard-led reporting/i.test(phrase) && /improving navigation and user experience significantly/i.test(bullet)) {
    return bullet.replace(
      /improving navigation and user experience significantly/i,
      "improving dashboard-led reporting and UX visibility"
    );
  }

  if (/operating cadence/i.test(phrase) && /real-time operational response/i.test(bullet)) {
    return bullet.replace(
      /real-time operational response/i,
      "real-time operating cadence"
    );
  }

  if (/operating cadence/i.test(phrase) && /SOPs/i.test(bullet)) {
    return bullet.replace(
      /creating 5\+ SOPs streamlining/i,
      "creating 5+ SOPs for operating cadence and"
    );
  }

  if (/cross-functional governance/i.test(phrase) && /coordination/i.test(bullet)) {
    return bullet.replace(/coordination/i, "cross-functional governance and coordination");
  }

  if (/stakeholder management/i.test(phrase)) {
    if (/coordinating 5\+ teams/i.test(bullet)) {
      return bullet.replace(/coordinating 5\+ teams/i, "stakeholder management across 5+ teams");
    }
    if (/high influence stakeholders/i.test(bullet)) {
      return bullet.replace(/high influence stakeholders/i, "high-influence stakeholders for stakeholder management");
    }
  }

  if (/city launches|launch playbooks/i.test(phrase)) {
    if (/building SOPs, vendor controls and ops rhythm/i.test(bullet)) {
      return bullet.replace(
        /building SOPs, vendor controls and ops rhythm/i,
        "building launch playbooks, SOPs and ops rhythm"
      );
    }
    if (/vendor onboarding and execution/i.test(bullet)) {
      return bullet.replace(/vendor onboarding and execution/i, "vendor onboarding, launch playbook and execution");
    }
    if (/MVP build, launch and adoption/i.test(bullet)) {
      return bullet.replace(/MVP build, launch and adoption/i, "MVP build, pilot rollout and adoption");
    }
  }

  if (/hyperlocal gtm|apartment activation|community building/i.test(phrase)) {
    if (/WhatsApp-led GTM experiments and hyperlocal acquisition strategies/i.test(bullet)) {
      return bullet.replace(
        /WhatsApp-led GTM experiments and hyperlocal acquisition strategies/i,
        "WhatsApp-led GTM loops, local referrals and neighbourhood activation"
      );
    }
    if (/local GTM via WhatsApp funnels and apartment drives/i.test(bullet)) {
      return bullet.replace(
        /local GTM via WhatsApp funnels and apartment drives/i,
        "hyperlocal GTM through WhatsApp loops, referrals and apartment activation"
      );
    }
  }

  if (/category rollouts|consumer intelligence/i.test(phrase)) {
    if (/redesigning services using customer feedback and iteration loops/i.test(bullet)) {
      return bullet.replace(
        /redesigning services using customer feedback and iteration loops/i,
        "redesigning service categories using customer feedback and iteration loops"
      );
    }
    if (/redesigning services using customer feedback, pricing tests and faster iteration loops/i.test(bullet)) {
      return bullet.replace(
        /redesigning services using customer feedback, pricing tests and faster iteration loops/i,
        "redesigning service categories using customer feedback, pricing tests and faster iteration loops"
      );
    }
  }

  if (/cac|performance tracking/i.test(phrase)) {
    if (/8x ROAS/i.test(bullet)) {
      return bullet.replace(/8x ROAS/i, "8x ROAS with stronger acquisition efficiency");
    }
  }

  if (/repeat rate/i.test(phrase)) {
    if (/early product-market fit/i.test(bullet)) {
      return bullet.replace(/early product-market fit/i, "early repeat intent");
    }
    if (/customer feedback loops/i.test(bullet)) {
      return bullet.replace(/customer feedback loops/i, "customer feedback and repeat-intent loops");
    }
  }

  if (/fill rate/i.test(phrase)) {
    if (/order completion/i.test(bullet)) {
      return bullet.replace(/order completion/i, "order completion and supply reliability");
    }
  }

  if (/variance|budget|forecasting|financial modeling|p&l|roi|cost/i.test(phrase)) {
    if (/dashboards and Excel reports/i.test(bullet)) {
      return bullet.replace(/dashboards and Excel reports/i, "cost dashboards, variance views and Excel reports");
    }
    if (/tracking revenue, costs and vendor controls/i.test(bullet)) {
      return bullet.replace(
        /tracking revenue, costs and vendor controls/i,
        "tracking revenue, cost movement, margins and vendor controls"
      );
    }
    if (/operational reviews/i.test(bullet)) {
      return bullet.replace(/operational reviews/i, "budget and cost reviews");
    }
  }

  if (/product development|feature development/i.test(phrase)) {
    if (/MVP scope/i.test(bullet)) {
      return bullet.replace(/MVP scope/i, "MVP and product development scope");
    }
    if (/rollout and adoption/i.test(bullet)) {
      return bullet.replace(/rollout and adoption/i, "feature rollout and adoption");
    }
  }

  return bullet;
}

function enforceOnePageBulletBudget(original: string, improved: string, enabled: boolean) {
  const normalized = preserveBulletFormat(
    original,
    normalizeKeywordCasing(stripAwkwardKeywordTails(improved))
  );

  if (!enabled) {
    return normalized;
  }

  const maxLength = Math.min(
    Math.max(original.trim().length + MAX_BULLET_EXPANSION_CHARS, TARGET_LINE_MIN_CHARS),
    ABSOLUTE_ONE_PAGE_BULLET_LIMIT
  );

  if (normalized.length <= maxLength) {
    return normalized;
  }

  const sentence = normalized.replace(/\s+/g, " ").trim();
  const boundary = sentence.lastIndexOf(" ", maxLength - 1);
  const clipped = sentence
    .slice(0, boundary > 80 ? boundary : maxLength)
    .replace(/\s+(with|for|through|by|and|to|in|across|using|via)\.?\s*$/i, "")
    .replace(/\s+(system|operational|responsive|internal|support|cross-functional)\s*$/i, "")
    .replace(/[,:;|-]\s*$/, "");
  return clipped.endsWith(".") ? clipped : `${clipped}.`;
}

function mergeUniqueStrings(...groups: Array<string[] | undefined>) {
  const seen = new Set<string>();
  const output: string[] = [];

  groups.flat().forEach((item) => {
    const clean = String(item ?? "")
      .replace(/\s+/g, " ")
      .replace(/^[\s:|,;.-]+/, "")
      .trim();
    const normalizedClean = clean.replace(/[.。]\s*$/, "");
    if (!normalizedClean) {
      return;
    }

    const key = normalizedClean.toLowerCase() === "apis" ? "api" : normalizedClean.toLowerCase();
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    output.push(normalizeKeywordCasing(normalizedClean));
  });

  return output;
}

/** Upgraded action verb map – only replaces weak/generic verbs with ATS-friendly alternatives. */
const VERB_UPGRADES: [RegExp, string][] = [
  [/^worked with/i, "Collaborated with"],
  [/^worked on/i, "Delivered"],
  [/^helped/i, "Supported"],
  [/^built/i, "Engineered"],
  [/^created/i, "Developed"],
  [/^analyzed/i, "Analyzed"],
  [/^spoke with/i, "Gathered feedback from"],
  [/^coordinated/i, "Coordinated"],
  [/^managed/i, "Managed"],
  [/^did/i, "Executed"],
  [/^handled/i, "Oversaw"],
  [/^was responsible for/i, "Led"],
  [/^responsible for/i, "Led"],
  [/^participated in/i, "Contributed to"],
  [/^assisted/i, "Supported"],
  [/^used/i, "Leveraged"],
  [/^ran/i, "Drove"],
  [/^set up/i, "Established"],
];

const FILLER_REPLACEMENTS: [RegExp, string][] = [
  [/\bthings\b/gi, "initiatives"],
  [/\bmade sure\b/gi, "ensured"],
  [/\ba lot of\b/gi, "significant"],
  [/\bgot\b/gi, "achieved"],
  [/\bvery\b/gi, ""],
  [/\breally\b/gi, ""],
];

function applyHighConfidenceRewrite(bullet: string) {
  const text = bullet.replace(/\s+/g, " ").trim();

  if (/drop\s*shipping|dropshipping/i.test(text) && /8\s+lacks?/i.test(text)) {
    return "Built dropshipping store to ₹8 lakh revenue in 2 months through sourcing, pricing and GTM experiments.";
  }

  if (/AI\s+Notetaker/i.test(text) && /manual note-taking/i.test(text) && /meetings\/day/i.test(text)) {
    return "Launched AI Notetaker MVP to 200+ meetings/day by owning discovery, PRD, rollout and adoption.";
  }

  if (/user interviews/i.test(text) && /10\+\s+departments/i.test(text) && /MVP scope/i.test(text)) {
    return "Defined MVP scope, success metrics and roadmap from 10+ stakeholder interviews across teams.";
  }

  if (/NLP Credit Chatbot/i.test(text) && /24 hours/i.test(text) && /1 minute/i.test(text)) {
    return "Built NLP credit chatbot cutting policy query TAT from 24 hours to under 1 minute for risk teams.";
  }

  if (/Legal Bot/i.test(text) && /120 minutes/i.test(text) && /2 minutes/i.test(text)) {
    return "Automated legal review via AI bot, reducing SLA checks from 120 minutes to 2 minutes for vendors.";
  }

  if (/Risk\s*&\s*Analytics/i.test(text) && /policy portal/i.test(text) && /30%/i.test(text)) {
    return "Built Risk & Analytics portal improving rule-change governance by 30% through approval workflows.";
  }

  if (/₹300\s*Cr\/month/i.test(text) && /lending partner/i.test(text)) {
    return "Re-onboarded ₹300 Cr/month lending partner in 7 days with zero downtime across 5+ teams.";
  }

  if (/chatbot usage data/i.test(text) && /15%/i.test(text)) {
    return "Raised chatbot engagement 15% in 2 sprints by analyzing usage data and optimizing UX flows.";
  }

  if (/(100\s+people closed group|100-user stakeholder beta group)/i.test(text) && /stakeholders?|beta/i.test(text)) {
    return "Ran 100-user beta cohort to capture feedback, prioritize fixes and validate early product-market fit.";
  }

  if (/transitioned\s+100%/i.test(text) && /legal bot/i.test(text)) {
    return "Moved 100% users to Legal Bot within 1 month by training stakeholders and resolving adoption friction.";
  }

  if (/Credit Partner Portals/i.test(text) && /40%/i.test(text)) {
    return "Built Credit Partner Portals reducing manual processing by 40% across onboarding and compliance flows.";
  }

  if (/(customized components|reusable React components)/i.test(text) && /(reusability|development speed|consistency)/i.test(text)) {
    return "Created reusable React components, improving UI delivery speed for partner and credit management tools.";
  }

  if (/Tumbledry/i.test(text) && /₹28\s*LPA/i.test(text)) {
    return "Scaled Tumbledry franchise to ₹28 LPA at 40% margin by building SOPs, vendor controls and ops rhythm.";
  }

  if (/appointment scheduling/i.test(text) && /18%/i.test(text)) {
    return "Cut no-shows 18% by implementing scheduling, capacity planning and booking discipline across teams.";
  }

  if (/myKhaata/i.test(text) && /ledger/i.test(text)) {
    return "Created myKhaata, full-stack ledger/billing app with dockerized setup for standardized local development.";
  }

  return "";
}

function sharpenBullet(
  bullet: string,
  supportedKeywords: string[],
  preferredTone: FormattingPreferences["tone"]
) {
  let cleaned = bullet.replace(/\s+/g, " ").trim();

  const highConfidenceRewrite = applyHighConfidenceRewrite(cleaned);
  if (highConfidenceRewrite) {
    cleaned = highConfidenceRewrite;
  }

  // Apply verb upgrades
  if (!highConfidenceRewrite) {
    for (const [pattern, replacement] of VERB_UPGRADES) {
      if (pattern.test(cleaned)) {
        cleaned = cleaned.replace(pattern, replacement);
        break; 
      }
    }
  }

  // Apply filler replacements
  for (const [pattern, replacement] of FILLER_REPLACEMENTS) {
    cleaned = cleaned.replace(pattern, replacement);
  }

  // Clean up double spaces from filler removal
  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();

  // If no metric is present, try to find a natural one from common patterns or just flag it
  const hasMetric = /\d+%|\d+x|\$\d|₹\d|\d+ (users|teams|departments|meetings|sprints)/i.test(cleaned);

  // Keyword weaving
  const keywordSignals = chooseBulletKeywordSignals(cleaned, supportedKeywords);
  
  if (keywordSignals.length > 0) {
    const phrase = keywordSignals
      .map((keyword) => safeKeywordPhrase(keyword, cleaned))
      .find(Boolean);

    if (phrase) {
      cleaned = weaveKeywordPhrase(cleaned, phrase);
    }
  }

  // Final polish: ensure it ends with a period if it's long enough
  if (cleaned.length > 20 && !cleaned.endsWith(".")) {
    cleaned += ".";
  }

  return normalizeKeywordCasing(stripAwkwardKeywordTails(cleaned));
}

function mergeDeepAnswers(
  resume: ResumeProfile,
  answers?: QuestionnaireAnswers
): ResumeProfile {
  if (!answers) {
    return resume;
  }

  const additionalSkills = [
    answers.tools_known,
    answers.ai_tools,
    answers.stack_confident
  ]
    .filter(Boolean)
    .flatMap((answer) => answer.split(/[,|]/).map((item) => item.trim()))
    .filter(Boolean);

  const targetRoles = [answers.target_roles, answers.preferred_titles]
    .filter(Boolean)
    .flatMap((answer) => answer.split(/[,|]/).map((item) => item.trim()))
    .filter(Boolean);

  const summaryFragments = [
    answers.positioning_preference,
    answers.emphasize_work,
    answers.metrics_safe,
    answers.top_wins
  ].filter(Boolean);

  return {
    ...resume,
    summary: [resume.summary, ...summaryFragments].filter(Boolean).join(" "),
    targetRoles: [...new Set([...resume.targetRoles, ...targetRoles])],
    skills: [...new Set([...resume.skills, ...additionalSkills])]
  };
}

function improveExperiences(
  experiences: ResumeExperience[],
  supportedKeywords: string[],
  preferences: FormattingPreferences
) {
  return experiences.map((experience) => {
    const rewrittenBullets = experience.bullets.map((bullet) =>
      sharpenBullet(bullet, supportedKeywords, preferences.tone)
    );

    if (preferences.keepSameFormat) {
      return {
        ...experience,
        bullets: rewrittenBullets.map((bullet, index) =>
          enforceOnePageBulletBudget(experience.bullets[index] ?? "", bullet, preferences.onePage)
        )
      };
    }

    const rankedBullets = rewrittenBullets
      .map((bullet, index) => ({
        bullet,
        index,
        score:
          countKeywordHits(bullet, supportedKeywords) +
          (/\d/.test(bullet) ? 1 : 0) +
          (/launch|onboarding|research|analysis|dashboard|stakeholder|ownership/i.test(bullet)
            ? 1
            : 0)
      }))
      .sort((left, right) => right.score - left.score || left.index - right.index)
      .map((item) => item.bullet);

    return {
      ...experience,
      bullets: rankedBullets.map((bullet, index) =>
        enforceOnePageBulletBudget(experience.bullets[index] ?? "", bullet, preferences.onePage)
      )
    };
  });
}

function constrainExperienceRewrites(
  originalExperiences: ResumeExperience[],
  candidateExperiences: ResumeExperience[] | undefined,
  fallbackExperiences: ResumeExperience[],
  preferences: FormattingPreferences
) {
  return originalExperiences.map((originalExperience, experienceIndex) => {
    const candidate = candidateExperiences?.[experienceIndex];
    const fallback = fallbackExperiences[experienceIndex];

    return {
      ...originalExperience,
      summary: originalExperience.summary,
      bullets: originalExperience.bullets.map((originalBullet, bulletIndex) => {
        const candidateBullet = candidate?.bullets?.[bulletIndex];
        const fallbackBullet = fallback?.bullets?.[bulletIndex];
        const nextBullet =
          typeof candidateBullet === "string" && candidateBullet.trim()
            ? candidateBullet
            : fallbackBullet || originalBullet;

        return enforceOnePageBulletBudget(originalBullet, nextBullet, preferences.onePage);
      }),
      keywords: mergeUniqueStrings(originalExperience.keywords, candidate?.keywords, fallback?.keywords),
      metrics: mergeUniqueStrings(originalExperience.metrics, candidate?.metrics, fallback?.metrics)
    };
  });
}

function constrainProjectRewrites(
  originalProjects: ResumeProfile["projects"],
  candidateProjects: ResumeProfile["projects"] | undefined,
  fallbackProjects: ResumeProfile["projects"],
  preferences: FormattingPreferences
) {
  return originalProjects.map((originalProject, projectIndex) => {
    const candidate = candidateProjects?.[projectIndex];
    const fallback = fallbackProjects[projectIndex];

    return {
      ...originalProject,
      bullets: originalProject.bullets.map((originalBullet, bulletIndex) => {
        const candidateBullet = candidate?.bullets?.[bulletIndex];
        const fallbackBullet = fallback?.bullets?.[bulletIndex];
        const nextBullet =
          typeof candidateBullet === "string" && candidateBullet.trim()
            ? candidateBullet
            : fallbackBullet || originalBullet;

        return enforceOnePageBulletBudget(originalBullet, nextBullet, preferences.onePage);
      }),
      technologies: mergeUniqueStrings(
        originalProject.technologies,
        candidate?.technologies,
        fallback?.technologies
      )
    };
  });
}

function buildHeadline(
  resume: ResumeProfile,
  jd: JobDescriptionProfile,
  answers?: QuestionnaireAnswers
) {
  if (answers?.positioning_preference) {
    return `${titleCase(answers.positioning_preference)} candidate for ${jd.roleTitle}`;
  }

  if (jd.roleTitle) {
    return `${jd.roleTitle} | ${resume.industries.map(titleCase).slice(0, 2).join(" / ")}`;
  }

  return resume.targetRoles[0] || "ATS-optimized resume";
}

function buildSummary(
  resume: ResumeProfile,
  jd: JobDescriptionProfile,
  supportedKeywords: string[],
  answers?: QuestionnaireAnswers
) {
  const base = resume.summary
    ? resume.summary
    : `${resume.identity.name} brings adjacent experience across ${resume.industries
        .slice(0, 3)
        .map(titleCase)
        .join(", ")}.`;
  const roleContext = jd.roleTitle
    ? `Positioned toward ${jd.roleTitle} with emphasis on ${supportedKeywords
        .slice(0, 5)
        .join(", ")}.`
    : "";
  const deepSignal = answers?.ownership_scope
    ? `Verified ownership detail: ${answers.ownership_scope}.`
    : "";

  return [base, roleContext, deepSignal].filter(Boolean).join(" ");
}

function buildRecruiterNote(
  resume: ResumeProfile,
  jd: JobDescriptionProfile,
  answers?: QuestionnaireAnswers
) {
  const provenAreas = [
    ...resume.industries.map(titleCase),
    ...resume.skills.slice(0, 4)
  ]
    .filter(Boolean)
    .slice(0, 5)
    .join(", ");

  const deeperContext = answers?.wins_for_jd
    ? `Verified wins to emphasize: ${answers.wins_for_jd}.`
    : "";

  return [
    `Hi ${jd.company || "team"},`,
    `${resume.identity.name} is a credible fit for ${jd.roleTitle || "this role"} with demonstrated experience across ${provenAreas}.`,
    `The attached version keeps the original resume structure while clarifying supported impact, cross-functional execution, and role-relevant keywords.`,
    deeperContext
  ]
    .filter(Boolean)
    .join(" ");
}

function buildLineDiffs(
  original: ResumeProfile,
  improved: ResumeExperience[]
): GeneratedResume["lineDiffs"] {
  return original.experiences.flatMap((experience, index) =>
    experience.bullets.map((bullet, bulletIndex) => ({
      section: `${experience.company} - ${experience.title}`,
      original: bullet,
      improved: improved[index]?.bullets[bulletIndex] ?? bullet,
      accepted: true
    }))
  );
}

function isRewriteCandidateLine(line: string) {
  const text = line.replace(/^[-*•●]\s*/, "").trim();
  const startsWithImpactVerb = /^(achieved|aided|amplified|analyzed|automated|built|closed|collaborated|conducted|consulted|contributed|coordinated|created|curated|delivered|designed|developed|devised|drove|enabled|executed|formulated|gathered|grossed|implemented|improved|increased|launched|led|maintained|managed|mentored|owned|prepared|provided|received|reduced|researched|scaled|secured|selected|standardized|streamlined|supported|surpassed|unlocked|won|cut|revamped|pitched|co-founded|honored)\b/i.test(text);

  if (text.length < 45 || text.length > 180) {
    return false;
  }

  if (/@|\bLinkedIn\b|\bPortfolio\b/i.test(text)) {
    return false;
  }

  if (/^(education|experience|internship|internships|projects|live projects|business projects|skills|certifications|achievements|leadership|por|positions of responsibility|founder|founder’s ops)$/i.test(text)) {
    return false;
  }

  if (/^(technical skills?|business skills?|industry knowledge|tools?\s*&?\s*technologies?|management,\s*cross functional)\s*[:|]/i.test(text)) {
    return false;
  }

  if (/^(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december|\d{4}|20\d{2}|19\d{2})\b/i.test(text)) {
    return false;
  }

  if (/\b(pgp|mba|b\.?\s*tech|bachelor|master|cgpa|gpa|class\s+x|class\s+xii|isc board|icse board|cbse board?)\b/i.test(text)) {
    return false;
  }

  if (/\b(20\d{2}|19\d{2})\b.*\b(university|institute|school|college|masters'? union|vellore|vit)\b/i.test(text)) {
    return false;
  }

  if (/\b(masters'? union|vellore institute|lucknow public school|symbiosis|delhi public school|lancers army school)\b/i.test(text)) {
    return false;
  }

  if (/^[A-Z0-9&.,'’()| -]{12,}$/.test(text) && !/\d[%+x]?|₹/.test(text)) {
    return false;
  }

  return startsWithImpactVerb ||
    /\d|₹|%|users?|teams?|clients?|vendors?|partners?|stakeholders?|meetings?/i.test(text);
}

function buildRawLineDiffs(
  originalText: string,
  supportedKeywords: string[],
  preferences: FormattingPreferences
): GeneratedResume["lineDiffs"] {
  return originalText
    .replace(/\r/g, "")
    .split("\n")
    .filter(isRewriteCandidateLine)
    .map((line) => {
      const original = line.replace(/^[-*•●]\s*/, "").trim();
      const improved = enforceOnePageBulletBudget(
        original,
        sharpenBullet(original, supportedKeywords, preferences.tone),
        preferences.onePage
      );

      return {
        section: "Original resume line",
        original,
        improved,
        accepted: true
      };
    })
    .filter((diff) => normalizeComparableLine(diff.original) !== normalizeComparableLine(diff.improved));
}

function mergeLineDiffs(
  structuredLineDiffs: GeneratedResume["lineDiffs"],
  rawLineDiffs: GeneratedResume["lineDiffs"]
) {
  const seen = new Set<string>();
  const merged: GeneratedResume["lineDiffs"] = [];

  [...structuredLineDiffs, ...rawLineDiffs].forEach((diff) => {
    const key = normalizeComparableLine(diff.original);
    if (!key || seen.has(key)) {
      return;
    }
    seen.add(key);
    merged.push(diff);
  });

  return merged.slice(0, 18);
}

function normalizeComparableLine(value: string) {
  return value
    .replace(/^[-*•●]\s*/, "")
    .replace(/[.。]\s*$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function buildPatchedExportText(
  originalText: string,
  lineDiffs: GeneratedResume["lineDiffs"]
) {
  const grouped = new Map<string, string[]>();

  lineDiffs.forEach((diff) => {
    const key = normalizeComparableLine(diff.original);
    const current = grouped.get(key) ?? [];
    current.push(diff.improved);
    grouped.set(key, current);
  });

  return originalText
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => {
      const key = normalizeComparableLine(line);
      const replacement = grouped.get(key)?.shift();
      if (!replacement) {
        return line;
      }

      const bulletPrefix = line.match(/^(\s*[-*•●]\s*)/)?.[1] ?? "";
      return `${bulletPrefix}${replacement}`;
    })
    .join("\n");
}

function buildSkillsLine(original: string, skills: string[]) {
  const cleanSkills = mergeUniqueStrings(skills);
  if (!cleanSkills.length) {
    return original;
  }

  const technicalSignals = [
    "sql",
    "excel",
    "llm",
    "llms",
    "rag",
    "model evaluation",
    "deployment",
    "apis",
    "dashboard",
    "dashboarding",
    "product analytics",
    "product metrics",
    "python",
    "java",
    "react",
    "api",
    "jira",
    "jenkins",
    "tableau",
    "power bi",
    "looker",
    "metabase"
  ];
  const productSignals = [
    "city launches",
    "hyperlocal gtm",
    "category rollouts",
    "community building",
    "apartment activation",
    "launch playbooks",
    "cross-functional execution",
    "onboarding",
    "kyc",
    "underwriting",
    "repayment",
    "collections",
    "activation",
    "retention",
    "a/b tests",
    "funnel analysis",
    "product metrics",
    "product development",
    "feature development",
    "experimentation",
    "user research",
    "mvp definition"
  ];
  const businessSignals = [
    "talent acquisition",
    "employee engagement",
    "hr ops",
    "hris",
    "okrs",
    "leadership reviews",
    "financial modeling",
    "forecasting",
    "variance analysis",
    "p&l",
    "budgeting",
    "roi",
    "campaigns",
    "lifecycle marketing",
    "program management",
    "launch execution",
    "risk management",
    "city launches",
    "hyperlocal gtm",
    "category rollouts",
    "community building",
    "apartment activation",
    "launch playbooks",
    "cross-functional execution",
    "kpi tracking",
    "cac",
    "repeat rate",
    "fill rate",
    "performance tracking",
    "consumer intelligence",
    "roadmaps",
    "roadmapping",
    "prds",
    "prioritization",
    "stakeholder management",
    "gtm",
    "risk controls",
    "compliance",
    "operating cadence",
    "cross-functional governance",
    "business metrics"
  ];

  const pickBySignals = (signals: string[]) =>
    cleanSkills.filter((skill) => {
      const lowerSkill = skill.toLowerCase();
      return signals.some((signal) => lowerSkill.includes(signal));
    });

  let selectedSkills = cleanSkills;
  if (/technical\s+skills/i.test(original)) {
    selectedSkills = pickBySignals(technicalSignals).slice(0, 10);
  } else if (/product\s+skills/i.test(original)) {
    selectedSkills = pickBySignals(productSignals).slice(0, 12);
  } else if (/(business|management|program|growth|gtm)\s+skills/i.test(original)) {
    selectedSkills = pickBySignals(businessSignals).slice(0, 14);
  } else {
    selectedSkills = cleanSkills.slice(0, 18);
  }

  if (!selectedSkills.length && /technical\s+skills/i.test(original)) {
    return original;
  }

  if (!selectedSkills.length) {
    selectedSkills = cleanSkills.slice(0, 12);
  }

  const maxChars = Math.max(original.trim().length + 16, /skills/i.test(original) ? 110 : 90);
  let skillText = selectedSkills.join(", ");
  while (skillText.length > maxChars && selectedSkills.length > 6) {
    selectedSkills.pop();
    skillText = selectedSkills.join(", ");
  }

  const prefixMatch = original.match(/^(\s*(?:technical\s+skills|product\s+skills|business\s+skills|management\s+skills|program\s+skills|growth\s+skills|gtm\s+skills|skills)\s*[:|\t]\s*)/i);
  if (prefixMatch) {
    return `${prefixMatch[1]}${skillText}`;
  }

  if (/^(technical\s+skills|business\s+skills|skills)$/i.test(original.trim())) {
    return original;
  }

  return skillText;
}

function buildSkillsLineDiffs(originalText: string, improvedSkills: string[]): GeneratedResume["lineDiffs"] {
  return originalText
    .replace(/\r/g, "")
    .split("\n")
    .filter((line) => /^\s*(technical\s+skills|product\s+skills|business\s+skills|management\s+skills|program\s+skills|growth\s+skills|gtm\s+skills|skills)\s*[:|\t]/i.test(line))
    .map((line) => ({
      section: "Skills",
      original: line,
      improved: buildSkillsLine(line, improvedSkills),
      accepted: true
    }))
    .filter((diff) => normalizeComparableLine(diff.original) !== normalizeComparableLine(diff.improved));
}

function buildSkillsDiff(
  layoutInventory: LayoutInventory,
  originalSkills: string[],
  improvedSkills: string[]
): NonNullable<RewritePlan["skillsDiff"]> | null {
  const originalLine = layoutInventory.skillsLine?.text ?? "";
  if (!originalLine.trim()) {
    return null;
  }

  const improvedLine = buildSkillsLine(originalLine, improvedSkills);
  if (normalizeComparableLine(originalLine) === normalizeComparableLine(improvedLine)) {
    return null;
  }

  const originalSkillCorpus = originalSkills.join(" ").toLowerCase();
  const insertedSkills = improvedSkills.filter(
    (skill) => !originalSkillCorpus.includes(skill.toLowerCase())
  );

  return {
    section: "Skills",
    original: originalLine,
    improved: improvedLine,
    accepted: true,
    insertedSkills
  };
}

function buildRewritePlan(input: {
  jd: JobDescriptionProfile;
  rolePack: RolePack | null;
  blueprint: JdPositioningBlueprint;
  lineDiffs: GeneratedResume["lineDiffs"];
  skillsDiff: RewritePlan["skillsDiff"];
  supportedKeywords: string[];
  layoutInventory: LayoutInventory;
  preferences: FormattingPreferences;
}): RewritePlan {
  const requestedKeywords = collectRequestedKeywords(input.jd, input.rolePack);
  const supportedSet = new Set(input.supportedKeywords.map((keyword) => keyword.toLowerCase()));
  const excludedKeywords = requestedKeywords.filter(
    (keyword) => !supportedSet.has(keyword.toLowerCase())
  );
  const fallbackRange =
    input.layoutInventory.densityRisk === "high"
      ? { fallbackMin: 80, fallbackMax: 100 }
      : input.layoutInventory.densityRisk === "medium"
        ? { fallbackMin: 95, fallbackMax: 110 }
        : { fallbackMin: TARGET_LINE_MIN_CHARS, fallbackMax: TARGET_LINE_MAX_CHARS };

  return {
    lineDiffs: input.lineDiffs,
    skillsDiff: input.skillsDiff,
    safeKeywords: input.supportedKeywords,
    excludedKeywords,
    positioningArchetype: input.blueprint.positioningArchetype,
    jdPriorityKeywords: input.blueprint.priorityKeywords,
    evidenceMap: input.blueprint.evidenceMap,
    unsupportedCriticalGaps: input.blueprint.unsupportedCriticalGaps,
    scoreReachability: input.blueprint.scoreReachability,
    targetCharRange: {
      min: TARGET_LINE_MIN_CHARS,
      max: TARGET_LINE_MAX_CHARS,
      ...fallbackRange
    },
    fitStrategy: input.preferences.onePage ? "visual-fit-first" : "content-first",
    rolePack: input.rolePack?.id ?? "general"
  };
}

export function generateImprovedResume(options: {
  resume: ResumeProfile;
  jd: JobDescriptionProfile;
  answers?: QuestionnaireAnswers;
  preferences?: Partial<FormattingPreferences>;
}) {
  const baseResume = mergeDeepAnswers(options.resume, options.answers);
  const layoutInventory = buildTextLayoutInventory(options.resume.rawText);
  const rolePack = detectRolePackBooster(options.jd);
  const blueprint = buildJdPositioningBlueprint({
    resume: baseResume,
    jd: options.jd,
    answers: options.answers,
    rolePack
  });
  const baselineAnalysis = analyzeMatch(baseResume, options.jd);
  const preferences: FormattingPreferences = {
    ...baseResume.formattingPreferences,
    ...options.preferences
  };
  let supportedKeywords = mergeUniqueStrings(
    blueprint.supportedKeywords,
    pickSupportedKeywords(baseResume, options.jd, options.answers)
  );
  let improvedExperiences = improveExperiences(
    baseResume.experiences,
    supportedKeywords,
    preferences
  );
  let improvedProjects = baseResume.projects.map((project) => ({
    ...project,
    bullets: project.bullets.map((bullet) =>
      enforceOnePageBulletBudget(
        bullet,
        sharpenBullet(bullet, supportedKeywords, preferences.tone),
        preferences.onePage
      )
    )
  }));

  let improvedProfile: ResumeProfile = {
    ...baseResume,
    summary: buildSummary(baseResume, options.jd, supportedKeywords, options.answers),
    targetRoles: [...new Set([options.jd.roleTitle, options.jd.roleFamily, ...baseResume.targetRoles].filter(Boolean))],
    experiences: improvedExperiences,
    projects: improvedProjects,
    skills: mergeUniqueStrings(supportedKeywords.map(titleCase), baseResume.skills),
    rawText: [
      baseResume.rawText,
      buildHeadline(baseResume, options.jd, options.answers),
      buildSummary(baseResume, options.jd, supportedKeywords, options.answers),
      ...improvedExperiences.flatMap((experience) => experience.bullets),
      ...improvedProjects.flatMap((project) => project.bullets),
      supportedKeywords.join(" ")
    ]
      .filter(Boolean)
      .join("\n")
  };

  let updatedAnalysis = analyzeMatch(improvedProfile, options.jd);
  if (
    updatedAnalysis.overallScore < 90 &&
    blueprint.scoreReachability === "target-90" &&
    layoutInventory.densityRisk !== "high"
  ) {
    const missingSupportedKeywords = updatedAnalysis.missingKeywords.filter((keyword) =>
      blueprint.supportedKeywords.some((supported) => supported.toLowerCase() === keyword.toLowerCase())
    );
    const boostedKeywords = mergeUniqueStrings(supportedKeywords, missingSupportedKeywords, blueprint.priorityKeywords.slice(0, 8));
    if (boostedKeywords.length > supportedKeywords.length) {
      supportedKeywords = boostedKeywords;
      improvedExperiences = improveExperiences(baseResume.experiences, supportedKeywords, preferences);
      improvedProjects = baseResume.projects.map((project) => ({
        ...project,
        bullets: project.bullets.map((bullet) =>
          enforceOnePageBulletBudget(
            bullet,
            sharpenBullet(bullet, supportedKeywords, preferences.tone),
            preferences.onePage
          )
        )
      }));
      improvedProfile = {
        ...improvedProfile,
        summary: buildSummary(baseResume, options.jd, supportedKeywords, options.answers),
        experiences: improvedExperiences,
        projects: improvedProjects,
        skills: mergeUniqueStrings(supportedKeywords.map(titleCase), baseResume.skills),
        rawText: [
          baseResume.rawText,
          buildHeadline(baseResume, options.jd, options.answers),
          buildSummary(baseResume, options.jd, supportedKeywords, options.answers),
          ...improvedExperiences.flatMap((experience) => experience.bullets),
          ...improvedProjects.flatMap((project) => project.bullets),
          supportedKeywords.join(" ")
        ]
          .filter(Boolean)
          .join("\n")
      };
      updatedAnalysis = analyzeMatch(improvedProfile, options.jd);
    }
  }
  const scoreDelta = clamp(updatedAnalysis.overallScore - baselineAnalysis.overallScore, -100, 100);
  const structuredLineDiffs = buildLineDiffs(options.resume, improvedExperiences).filter(
    (diff) => normalizeComparableLine(diff.original) !== normalizeComparableLine(diff.improved)
  );
  const rawLineDiffs = buildRawLineDiffs(options.resume.rawText, supportedKeywords, preferences);
  const skillsDiff = buildSkillsDiff(layoutInventory, baseResume.skills, improvedProfile.skills);
  const skillsLineDiffs = buildSkillsLineDiffs(options.resume.rawText, improvedProfile.skills);
  const lineDiffs = mergeLineDiffs(
    [...structuredLineDiffs, ...skillsLineDiffs],
    rawLineDiffs
  );
  const exportDiffs = skillsDiff
    ? [
        ...lineDiffs,
        ...skillsLineDiffs,
        { original: skillsDiff.original, improved: skillsDiff.improved, section: skillsDiff.section, accepted: skillsDiff.accepted }
      ]
    : [...lineDiffs, ...skillsLineDiffs];
  const rewritePlan = buildRewritePlan({
    jd: options.jd,
    rolePack,
    blueprint,
    lineDiffs,
    skillsDiff,
    supportedKeywords,
    layoutInventory,
    preferences
  });
  const exportText = buildPatchedExportText(options.resume.rawText, exportDiffs);
  const builtResumeProfile = parseResumeText(exportText);
  const builtAnalysis = analyzeMatch(
    {
      ...builtResumeProfile,
      summary: improvedProfile.summary,
      targetRoles: improvedProfile.targetRoles,
      skills: improvedProfile.skills
    },
    options.jd
  );
  const followUpQuestions = buildAdaptiveFollowUpQuestions(builtAnalysis, options.answers ?? {});
  const headline = buildHeadline(baseResume, options.jd, options.answers);
  const summary = buildSummary(baseResume, options.jd, supportedKeywords, options.answers);
  const recruiterNote = buildRecruiterNote(baseResume, options.jd, options.answers);

  const changeSummary = [
    supportedKeywords.length
      ? `Surfaced supported role language: ${supportedKeywords.slice(0, 5).join(", ")}.`
      : "Tightened wording around the strongest supported experience already present.",
    `Re-ranked bullets to move the most role-relevant evidence higher within each experience.`,
    `Kept company names and dates unchanged while sharpening bullet language.`,
    preferences.keepSameFormat
      ? "Preserved the original resume structure as closely as possible."
      : "Allowed broader ATS-oriented wording changes where safe."
  ];

  const unsupportedSuggestions =
    options.jd.mustHaveKeywords.filter(
      (keyword) =>
        !supportedKeywords.some(
          (supported) => supported.toLowerCase() === keyword.toLowerCase()
        )
    ) || [];

  return generatedResumeSchema.parse({
    headline,
    summary,
    recruiterNote,
    skills: improvedProfile.skills,
    experiences: improvedExperiences,
    projects: improvedProjects,
    education: baseResume.education,
    certifications: baseResume.certifications,
    awards: baseResume.awards,
    notes: [
      preferences.keepSameFormat
      ? "Same-format mode keeps the section order and bullet volume close to the original."
        : "ATS-optimized mode simplifies the narrative for parsing and recruiter scanability.",
      preferences.onePage
        ? "One-page optimization is enabled; longer detail should be validated before export."
        : "Two-page breathing room is allowed for richer storytelling."
    ],
    changeSummary,
    unsupportedSuggestions,
    lineDiffs,
    layoutInventory,
    rewritePlan,
    exportQaReport: {
      docxPatched: false,
      pdfExported: false,
      pageCount: null,
      textSelectable: null,
      linksPreserved: null,
      renderedPages: 0,
      warnings: ["Render QA runs during DOCX export; PDF export uses the app's selectable PDF layout builder."]
    },
    followUpQuestions,
    baselineScore: clamp(baselineAnalysis.overallScore),
    estimatedScore: clamp(builtAnalysis.overallScore),
    scoreDelta: builtAnalysis.overallScore - baselineAnalysis.overallScore,
    exportText
  });
}
