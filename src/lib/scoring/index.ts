import { ROLE_ADJACENCY, SEMANTIC_CLUSTERS } from "@/lib/constants";
import type {
  JobDescriptionProfile,
  MatchAnalysis,
  ResumeProfile,
  SuggestedChange
} from "@/lib/schemas";
import { matchAnalysisSchema } from "@/lib/schemas";
import { clamp, titleCase } from "@/lib/utils";

/* ── helpers ──────────────────────────────────────────────────── */

function normalizedText(...parts: string[]) {
  return parts.join(" ").toLowerCase();
}

/** Cheap English stemmer – strips common suffixes so "payments" matches "payment", etc. */
function stem(word: string) {
  return word
    .replace(/ies$/i, "y")
    .replace(/(s|es|ed|ing|tion|ment|ness|ity|ous|ive|ful|less|able|ible)$/i, "")
    .toLowerCase();
}

/** Normalise a keyword for matching: lowercase, stem every token. */
function stemPhrase(phrase: string) {
  return phrase
    .toLowerCase()
    .split(/[\s/\-_]+/)
    .map(stem)
    .filter(Boolean)
    .join(" ");
}

/** True when the stemmed keyword appears in the stemmed corpus.
 *  Handles both single-word and multi-word (bi-gram/tri-gram) keywords. */
function phraseInCorpus(keyword: string, corpus: string, stemmedCorpus: string) {
  const lower = keyword.toLowerCase();
  // exact substring first (cheapest)
  if (corpus.includes(lower)) return true;
  // stemmed match
  const stemmed = stemPhrase(keyword);
  if (stemmedCorpus.includes(stemmed)) return true;
  // for multi-word, try each token individually – if ALL are present it's a match
  const tokens = stemmed.split(" ").filter((t) => t.length > 2);
  if (tokens.length > 1 && tokens.every((t) => stemmedCorpus.includes(t))) return true;
  return false;
}

/* ── corpus builders ────────────────────────────────────────── */

function buildResumeCorpus(resume: ResumeProfile) {
  return normalizedText(
    resume.identity.name,
    resume.identity.location,
    resume.summary,
    resume.targetRoles.join(" "),
    resume.industries.join(" "),
    resume.skills.join(" "),
    resume.certifications.join(" "),
    resume.awards.join(" "),
    ...resume.experiences.flatMap((experience) => [
      experience.company,
      experience.title,
      experience.location,
      experience.summary,
      ...experience.bullets,
      ...experience.keywords,
      ...experience.metrics
    ]),
    ...resume.projects.flatMap((project) => [
      project.name,
      project.role,
      project.description,
      ...project.bullets,
      ...project.technologies
    ]),
    ...resume.education.flatMap((education) => [
      education.institution,
      education.degree,
      education.field,
      ...education.details
    ]),
    resume.rawText
  );
}

function buildJobCorpus(jd: JobDescriptionProfile) {
  return normalizedText(
    jd.company,
    jd.roleTitle,
    jd.seniority,
    jd.roleFamily,
    jd.locationRequirements,
    ...jd.mustHaveKeywords,
    ...jd.domainKeywords,
    ...jd.toolsKeywords,
    ...jd.responsibilities,
    ...jd.qualifications,
    jd.rawText
  );
}

function includesAny(text: string, values: string[]) {
  return values.filter((value) => text.includes(value.toLowerCase()));
}

/* ── sub-scorers ────────────────────────────────────────────── */

function scoreKeywordMatch(resume: ResumeProfile, jd: JobDescriptionProfile) {
  const resumeCorpus = buildResumeCorpus(resume);
  const stemmedCorpus = stemPhrase(resumeCorpus);
  const keywords = [...jd.mustHaveKeywords, ...jd.toolsKeywords, ...jd.domainKeywords];
  const overlap = [...new Set(keywords.filter((kw) => phraseInCorpus(kw, resumeCorpus, stemmedCorpus)))];
  const missing = [...new Set(keywords.filter((kw) => !phraseInCorpus(kw, resumeCorpus, stemmedCorpus)))];

  const mustWeight = jd.mustHaveKeywords.length || 1;
  const mustMatched = jd.mustHaveKeywords.filter((kw) =>
    phraseInCorpus(kw, resumeCorpus, stemmedCorpus)
  ).length;
  const optionalKeywords = [...jd.toolsKeywords, ...jd.domainKeywords];
  const optionalMatched = optionalKeywords.filter((kw) =>
    phraseInCorpus(kw, resumeCorpus, stemmedCorpus)
  ).length;

  const score = clamp(
    (mustMatched / mustWeight) * 70 +
      (optionalMatched / Math.max(optionalKeywords.length, 1)) * 30
  );

  return { score, overlap, missing };
}

function scoreSemanticAlignment(resume: ResumeProfile, jd: JobDescriptionProfile) {
  const resumeCorpus = buildResumeCorpus(resume);
  const responsibilityCorpus = buildJobCorpus(jd);

  const coveredClusters = Object.entries(SEMANTIC_CLUSTERS)
    .filter(
      ([, words]) =>
        includesAny(responsibilityCorpus, words).length > 0 &&
        includesAny(resumeCorpus, words).length > 0
    )
    .map(([cluster]) => cluster);

  const demandedClusters = Object.entries(SEMANTIC_CLUSTERS)
    .filter(([, words]) => includesAny(responsibilityCorpus, words).length > 0)
    .map(([cluster]) => cluster);

  const score = clamp(
    (coveredClusters.length / Math.max(demandedClusters.length, 1)) * 100
  );

  return { score, coveredClusters, demandedClusters };
}

function scoreTitleAlignment(resume: ResumeProfile, jd: JobDescriptionProfile) {
  const titles = resume.experiences.map((experience) => experience.title.toLowerCase());
  const targetingText = normalizedText(resume.summary, resume.targetRoles.join(" "));
  const roleTitle = jd.roleTitle.toLowerCase();
  const roleFamily = jd.roleFamily.toLowerCase();
  const adjacency = Object.entries(ROLE_ADJACENCY).find(
    ([family]) => roleFamily.includes(family) || roleTitle.includes(family)
  )?.[1] ?? [];

  const exactMatch = titles.some((title) => title.includes(roleTitle));
  const familyMatch = titles.some((title) => title.includes(roleFamily));
  const adjacentMatch = titles.some((title) =>
    adjacency.some((adjacent) => title.includes(adjacent))
  );
  const targetedHeadline =
    targetingText.includes(roleTitle) ||
    (roleFamily && targetingText.includes(roleFamily)) ||
    adjacency.some((adjacent) => targetingText.includes(adjacent));
  const yearsTarget = jd.rawText.match(/(\d+)\s*[-–]?\s*(\d+)?\+?\s+years?/i);
  const minYears = Number(yearsTarget?.[1] ?? 0);
  const yearBoost =
    minYears === 0
      ? 20
      : resume.totalYearsExperience >= minYears
        ? 20
        : clamp((resume.totalYearsExperience / minYears) * 20);

  const score = clamp(
    (exactMatch ? 50 : 0) +
      (familyMatch ? 20 : 0) +
      (adjacentMatch ? 15 : 0) +
      (targetedHeadline ? 15 : 0) +
      yearBoost
  );

  return { score, exactMatch, familyMatch, adjacentMatch, targetedHeadline };
}

function scoreDomainAlignment(resume: ResumeProfile, jd: JobDescriptionProfile) {
  const resumeDomains = new Set(resume.industries.map((item) => item.toLowerCase()));
  const jdDomains = jd.domainKeywords.map((item) => item.toLowerCase());
  const resumeCorpus = buildResumeCorpus(resume);
  const overlap = jdDomains.filter(
    (domain) => resumeDomains.has(domain) || resumeCorpus.includes(domain)
  );

  return {
    score: clamp((overlap.length / Math.max(jdDomains.length, 1)) * 100),
    overlap
  };
}

function scoreQuantifiedImpact(resume: ResumeProfile, jd: JobDescriptionProfile) {
  const bullets = [
    ...resume.experiences.flatMap((experience) => experience.bullets),
    ...resume.projects.flatMap((project) => project.bullets)
  ];
  const quantifiedBullets = bullets.filter((bullet) => /\d/.test(bullet));
  const jdImpactSignals = includesAny(
    jd.rawText.toLowerCase(),
    ["metric", "metrics", "conversion", "revenue", "growth", "cost", "adoption", "activation"]
  );
  const coverage = quantifiedBullets.length / Math.max(bullets.length, 1);
  const score = clamp(coverage * 70 + jdImpactSignals.length * 6);

  return { score, quantifiedBullets };
}

function scoreHardFilters(resume: ResumeProfile, jd: JobDescriptionProfile) {
  const resumeText = buildResumeCorpus(resume);
  const jdText = buildJobCorpus(jd);
  let score = 100;
  const misses: string[] = [];
  let cap = 100;
  const capReasons: string[] = [];

  const mandatoryLanguage = /\b(mandatory|must[-\s]?have|required|only candidates|minimum|qualified|licensed|certified)\b/i.test(jd.rawText);
  const roleDefiningCredentials = [
    { label: "CA", pattern: /\bCA\b|chartered accountant/i },
    { label: "CFA", pattern: /\bCFA\b|chartered financial analyst/i },
    { label: "CPA", pattern: /\bCPA\b|certified public accountant/i },
    { label: "FRM", pattern: /\bFRM\b|financial risk manager/i },
    { label: "ACCA", pattern: /\bACCA\b/i }
  ];
  const demandedCredentials = roleDefiningCredentials.filter((credential) =>
    credential.pattern.test(jd.rawText)
  );
  const credentialMisses = demandedCredentials.filter((credential) =>
    !credential.pattern.test(resumeText)
  );

  if (demandedCredentials.length && credentialMisses.length) {
    const allCredentialPhrase = demandedCredentials.map((credential) => credential.label).join(" + ");
    const missingCredentialPhrase = credentialMisses.map((credential) => credential.label).join(" + ");
    score -= mandatoryLanguage ? 45 : 24;
    misses.push(`missing ${missingCredentialPhrase}${mandatoryLanguage ? ` from mandatory ${allCredentialPhrase} requirement` : ""}`);
    cap = Math.min(cap, credentialMisses.length === demandedCredentials.length ? 42 : 58);
    capReasons.push(`role-defining credential gap: ${missingCredentialPhrase}`);
  }

  jd.hardFilters.forEach((filter) => {
    const value = filter.value.toLowerCase();
    const requiredFilter = filter.required || mandatoryLanguage;
    if (filter.type === "location" && !resumeText.includes(value.replace("based in ", ""))) {
      score -= requiredFilter ? 18 : 8;
      misses.push(filter.value);
    }
    if (filter.type === "education" && !resumeText.includes("b.tech") && !resumeText.includes("bachelor")) {
      score -= requiredFilter ? 18 : 8;
      misses.push(filter.value);
    }
    if (filter.type === "experience") {
      const minYears = Number(filter.value.match(/(\d+)/)?.[1] ?? 0);
      if (minYears && resume.totalYearsExperience < minYears) {
        const yearGap = minYears - resume.totalYearsExperience;
        score -= yearGap <= 1 ? 10 : 22;
        misses.push(filter.value);
        if (requiredFilter && yearGap > 1) {
          cap = Math.min(cap, 65);
          capReasons.push(`mandatory experience gap: needs ${minYears}+ years`);
        }
      }
    }
  });

  const roleTitle = jd.roleTitle.toLowerCase();
  const roleFamily = jd.roleFamily.toLowerCase();
  const titleRequired =
    mandatoryLanguage &&
    /\b(as|experience as|worked as|role as|in a)\s+(product manager|software developer|software engineer|data analyst|business analyst|finance|marketing|sales|consultant|founder'?s office|chief of staff)\b/i.test(jdText);
  const resumeTitles = resume.experiences.map((experience) => experience.title.toLowerCase()).join(" ");
  const titleAligned =
    (roleTitle && resumeTitles.includes(roleTitle)) ||
    (roleFamily && resumeTitles.includes(roleFamily)) ||
    ROLE_ADJACENCY[roleFamily]?.some((adjacent) => resumeTitles.includes(adjacent));

  if (titleRequired && !titleAligned) {
    score -= 24;
    misses.push(`mandatory role-title/seniority signal for ${jd.roleTitle || jd.roleFamily}`);
    cap = Math.min(cap, 55);
    capReasons.push(`mandatory title mismatch for ${jd.roleTitle || jd.roleFamily}`);
  }

  if (mandatoryLanguage && misses.length >= 2) {
    cap = Math.min(cap, 45);
    capReasons.push("multiple mandatory hard-filter gaps");
  }

  return { score: clamp(score), misses, cap, capReasons };
}

function scoreReadability(resume: ResumeProfile) {
  const hasSections = resume.sectionOrder.length >= 3;
  const hasContact = Boolean(resume.identity.email || resume.identity.phone);
  const bulletConsistency = resume.experiences.every(
    (experience) => experience.bullets.length === 0 || experience.bullets.every(Boolean)
  );
  const lengthPenalty = resume.rawText.length > 7000 ? 20 : 0;
  const score = clamp(
    (hasSections ? 35 : 18) + (hasContact ? 25 : 10) + (bulletConsistency ? 30 : 15) + 20 - lengthPenalty
  );

  return { score };
}

/* ── explanation builder ────────────────────────────────────── */

function buildExplanation(
  overallScore: number,
  strengths: string[],
  gaps: string[],
  redFlags: string[],
  capReasons: string[] = []
) {
  const scoreLabel =
    overallScore >= 80 ? "strong" : overallScore >= 65 ? "credible" : "developing";
  const strengthText =
    strengths.slice(0, 3).join(", ") ||
    "the resume has limited directly supported evidence for this JD";

  return `Your score is ${Math.round(overallScore)}/100. This is a ${scoreLabel} match because ${strengthText}. The score is held back by ${gaps.slice(0, 3).join(", ") || "limited explicit alignment"}. ${
    redFlags.length ? `Hard-filter risks: ${redFlags.slice(0, 2).join(", ")}.` : ""
  } ${capReasons.length ? `Practical score cap applied: ${capReasons.slice(0, 2).join(", ")}.` : ""}`.trim();
}

/* ── confidence level ───────────────────────────────────────── */

function assessConfidence(resume: ResumeProfile, jd: JobDescriptionProfile): "high" | "medium" | "low" {
  const hasExperiences = resume.experiences.length > 0;
  const hasBullets = resume.experiences.some((e) => e.bullets.length > 0);
  const hasEducation = resume.education.length > 0;
  const hasSkills = resume.skills.length > 0;
  const hasJdKeywords = jd.mustHaveKeywords.length > 0;
  const hasJdTitle = jd.roleTitle.length > 0;

  const signals = [hasExperiences, hasBullets, hasEducation, hasSkills, hasJdKeywords, hasJdTitle];
  const count = signals.filter(Boolean).length;

  if (count >= 5) return "high";
  if (count >= 3) return "medium";
  return "low";
}

/* ── suggested changes builder ──────────────────────────────── */

function buildSuggestedChanges(
  keyword: { missing: string[]; overlap: string[] },
  title: { exactMatch: boolean; familyMatch: boolean; adjacentMatch: boolean; targetedHeadline: boolean },
  quantifiedImpact: { quantifiedBullets: string[] },
  hardFilters: { misses: string[]; cap?: number; capReasons?: string[] },
  semantic: { coveredClusters: string[]; demandedClusters: string[] },
  jd: JobDescriptionProfile
): SuggestedChange[] {
  const changes: SuggestedChange[] = [];

  // Missing keywords — high priority
  if (keyword.missing.length) {
    const mustMissing = keyword.missing.filter((kw) =>
      jd.mustHaveKeywords.some((mk) => mk.toLowerCase() === kw.toLowerCase())
    );
    const optionalMissing = keyword.missing.filter(
      (kw) => !jd.mustHaveKeywords.some((mk) => mk.toLowerCase() === kw.toLowerCase())
    );

    if (mustMissing.length) {
      changes.push({
        text: `Add these must-have keywords where evidence exists: ${mustMissing.slice(0, 5).join(", ")}`,
        priority: "high",
        estimatedImpactPoints: Math.min(mustMissing.length * 3, 12)
      });
    }
    if (optionalMissing.length) {
      changes.push({
        text: `Surface optional JD keywords: ${optionalMissing.slice(0, 5).join(", ")}`,
        priority: "medium",
        estimatedImpactPoints: Math.min(optionalMissing.length * 1.5, 6)
      });
    }
  }

  // Title alignment
  if (!title.exactMatch && !title.targetedHeadline) {
    changes.push({
      text: `Add a headline or summary that frames experience toward ${jd.roleTitle || jd.roleFamily}`,
      priority: "high",
      estimatedImpactPoints: 8
    });
  }

  // Quantified impact
  if (quantifiedImpact.quantifiedBullets.length < 3) {
    changes.push({
      text: "Add metrics to bullets — conversion rates, time saved, scale numbers, cost reductions",
      priority: "medium",
      estimatedImpactPoints: 5
    });
  }

  // Hard filter fixes
  if (hardFilters.misses.length) {
    changes.push({
      text: `Clarify or avoid unsupported hard-filter requirements: ${hardFilters.misses.join(", ")}`,
      priority: "high",
      estimatedImpactPoints: Math.min(hardFilters.misses.length * 4, 10)
    });
  }

  // Semantic gaps
  const missingClusters = semantic.demandedClusters
    .filter((cluster) => !semantic.coveredClusters.includes(cluster))
    .slice(0, 3);
  if (missingClusters.length) {
    changes.push({
      text: `Strengthen evidence in these areas: ${missingClusters.map(titleCase).join(", ")}`,
      priority: "medium",
      estimatedImpactPoints: Math.min(missingClusters.length * 3, 8)
    });
  }

  // Sort by estimated impact (highest first)
  return changes.sort((a, b) => b.estimatedImpactPoints - a.estimatedImpactPoints);
}

/* ── main scorer ────────────────────────────────────────────── */

export function analyzeMatch(
  resume: ResumeProfile,
  jd: JobDescriptionProfile
): MatchAnalysis {
  const keyword = scoreKeywordMatch(resume, jd);
  const semantic = scoreSemanticAlignment(resume, jd);
  const title = scoreTitleAlignment(resume, jd);
  const domain = scoreDomainAlignment(resume, jd);
  const quantifiedImpact = scoreQuantifiedImpact(resume, jd);
  const hardFilters = scoreHardFilters(resume, jd);
  const readability = scoreReadability(resume);

  const weightedScore = clamp(
    keyword.score * 0.3 +
      semantic.score * 0.2 +
      title.score * 0.15 +
      domain.score * 0.1 +
      quantifiedImpact.score * 0.1 +
      hardFilters.score * 0.1 +
      readability.score * 0.05
  );
  const overallScore = clamp(Math.min(weightedScore, hardFilters.cap));

  const strengths = [
    keyword.overlap.length
      ? `keyword overlap on ${keyword.overlap.slice(0, 4).join(", ")}`
      : "",
    semantic.coveredClusters.length
      ? `semantic coverage across ${semantic.coveredClusters.map(titleCase).join(", ")}`
      : "",
    domain.overlap.length
      ? `domain alignment in ${domain.overlap.map(titleCase).join(", ")}`
      : "",
    quantifiedImpact.quantifiedBullets.length
      ? `${quantifiedImpact.quantifiedBullets.length} quantified bullets already present`
      : ""
  ].filter(Boolean);

  const gaps = [
    keyword.missing.length
      ? `missing keywords like ${keyword.missing.slice(0, 4).join(", ")}`
      : "",
    title.exactMatch || title.familyMatch || title.adjacentMatch || title.targetedHeadline
      ? ""
      : `no explicit ${jd.roleTitle || jd.roleFamily} title signal`,
    semantic.demandedClusters
      .filter((cluster) => !semantic.coveredClusters.includes(cluster))
      .slice(0, 3)
      .map((cluster) => `limited ${cluster} evidence`)
      .join(", "),
    quantifiedImpact.quantifiedBullets.length < 2
      ? "few verified metrics called out explicitly"
      : ""
  ].filter(Boolean);

  const redFlags = [
    ...hardFilters.misses,
    ...hardFilters.capReasons,
    ...keyword.missing.filter((keywordItem) =>
      jd.mustHaveKeywords.includes(keywordItem) &&
      /[a-z]/i.test(keywordItem) &&
      !/^\d/.test(keywordItem)
    ).slice(0, 2)
  ];

  const suggestedChanges = buildSuggestedChanges(
    keyword,
    title,
    quantifiedImpact,
    hardFilters,
    semantic,
    jd
  );

  const confidenceLevel = assessConfidence(resume, jd);

  return matchAnalysisSchema.parse({
    overallScore,
    breakdown: {
      keyword: keyword.score,
      semantic: semantic.score,
      title: title.score,
      domain: domain.score,
      quantifiedImpact: quantifiedImpact.score,
      hardFilters: hardFilters.score,
      readability: readability.score
    },
    strengths,
    gaps,
    suggestedChanges,
    redFlags,
    keywordOverlap: keyword.overlap,
    missingKeywords: keyword.missing,
    explanation: buildExplanation(overallScore, strengths, gaps, redFlags, hardFilters.capReasons),
    confidenceLevel
  });
}
