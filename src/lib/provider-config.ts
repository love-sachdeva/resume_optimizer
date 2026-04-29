import type { ProviderConfig } from "@/lib/schemas";

export const PROVIDER_DEFAULTS: Record<
  ProviderConfig["provider"],
  { model: string; label: string; help: string }
> = {
  openai: {
    model: "gpt-5.4-mini",
    label: "OpenAI",
    help: "Strong structured extraction and rewrite quality."
  },
  gemini: {
    model: "gemini-2.5-flash",
    label: "Gemini",
    help: "Fast and cost-efficient for JSON extraction and drafting."
  },
  anthropic: {
    model: "claude-sonnet-4-20250514",
    label: "Claude",
    help: "Strong writing quality and nuanced resume rewriting."
  }
};

export function resolveProviderModel(config?: Partial<ProviderConfig>) {
  if (!config?.provider) {
    return PROVIDER_DEFAULTS.openai.model;
  }

  return config.model?.trim() || PROVIDER_DEFAULTS[config.provider].model;
}

export function hasUsableProvider(config?: Partial<ProviderConfig> | null) {
  return Boolean(config?.enabled && config?.apiKey?.trim() && config?.provider);
}
