import { analyzeMatch } from "@/lib/scoring";
import { parseJobDescriptionText } from "@/lib/parsing/jd-parser";
import { parseResumeText } from "@/lib/parsing/resume-parser";
import { buildAdaptiveFollowUpQuestions } from "@/lib/questionnaire";
import { buildJobDescriptionExtractionPrompt, buildResumeExtractionPrompt, buildRewritePrompt } from "@/lib/rewrite/prompts";
import { buildPatchedExportText, generateImprovedResume } from "@/lib/rewrite/improve";
import { invokeProvider } from "@/lib/llm/providers";
import { hasUsableProvider } from "@/lib/provider-config";
import type {
  AnalysisResponse,
  FormattingPreferences,
  GeneratedResume,
  JobDescriptionProfile,
  ProviderConfig,
  QuestionnaireAnswers,
  ResumeProfile
} from "@/lib/schemas";
import { analysisResponseSchema, generatedResumeSchema, jobDescriptionProfileSchema, resumeProfileSchema } from "@/lib/schemas";

const RESUME_SCHEMA_HINT = `Return a JSON object that matches this shape:
{
  "identity": {"name":"","email":"","phone":"","linkedin":"","github":"","location":""},
  "summary": "",
  "targetRoles": [],
  "industries": [],
  "sectionOrder": [],
  "experiences": [{"company":"","title":"","location":"","startDate":"","endDate":"","summary":"","bullets":[],"keywords":[],"metrics":[]}],
  "projects": [{"name":"","role":"","description":"","bullets":[],"technologies":[]}],
  "education": [{"institution":"","degree":"","field":"","startDate":"","endDate":"","details":[]}],
  "skills": [],
  "certifications": [],
  "awards": [],
  "rawText": "",
  "totalYearsExperience": 0,
  "formattingPreferences": {"onePage": true, "keepSameFormat": false, "tone":"balanced", "formatMode":"ats-optimized"}
}`;

const JD_SCHEMA_HINT = `Return a JSON object that matches this shape:
{
  "company": "",
  "roleTitle": "",
  "seniority": "",
  "roleFamily": "",
  "mustHaveKeywords": [],
  "domainKeywords": [],
  "toolsKeywords": [],
  "hardFilters": [{"type":"location","value":"","required":true}],
  "responsibilities": [],
  "qualifications": [],
  "locationRequirements": "",
  "applicationQuestions": [],
  "rawText": ""
}`;

const REWRITE_SCHEMA_HINT = `Return a JSON object that matches this shape:
{
  "headline": "",
  "summary": "",
  "recruiterNote": "",
  "skills": [],
  "experiences": [{"company":"","title":"","location":"","startDate":"","endDate":"","summary":"","bullets":[],"keywords":[],"metrics":[]}],
  "projects": [{"name":"","role":"","description":"","bullets":[],"technologies":[]}],
  "education": [{"institution":"","degree":"","field":"","startDate":"","endDate":"","details":[]}],
  "certifications": [],
  "awards": [],
  "notes": [],
  "unsupportedSuggestions": []
}`;

const EXTRACTION_SYSTEM = [
  "You extract structured professional data from resumes and job descriptions.",
  "Preserve only supported facts.",
  "Do not invent employers, metrics, tools, dates, titles, or achievements.",
  "Return JSON only."
].join(" ");

const REWRITE_SYSTEM = [
  "You are a truthful resume optimizer.",
  "Improve wording and structure without inventing facts.",
  "Keep claims interview-safe and recruiter-readable.",
  "In same-format mode, preserve the original number of bullets, dates, titles, companies, and section structure.",
  "Preserve the original bullet reasoning format: RAC/result-first bullets stay result-first; STAR/action-context-result bullets stay action-context-result.",
  "Keep every rewritten bullet at 115-120 characters or shorter when the original is shorter.",
  "Do not append awkward keyword tails such as 'across API' or 'across stakeholder'.",
  "Return JSON only."
].join(" ");

const TARGET_LINE_MIN_CHARS = 115;
const TARGET_LINE_MAX_CHARS = 120;

function normalizeGeneratedLine(value: string) {
  return value
    .replace(/\bApi\b/g, "API")
    .replace(/\bAi\b/g, "AI")
    .replace(/\bSeo\b/g, "SEO")
    .replace(/\bGtm\b/g, "GTM")
    .replace(/\s+(?:across|utilizing|leveraging)\s+(?:API|Api|stakeholder|Stakeholder|strategy|Strategy|business|Business|operations|Operations)\.?$/i, ".")
    .replace(/,\s*optimizing\s+(?:API|Api|stakeholder|Stakeholder|strategy|Strategy|business|Business|operations|Operations)\s+outcomes\.?$/i, ".")
    .replace(/\s+across\s+(API|Api|stakeholder|Stakeholder)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function fitGeneratedBulletToOriginal(original: string, candidate: string, onePage: boolean) {
  const normalized = normalizeGeneratedLine(candidate);

  if (!onePage) {
    return normalized;
  }

  const maxLength = Math.min(Math.max(original.trim().length + 12, TARGET_LINE_MIN_CHARS), TARGET_LINE_MAX_CHARS);
  if (normalized.length <= maxLength) {
    return normalized;
  }

  const boundary = normalized.lastIndexOf(" ", maxLength - 1);
  const clipped = normalized
    .slice(0, boundary > 80 ? boundary : maxLength)
    .replace(/\s+(with|for|through|by|and|to|in|across|using|via)\.?\s*$/i, "")
    .replace(/\s+(system|operational|responsive|internal|support|cross-functional)\s*$/i, "")
    .replace(/[,:;|-]\s*$/, "");
  return clipped.endsWith(".") ? clipped : `${clipped}.`;
}

function mergeUnique(values: string[][]) {
  const seen = new Set<string>();
  const result: string[] = [];

  values.flat().forEach((value) => {
    const clean = normalizeGeneratedLine(value);
    if (!clean) {
      return;
    }
    const key = clean.toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    result.push(clean);
  });

  return result;
}

function finalizeGeneratedResume(
  rawImproved: Partial<GeneratedResume>,
  originalResume: ResumeProfile,
  jd: JobDescriptionProfile,
  answers?: QuestionnaireAnswers,
  preferences?: Partial<FormattingPreferences>
) {
  const heuristicBase = generateImprovedResume({
    resume: originalResume,
    jd,
    answers,
    preferences
  });

  const merged = generatedResumeSchema.parse({
    ...heuristicBase,
    ...rawImproved,
    skills: rawImproved.skills?.length ? rawImproved.skills : heuristicBase.skills,
    experiences: rawImproved.experiences?.length ? rawImproved.experiences : heuristicBase.experiences,
    projects: rawImproved.projects?.length ? rawImproved.projects : heuristicBase.projects,
    education: rawImproved.education?.length ? rawImproved.education : heuristicBase.education,
    certifications: rawImproved.certifications?.length
      ? rawImproved.certifications
      : heuristicBase.certifications,
    awards: rawImproved.awards?.length ? rawImproved.awards : heuristicBase.awards,
    notes: rawImproved.notes?.length ? rawImproved.notes : heuristicBase.notes,
    unsupportedSuggestions: rawImproved.unsupportedSuggestions?.length
      ? rawImproved.unsupportedSuggestions
      : heuristicBase.unsupportedSuggestions
  });

  const effectivePreferences: FormattingPreferences = {
    ...originalResume.formattingPreferences,
    ...preferences,
    onePage: preferences?.onePage ?? originalResume.formattingPreferences.onePage ?? true,
    keepSameFormat:
      preferences?.keepSameFormat ?? originalResume.formattingPreferences.keepSameFormat ?? true
  };

  const safeSkills = mergeUnique([
    heuristicBase.skills,
    originalResume.skills,
    merged.skills
  ]);

  const safeExperiences = originalResume.experiences.map((experience, index) => ({
    ...experience,
    bullets: experience.bullets.map((bullet, bulletIndex) => {
      const providerBullet = merged.experiences[index]?.bullets[bulletIndex];
      const fallbackBullet = heuristicBase.experiences[index]?.bullets[bulletIndex];
      const candidate =
        typeof providerBullet === "string" && providerBullet.trim()
          ? providerBullet
          : fallbackBullet || bullet;

      return fitGeneratedBulletToOriginal(bullet, candidate, effectivePreferences.onePage);
    }),
    keywords: mergeUnique([
      experience.keywords,
      merged.experiences[index]?.keywords ?? [],
      heuristicBase.experiences[index]?.keywords ?? []
    ]),
    metrics: mergeUnique([
      experience.metrics,
      merged.experiences[index]?.metrics ?? [],
      heuristicBase.experiences[index]?.metrics ?? []
    ])
  }));

  const safeProjects = originalResume.projects.map((project, index) => ({
    ...project,
    bullets: project.bullets.map((bullet, bulletIndex) => {
      const providerBullet = merged.projects[index]?.bullets[bulletIndex];
      const fallbackBullet = heuristicBase.projects[index]?.bullets[bulletIndex];
      const candidate =
        typeof providerBullet === "string" && providerBullet.trim()
          ? providerBullet
          : fallbackBullet || bullet;

      return fitGeneratedBulletToOriginal(bullet, candidate, effectivePreferences.onePage);
    }),
    technologies: mergeUnique([
      project.technologies,
      merged.projects[index]?.technologies ?? [],
      heuristicBase.projects[index]?.technologies ?? []
    ])
  }));

  const lineDiffs = originalResume.experiences.flatMap((experience, index) =>
    experience.bullets.map((bullet, bulletIndex) => ({
      section: `${experience.company} - ${experience.title}`,
      original: bullet,
      improved:
        safeExperiences[index]?.bullets[bulletIndex] ??
        heuristicBase.lineDiffs.find(
          (diff) =>
            diff.section === `${experience.company} - ${experience.title}` &&
            diff.original === bullet
        )?.improved ??
        bullet,
      accepted: true
    }))
  );

  const rebuiltExportText = [
    originalResume.identity.name,
    [
      originalResume.identity.location,
      originalResume.identity.email,
      originalResume.identity.phone
    ]
      .filter(Boolean)
      .join(" | "),
    merged.headline,
    "",
    "SUMMARY",
    merged.summary,
    "",
    "EXPERIENCE",
    ...safeExperiences.flatMap((experience) => [
      `${experience.title} | ${experience.company} | ${experience.startDate}${experience.endDate ? ` - ${experience.endDate}` : ""}${experience.location ? ` | ${experience.location}` : ""}`,
      ...experience.bullets.map((bullet) => `- ${bullet}`),
      ""
    ]),
    safeProjects.length ? "PROJECTS" : "",
    ...safeProjects.flatMap((project) => [
      project.name,
      ...project.bullets.map((bullet) => `- ${bullet}`),
      ""
    ]),
    "EDUCATION",
    ...originalResume.education.map(
      (education) => `${education.degree} | ${education.institution} ${education.endDate}`.trim()
    ),
    "",
    "SKILLS",
    safeSkills.join(", ")
  ]
    .filter(Boolean)
    .join("\n");

  const exportText = effectivePreferences.keepSameFormat
    ? buildPatchedExportText(originalResume.rawText, lineDiffs)
    : rebuiltExportText;

  const rescoredProfile: ResumeProfile = {
    ...originalResume,
    summary: merged.summary,
    skills: safeSkills,
    experiences: safeExperiences,
    projects: safeProjects,
    education: originalResume.education,
    certifications: originalResume.certifications,
    awards: originalResume.awards
  };
  const analysis = analyzeMatch(rescoredProfile, jd);

  return {
    ...merged,
    skills: safeSkills,
    experiences: safeExperiences,
    projects: safeProjects,
    education: originalResume.education,
    certifications: originalResume.certifications,
    awards: originalResume.awards,
    changeSummary: rawImproved.changeSummary?.length
      ? rawImproved.changeSummary
      : heuristicBase.changeSummary,
    lineDiffs,
    followUpQuestions:
      rawImproved.followUpQuestions?.length
        ? rawImproved.followUpQuestions
        : buildAdaptiveFollowUpQuestions(analysis, answers ?? {}),
    baselineScore: heuristicBase.baselineScore,
    exportText,
    estimatedScore: analysis.overallScore,
    scoreDelta: analysis.overallScore - heuristicBase.baselineScore
  };
}

function preferString(primary?: string, fallback?: string) {
  return primary && primary.trim() ? primary : fallback || "";
}

function preferArray<T>(primary?: T[], fallback?: T[]) {
  return primary && primary.length ? primary : fallback || [];
}

function mergeResumeProfiles(fallbackResume: ResumeProfile, providerResume: Partial<ResumeProfile>) {
  return resumeProfileSchema.parse({
    ...fallbackResume,
    ...providerResume,
    identity: {
      ...fallbackResume.identity,
      ...providerResume.identity,
      name: preferString(providerResume.identity?.name, fallbackResume.identity.name),
      email: preferString(providerResume.identity?.email, fallbackResume.identity.email),
      phone: preferString(providerResume.identity?.phone, fallbackResume.identity.phone),
      linkedin: preferString(providerResume.identity?.linkedin, fallbackResume.identity.linkedin),
      github: preferString(providerResume.identity?.github, fallbackResume.identity.github),
      location: preferString(providerResume.identity?.location, fallbackResume.identity.location)
    },
    summary: preferString(providerResume.summary, fallbackResume.summary),
    targetRoles: preferArray(providerResume.targetRoles, fallbackResume.targetRoles),
    industries: preferArray(providerResume.industries, fallbackResume.industries),
    sectionOrder: preferArray(providerResume.sectionOrder, fallbackResume.sectionOrder),
    experiences: preferArray(providerResume.experiences, fallbackResume.experiences),
    projects: preferArray(providerResume.projects, fallbackResume.projects),
    education: preferArray(providerResume.education, fallbackResume.education),
    skills: preferArray(providerResume.skills, fallbackResume.skills),
    certifications: preferArray(providerResume.certifications, fallbackResume.certifications),
    awards: preferArray(providerResume.awards, fallbackResume.awards),
    rawText: fallbackResume.rawText,
    totalYearsExperience:
      typeof providerResume.totalYearsExperience === "number" &&
      providerResume.totalYearsExperience > 0
        ? providerResume.totalYearsExperience
        : fallbackResume.totalYearsExperience
  });
}

function mergeJobProfiles(
  fallbackJd: JobDescriptionProfile,
  providerJd: Partial<JobDescriptionProfile>
) {
  return jobDescriptionProfileSchema.parse({
    ...fallbackJd,
    ...providerJd,
    company: preferString(providerJd.company, fallbackJd.company),
    roleTitle: preferString(providerJd.roleTitle, fallbackJd.roleTitle),
    seniority: preferString(providerJd.seniority, fallbackJd.seniority),
    roleFamily: preferString(providerJd.roleFamily, fallbackJd.roleFamily),
    mustHaveKeywords: preferArray(providerJd.mustHaveKeywords, fallbackJd.mustHaveKeywords),
    domainKeywords: preferArray(providerJd.domainKeywords, fallbackJd.domainKeywords),
    toolsKeywords: preferArray(providerJd.toolsKeywords, fallbackJd.toolsKeywords),
    hardFilters: preferArray(providerJd.hardFilters, fallbackJd.hardFilters),
    responsibilities: preferArray(providerJd.responsibilities, fallbackJd.responsibilities),
    qualifications: preferArray(providerJd.qualifications, fallbackJd.qualifications),
    locationRequirements: preferString(
      providerJd.locationRequirements,
      fallbackJd.locationRequirements
    ),
    applicationQuestions: preferArray(
      providerJd.applicationQuestions,
      fallbackJd.applicationQuestions
    ),
    rawText: fallbackJd.rawText
  });
}

export async function analyzeWithProvider(options: {
  resumeText: string;
  jobText: string;
  providerConfig: ProviderConfig;
  answers?: QuestionnaireAnswers;
  preferences?: Partial<FormattingPreferences>;
}) {
  const fallbackResume = parseResumeText(options.resumeText);
  const fallbackJd = parseJobDescriptionText(options.jobText);
  const fallbackAnalysis = analyzeMatch(fallbackResume, fallbackJd);
  const fallbackImproved = generateImprovedResume({
    resume: fallbackResume,
    jd: fallbackJd,
    answers: options.answers,
    preferences: options.preferences
  });

  const fallbackResponse = (fallbackReason?: string) =>
    analysisResponseSchema.parse({
      resumeProfile: fallbackResume,
      jobDescriptionProfile: fallbackJd,
      matchAnalysis: fallbackAnalysis,
      improvedResume: {
        ...fallbackImproved,
        notes: fallbackReason
          ? [...fallbackImproved.notes, `Provider fallback: ${fallbackReason}`]
          : fallbackImproved.notes
      },
      debugPrompts: {
        extractResume: buildResumeExtractionPrompt(options.resumeText),
        extractJobDescription: buildJobDescriptionExtractionPrompt(options.jobText),
        rewrite: buildRewritePrompt(fallbackResume, fallbackJd, options.answers)
      },
      meta: {
        providerUsed: options.providerConfig.provider || "heuristic",
        modelUsed: options.providerConfig.model || "heuristic",
        fallbackUsed: Boolean(fallbackReason),
        runMode: fallbackReason ? "provider" : "heuristic",
        stages: {
          resumeExtraction: false,
          jdExtraction: false,
          rewrite: false
        }
      }
    });

  if (!hasUsableProvider(options.providerConfig)) {
    return fallbackResponse();
  }

  try {
    const [resumeResult, jdResult] = await Promise.all([
      invokeProvider<ResumeProfile>({
        config: options.providerConfig,
        system: EXTRACTION_SYSTEM,
        prompt: buildResumeExtractionPrompt(options.resumeText),
        schemaHint: RESUME_SCHEMA_HINT,
        temperature: 0,
        timeoutMs: 30000
      }),
      invokeProvider<JobDescriptionProfile>({
        config: options.providerConfig,
        system: EXTRACTION_SYSTEM,
        prompt: buildJobDescriptionExtractionPrompt(options.jobText),
        schemaHint: JD_SCHEMA_HINT,
        temperature: 0,
        timeoutMs: 30000
      })
    ]);

    const resumeProfile = mergeResumeProfiles(
      fallbackResume,
      resumeProfileSchema.partial().parse(resumeResult.json)
    );
    const jobDescriptionProfile = mergeJobProfiles(
      fallbackJd,
      jobDescriptionProfileSchema.partial().parse(jdResult.json)
    );
    const matchAnalysis = analyzeMatch(resumeProfile, jobDescriptionProfile);

    const rewriteResult = await invokeProvider<GeneratedResume>({
      config: options.providerConfig,
      system: REWRITE_SYSTEM,
      prompt: buildRewritePrompt(resumeProfile, jobDescriptionProfile, options.answers),
      schemaHint: REWRITE_SCHEMA_HINT,
      temperature: 0.3,
      timeoutMs: 35000
    });

    const improvedResume = finalizeGeneratedResume(
      generatedResumeSchema.partial().parse(rewriteResult.json),
      resumeProfile,
      jobDescriptionProfile,
      options.answers,
      options.preferences
    );

    return analysisResponseSchema.parse({
      resumeProfile,
      jobDescriptionProfile,
      matchAnalysis,
      improvedResume,
      debugPrompts: {
        extractResume: buildResumeExtractionPrompt(options.resumeText),
        extractJobDescription: buildJobDescriptionExtractionPrompt(options.jobText),
        rewrite: buildRewritePrompt(resumeProfile, jobDescriptionProfile, options.answers)
      },
      meta: {
        providerUsed: resumeResult.provider,
        modelUsed: resumeResult.model,
        fallbackUsed: false,
        runMode: "provider",
        stages: {
          resumeExtraction: true,
          jdExtraction: true,
          rewrite: true
        }
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Provider call failed.";
    console.error("Provider analysis fallback:", message);
    return fallbackResponse(message);
  }
}
