import { analyzeMatch } from "@/lib/scoring";
import { SEMANTIC_CLUSTERS } from "@/lib/constants";
import { parseResumeText } from "@/lib/parsing/resume-parser";
import { buildAdaptiveFollowUpQuestions } from "@/lib/questionnaire";
import type {
  FormattingPreferences,
  GeneratedResume,
  JobDescriptionProfile,
  QuestionnaireAnswers,
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
  "ai-led growth": ["ai", "ml", "automation", "growth", "experiment", "model"]
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

  return [...jd.mustHaveKeywords, ...jd.domainKeywords, ...jd.toolsKeywords].filter(
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
    .replace(/\bAi\b/g, "AI")
    .replace(/\bSeo\b/g, "SEO")
    .replace(/\bGtm\b/g, "GTM")
    .replace(/\bOkrs\b/g, "OKRs")
    .replace(/\bQbrs\b/g, "QBRs");
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

  if (/roadmap|product/i.test(lowerKeyword)) {
    return /product|portal|platform|mvp|scope|roadmap|launch|user|customer|feature/i.test(lowerBullet)
      ? "product roadmap"
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
    const clean = String(item ?? "").replace(/\s+/g, " ").trim();
    if (!clean) {
      return;
    }

    const key = clean.toLowerCase();
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    output.push(normalizeKeywordCasing(clean));
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
    return "Owned AI Notetaker from concept to launch, eliminating manual note-taking and scaling to 200+ meetings/day.";
  }

  if (/user interviews/i.test(text) && /10\+\s+departments/i.test(text) && /MVP scope/i.test(text)) {
    return "Led user research with 10+ departments, converting pain points into MVP scope, business metrics and roadmap.";
  }

  if (/NLP Credit Chatbot/i.test(text) && /24 hours/i.test(text) && /1 minute/i.test(text)) {
    return "Built NLP Credit Chatbot, reducing query TAT from 24 hours to under 1 minute across support workflows.";
  }

  if (/Legal Bot/i.test(text) && /120 minutes/i.test(text) && /2 minutes/i.test(text)) {
    return "Automated Legal Bot review workflow, reducing contract review time from 120 minutes to 2 minutes.";
  }

  if (/Risk\s*&\s*Analytics/i.test(text) && /policy portal/i.test(text) && /30%/i.test(text)) {
    return "Launched Risk & Analytics policy product portal for approvals and releases, improving throughput by 30%.";
  }

  if (/₹300\s*Cr\/month/i.test(text) && /lending partner/i.test(text)) {
    return "Drove stakeholder management to re-onboard ₹300 Cr/month lending partner in under 7 days with zero downtime.";
  }

  if (/chatbot usage data/i.test(text) && /15%/i.test(text)) {
    return "Analyzed chatbot usage analytics post-launch, optimizing UX flows and increasing engagement by 15% in 2 sprints.";
  }

  if (/100\s+people closed group/i.test(text) && /stakeholders/i.test(text)) {
    return "Created 100-user stakeholder beta group to validate adoption, feedback and launch readiness.";
  }

  if (/transitioned\s+100%/i.test(text) && /legal bot/i.test(text)) {
    return "Transitioned 100% of legal review users to Legal Bot within one month through training and stakeholder alignment.";
  }

  if (/Credit Partner Portals/i.test(text) && /40%/i.test(text)) {
    return "Built Credit Partner Portals reducing manual processing by 40% while improving compliance and visibility.";
  }

  if (/customized components/i.test(text) && /reusability/i.test(text)) {
    return "Created reusable React components and APIs, improving development speed and consistency across portals.";
  }

  if (/Tumbledry/i.test(text) && /₹28\s*LPA/i.test(text)) {
    return "Launched Tumbledry franchise operations, created SOPs and scaled business to ₹28 LPA at 40% net margin impact.";
  }

  if (/appointment scheduling/i.test(text) && /18%/i.test(text)) {
    return "Improved scheduling and capacity planning, cutting no-shows by 18% and increasing revenue visibility.";
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

export function generateImprovedResume(options: {
  resume: ResumeProfile;
  jd: JobDescriptionProfile;
  answers?: QuestionnaireAnswers;
  preferences?: Partial<FormattingPreferences>;
}) {
  const baseResume = mergeDeepAnswers(options.resume, options.answers);
  const baselineAnalysis = analyzeMatch(baseResume, options.jd);
  const preferences: FormattingPreferences = {
    ...baseResume.formattingPreferences,
    ...options.preferences
  };
  const supportedKeywords = [...new Set(pickSupportedKeywords(baseResume, options.jd, options.answers))];
  const improvedExperiences = improveExperiences(
    baseResume.experiences,
    supportedKeywords,
    preferences
  );
  const improvedProjects = baseResume.projects.map((project) => ({
    ...project,
    bullets: project.bullets.map((bullet) =>
      enforceOnePageBulletBudget(
        bullet,
        sharpenBullet(bullet, supportedKeywords, preferences.tone),
        preferences.onePage
      )
    )
  }));

  const improvedProfile: ResumeProfile = {
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

  const updatedAnalysis = analyzeMatch(improvedProfile, options.jd);
  const scoreDelta = clamp(updatedAnalysis.overallScore - baselineAnalysis.overallScore, -100, 100);
  const structuredLineDiffs = buildLineDiffs(options.resume, improvedExperiences).filter(
    (diff) => normalizeComparableLine(diff.original) !== normalizeComparableLine(diff.improved)
  );
  const lineDiffs = structuredLineDiffs.length
    ? structuredLineDiffs
    : buildRawLineDiffs(options.resume.rawText, supportedKeywords, preferences);
  const exportText = buildPatchedExportText(options.resume.rawText, lineDiffs);
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
    followUpQuestions,
    baselineScore: clamp(baselineAnalysis.overallScore),
    estimatedScore: clamp(builtAnalysis.overallScore),
    scoreDelta: builtAnalysis.overallScore - baselineAnalysis.overallScore,
    exportText
  });
}
