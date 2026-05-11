import { NextResponse } from "next/server";

import { analyzeInputs } from "@/lib/analysis";
import { analyzeWithProvider } from "@/lib/llm/analyze";
import {
  formattingPreferencesSchema,
  providerConfigSchema,
  questionnaireAnswerSchema
} from "@/lib/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const resumeFile = formData.get("resumeFile");
    const jobFile = formData.get("jobFile");
    const resumeText = formData.get("resumeText");
    const jobText = formData.get("jobText");
    const providerConfigRaw = formData.get("providerConfig");
    const answersRaw = formData.get("answers");
    const preferencesRaw = formData.get("preferences");

    const resumeFileValue = resumeFile instanceof File ? resumeFile : null;
    const jobFileValue = jobFile instanceof File ? jobFile : null;
    const resumeTextValue =
      typeof resumeText === "string" ? resumeText : resumeFileValue ? undefined : "";
    const jobTextValue =
      typeof jobText === "string" ? jobText : jobFileValue ? undefined : "";

    let providerConfig, answers, preferences;
    try {
      providerConfig = typeof providerConfigRaw === "string"
        ? providerConfigSchema.parse(JSON.parse(providerConfigRaw))
        : null;
      answers = typeof answersRaw === "string"
        ? questionnaireAnswerSchema.parse(JSON.parse(answersRaw))
        : undefined;
      preferences = typeof preferencesRaw === "string"
        ? formattingPreferencesSchema.partial().parse(JSON.parse(preferencesRaw))
        : undefined;
    } catch (parseError) {
      console.error("Input Parsing Error:", parseError);
      return NextResponse.json({ error: "Invalid input data format." }, { status: 400 });
    }

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
      const baseResult = await analyzeInputs({
        resumeFile: resumeFileValue,
        jobFile: jobFileValue,
        resumeText: resumeTextValue,
        jobText: jobTextValue,
        answers,
        preferences
      });
      const result = await analyzeWithProvider({
        resumeText: baseResult.resumeProfile.rawText,
        jobText: baseResult.jobDescriptionProfile.rawText,
        providerConfig: activeProvider,
        answers,
        preferences
      });

      return NextResponse.json(result);
    }

    const result = await analyzeInputs({
      resumeFile: resumeFileValue,
      jobFile: jobFileValue,
      resumeText: resumeTextValue,
      jobText: jobTextValue,
      answers,
      preferences
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Analysis API Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred during analysis."
      },
      { status: 400 }
    );
  }
}
