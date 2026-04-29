import { parseJobDescriptionText } from "@/lib/parsing/jd-parser";
import { extractTextFromFile } from "@/lib/parsing/extract-text";
import { parseResumeText } from "@/lib/parsing/resume-parser";
import { buildJobDescriptionExtractionPrompt, buildResumeExtractionPrompt, buildRewritePrompt } from "@/lib/rewrite/prompts";
import { generateImprovedResume } from "@/lib/rewrite/improve";
import { analyzeMatch } from "@/lib/scoring";
import type { AnalysisResponse, FormattingPreferences, QuestionnaireAnswers } from "@/lib/schemas";
import { analysisResponseSchema } from "@/lib/schemas";

type AnalyzeInputs = {
  resumeFile?: File | null;
  resumeText?: string;
  jobFile?: File | null;
  jobText?: string;
  answers?: QuestionnaireAnswers;
  preferences?: Partial<FormattingPreferences>;
};

export async function analyzeInputs({
  resumeFile,
  resumeText,
  jobFile,
  jobText,
  answers,
  preferences
}: AnalyzeInputs): Promise<AnalysisResponse> {
  const resolvedResumeText = resumeText?.trim() || (await extractTextFromFile(resumeFile));
  const resolvedJobText = jobText?.trim() || (await extractTextFromFile(jobFile));

  if (!resolvedResumeText || !resolvedJobText) {
    throw new Error("Upload or paste both the resume and the job description.");
  }

  const resumeProfile = parseResumeText(resolvedResumeText);
  const jobDescriptionProfile = parseJobDescriptionText(resolvedJobText);
  const matchAnalysis = analyzeMatch(resumeProfile, jobDescriptionProfile);

  const improvedResume = generateImprovedResume({
    resume: resumeProfile,
    jd: jobDescriptionProfile,
    answers,
    preferences
  });

  return analysisResponseSchema.parse({
    resumeProfile,
    jobDescriptionProfile,
    matchAnalysis,
    improvedResume,
    debugPrompts: {
      extractResume: buildResumeExtractionPrompt(resolvedResumeText),
      extractJobDescription: buildJobDescriptionExtractionPrompt(resolvedJobText),
      rewrite: buildRewritePrompt(resumeProfile, jobDescriptionProfile, answers)
    },
    meta: {
      providerUsed: "heuristic",
      modelUsed: "heuristic",
      fallbackUsed: false,
      runMode: "heuristic",
      stages: {
        resumeExtraction: false,
        jdExtraction: false,
        rewrite: false
      }
    }
  });
}
