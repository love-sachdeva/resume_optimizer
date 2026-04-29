import { z } from "zod";

export const resumeIdentitySchema = z.object({
  name: z.string().catch("Candidate"),
  email: z.string().catch(""),
  phone: z.string().catch(""),
  linkedin: z.string().catch(""),
  github: z.string().catch(""),
  location: z.string().catch("")
});

export const resumeExperienceSchema = z.object({
  company: z.string().catch(""),
  title: z.string().catch(""),
  location: z.string().catch(""),
  startDate: z.string().catch(""),
  endDate: z.string().catch(""),
  summary: z.string().catch(""),
  bullets: z.array(z.string()).catch([]),
  keywords: z.array(z.string()).catch([]),
  metrics: z.array(z.string()).catch([])
});

export const projectSchema = z.object({
  name: z.string().catch(""),
  role: z.string().catch(""),
  description: z.string().catch(""),
  bullets: z.array(z.string()).catch([]),
  technologies: z.array(z.string()).catch([])
});

export const educationSchema = z.object({
  institution: z.string().catch(""),
  degree: z.string().catch(""),
  field: z.string().catch(""),
  startDate: z.string().catch(""),
  endDate: z.string().catch(""),
  details: z.array(z.string()).catch([])
});

export const formattingPreferencesSchema = z.object({
  onePage: z.boolean().catch(true),
  keepSameFormat: z.boolean().catch(false),
  tone: z.enum(["conservative", "balanced", "aggressive"]).catch("balanced"),
  formatMode: z
    .enum(["same-format", "ats-optimized", "recruiter-friendly"])
    .catch("ats-optimized")
});

export const defaultFormattingPreferences: FormattingPreferences = {
  onePage: true,
  keepSameFormat: false,
  tone: "balanced",
  formatMode: "ats-optimized"
};

export const resumeProfileSchema = z.object({
  identity: resumeIdentitySchema,
  summary: z.string().catch(""),
  targetRoles: z.array(z.string()).catch([]),
  industries: z.array(z.string()).catch([]),
  sectionOrder: z.array(z.string()).catch([]),
  experiences: z.array(resumeExperienceSchema).catch([]),
  projects: z.array(projectSchema).catch([]),
  education: z.array(educationSchema).catch([]),
  skills: z.array(z.string()).catch([]),
  certifications: z.array(z.string()).catch([]),
  awards: z.array(z.string()).catch([]),
  rawText: z.string(),
  totalYearsExperience: z.number().catch(0),
  formattingPreferences: formattingPreferencesSchema.catch(defaultFormattingPreferences)
});

export const hardFilterSchema = z.object({
  type: z.enum(["location", "experience", "education", "visa", "other"]),
  value: z.string(),
  required: z.boolean().catch(true)
});

export const jobDescriptionProfileSchema = z.object({
  company: z.string().catch(""),
  roleTitle: z.string().catch(""),
  seniority: z.string().catch(""),
  roleFamily: z.string().catch(""),
  mustHaveKeywords: z.array(z.string()).catch([]),
  domainKeywords: z.array(z.string()).catch([]),
  toolsKeywords: z.array(z.string()).catch([]),
  hardFilters: z.array(hardFilterSchema).catch([]),
  responsibilities: z.array(z.string()).catch([]),
  qualifications: z.array(z.string()).catch([]),
  locationRequirements: z.string().catch(""),
  applicationQuestions: z.array(z.string()).catch([]),
  rawText: z.string()
});

export const scoreBreakdownSchema = z.object({
  keyword: z.number(),
  semantic: z.number(),
  title: z.number(),
  domain: z.number(),
  quantifiedImpact: z.number(),
  hardFilters: z.number(),
  readability: z.number()
});

export const suggestedChangeSchema = z.object({
  text: z.string(),
  priority: z.enum(["high", "medium", "low"]).catch("medium"),
  estimatedImpactPoints: z.number().catch(0)
});

export const matchAnalysisSchema = z.object({
  overallScore: z.number(),
  breakdown: scoreBreakdownSchema,
  strengths: z.array(z.string()).catch([]),
  gaps: z.array(z.string()).catch([]),
  suggestedChanges: z.array(suggestedChangeSchema).catch([]),
  redFlags: z.array(z.string()).catch([]),
  keywordOverlap: z.array(z.string()).catch([]),
  missingKeywords: z.array(z.string()).catch([]),
  explanation: z.string(),
  confidenceLevel: z.enum(["high", "medium", "low"]).catch("medium")
});

export const lineDiffSchema = z.object({
  section: z.string().catch(""),
  original: z.string().catch(""),
  improved: z.string().catch(""),
  accepted: z.boolean().catch(true)
});

export const adaptiveFollowUpQuestionSchema = z.object({
  id: z.string().catch(""),
  label: z.string().catch(""),
  prompt: z.string().catch(""),
  type: z.enum(["text", "textarea", "select", "multiselect", "boolean"]).catch("text"),
  placeholder: z.string().catch(""),
  options: z.array(z.string()).catch([]),
  reason: z.string().catch("")
});

export const generatedResumeSchema = z.object({
  headline: z.string().catch(""),
  summary: z.string().catch(""),
  recruiterNote: z.string().catch(""),
  skills: z.array(z.string()).catch([]),
  experiences: z.array(resumeExperienceSchema).catch([]),
  projects: z.array(projectSchema).catch([]),
  education: z.array(educationSchema).catch([]),
  certifications: z.array(z.string()).catch([]),
  awards: z.array(z.string()).catch([]),
  notes: z.array(z.string()).catch([]),
  changeSummary: z.array(z.string()).catch([]),
  unsupportedSuggestions: z.array(z.string()).catch([]),
  lineDiffs: z.array(lineDiffSchema).catch([]),
  followUpQuestions: z.array(adaptiveFollowUpQuestionSchema).catch([]),
  baselineScore: z.number().catch(0),
  estimatedScore: z.number().catch(0),
  scoreDelta: z.number().catch(0),
  exportText: z.string().catch("")
});

export const debugPromptSchema = z.object({
  extractResume: z.string().catch(""),
  extractJobDescription: z.string().catch(""),
  rewrite: z.string().catch("")
});

export const analysisResponseSchema = z.object({
  resumeProfile: resumeProfileSchema,
  jobDescriptionProfile: jobDescriptionProfileSchema,
  matchAnalysis: matchAnalysisSchema,
  improvedResume: generatedResumeSchema,
  debugPrompts: debugPromptSchema,
  meta: z
    .object({
      providerUsed: z.string().catch("heuristic"),
      modelUsed: z.string().catch("heuristic"),
      fallbackUsed: z.boolean().catch(false),
      runMode: z.enum(["heuristic", "provider"]).catch("heuristic"),
      stages: z
        .object({
          resumeExtraction: z.boolean().catch(false),
          jdExtraction: z.boolean().catch(false),
          rewrite: z.boolean().catch(false)
        })
        .catch({
          resumeExtraction: false,
          jdExtraction: false,
          rewrite: false
        })
    })
    .catch({
      providerUsed: "heuristic",
      modelUsed: "heuristic",
      fallbackUsed: false,
      runMode: "heuristic",
      stages: {
        resumeExtraction: false,
        jdExtraction: false,
        rewrite: false
      }
    })
});

export const providerConfigSchema = z.object({
  provider: z.enum(["openai", "gemini", "anthropic"]).catch("openai"),
  apiKey: z.string().catch(""),
  model: z.string().catch(""),
  enabled: z.boolean().catch(false)
});

export const accountProfileSchema = z.object({
  name: z.string().catch(""),
  email: z.string().catch(""),
  organization: z.string().catch(""),
  roleTrack: z.string().catch(""),
  portfolio: z.string().catch(""),
  primaryDomain: z.string().catch(""),
  secondaryDomain: z.string().catch(""),
  tertiaryDomain: z.string().catch(""),
  googleToken: z.string().optional(),
  isLoggedIn: z.boolean().catch(false)
});

export const defaultAccountProfile: AccountProfile = {
  name: "",
  email: "",
  organization: "",
  roleTrack: "",
  portfolio: "",
  primaryDomain: "",
  secondaryDomain: "",
  tertiaryDomain: "",
  isLoggedIn: false
};

export const defaultProviderConfig: ProviderConfig = {
  provider: "openai",
  apiKey: "",
  model: "",
  enabled: false
};

export const appSettingsSchema = z.object({
  account: accountProfileSchema.catch(defaultAccountProfile),
  provider: providerConfigSchema.catch(defaultProviderConfig),
  storageMode: z.enum(["local", "private"]).catch("local")
});

export type ResumeProfile = z.infer<typeof resumeProfileSchema>;
export type ResumeExperience = z.infer<typeof resumeExperienceSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Education = z.infer<typeof educationSchema>;
export type FormattingPreferences = z.infer<typeof formattingPreferencesSchema>;
export type JobDescriptionProfile = z.infer<typeof jobDescriptionProfileSchema>;
export type MatchAnalysis = z.infer<typeof matchAnalysisSchema>;
export type SuggestedChange = z.infer<typeof suggestedChangeSchema>;
export type GeneratedResume = z.infer<typeof generatedResumeSchema>;
export type AnalysisResponse = z.infer<typeof analysisResponseSchema>;
export type ProviderConfig = z.infer<typeof providerConfigSchema>;
export type AccountProfile = z.infer<typeof accountProfileSchema>;
export type AppSettings = z.infer<typeof appSettingsSchema>;

export const questionnaireAnswerSchema = z.record(z.string(), z.string());

export const questionnaireQuestionSchema = z.object({
  id: z.string(),
  section: z.string(),
  label: z.string(),
  prompt: z.string(),
  type: z.enum(["text", "textarea", "select", "multiselect", "boolean"]),
  placeholder: z.string().catch(""),
  options: z.array(z.string()).catch([]),
  required: z.boolean().catch(false),
  layout: z.enum(["half", "full"]).catch("full"),
  dependsOn: z
    .object({
      id: z.string(),
      values: z.array(z.string())
    })
    .optional()
});

export const profileMemorySchema = z.object({
  answers: questionnaireAnswerSchema.catch({}),
  updatedAt: z.string().catch("")
});

export type QuestionnaireQuestion = z.input<typeof questionnaireQuestionSchema>;
export type QuestionnaireAnswers = z.infer<typeof questionnaireAnswerSchema>;
export type AdaptiveFollowUpQuestion = z.infer<typeof adaptiveFollowUpQuestionSchema>;
export type ProfileMemory = z.infer<typeof profileMemorySchema>;
