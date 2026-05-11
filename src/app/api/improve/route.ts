import { NextResponse } from "next/server";

import { analyzeWithProvider } from "@/lib/llm/analyze";
import { parseJobDescriptionText } from "@/lib/parsing/jd-parser";
import { parseResumeText } from "@/lib/parsing/resume-parser";
import { generateImprovedResume } from "@/lib/rewrite/improve";
import { providerConfigSchema, type FormattingPreferences, type QuestionnaireAnswers } from "@/lib/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      resumeText: string;
      jobText: string;
      answers?: QuestionnaireAnswers;
      preferences?: Partial<FormattingPreferences>;
      providerConfig?: unknown;
    };

    const providerConfig = body.providerConfig
      ? providerConfigSchema.parse(body.providerConfig)
      : null;

    let activeProvider = providerConfig?.enabled && providerConfig?.apiKey 
      ? providerConfig 
      : null;

    const allowServerProviderFallback = process.env.ALLOW_SERVER_PROVIDER_FALLBACK === "true";

    if (!activeProvider && allowServerProviderFallback) {
      if (process.env.OPENAI_API_KEY) {
        activeProvider = { provider: "openai", apiKey: process.env.OPENAI_API_KEY, model: "gpt-4o-mini", enabled: true };
      } else if (process.env.GEMINI_API_KEY) {
        activeProvider = { provider: "gemini", apiKey: process.env.GEMINI_API_KEY, model: "gemini-2.5-flash", enabled: true };
      } else if (process.env.ANTHROPIC_API_KEY) {
        activeProvider = { provider: "anthropic", apiKey: process.env.ANTHROPIC_API_KEY, model: "claude-3-5-haiku-latest", enabled: true };
      }
    }

    if (activeProvider) {
      const analysis = await analyzeWithProvider({
        resumeText: body.resumeText,
        jobText: body.jobText,
        answers: body.answers,
        preferences: body.preferences,
        providerConfig: activeProvider
      });

      return NextResponse.json(analysis.improvedResume);
    }

    const resume = parseResumeText(body.resumeText);
    const jd = parseJobDescriptionText(body.jobText);
    const improved = generateImprovedResume({
      resume,
      jd,
      answers: body.answers,
      preferences: body.preferences
    });

    return NextResponse.json(improved);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to improve resume."
      },
      { status: 400 }
    );
  }
}
