import { PROVIDER_DEFAULTS, resolveProviderModel } from "@/lib/provider-config";
import type { ProviderConfig } from "@/lib/schemas";
import { parseJsonObject } from "@/lib/llm/json";

type ProviderInvocation = {
  config: ProviderConfig;
  system: string;
  prompt: string;
  schemaHint?: string;
  temperature?: number;
  timeoutMs?: number;
};

async function assertResponse(response: Response) {
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Provider call failed with ${response.status}.`);
  }
  return response;
}

function providerSignal(timeoutMs = 30000) {
  return AbortSignal.timeout(timeoutMs);
}

function normalizeProviderError(error: unknown, provider: ProviderConfig["provider"]) {
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return new Error(`${provider} timed out while generating structured resume analysis.`);
  }

  if (error instanceof Error && error.name === "AbortError") {
    return new Error(`${provider} request was aborted while generating structured resume analysis.`);
  }

  return error;
}

async function callOpenAI({ config, system, prompt, temperature = 0.2, timeoutMs }: ProviderInvocation) {
  const response = await assertResponse(
    await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: providerSignal(timeoutMs),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: resolveProviderModel(config),
        temperature,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "developer",
            content: system
          },
          {
            role: "user",
            content: prompt
          }
        ]
      })
    })
  );

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  return json.choices?.[0]?.message?.content?.trim() || "{}";
}

async function callGemini({ config, system, prompt, schemaHint, temperature = 0.2, timeoutMs }: ProviderInvocation) {
  const model = resolveProviderModel(config);
  const response = await assertResponse(
    await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        signal: providerSignal(timeoutMs),
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": config.apiKey
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: system }]
          },
          contents: [
            {
              role: "user",
              parts: [{ text: `${prompt}\n\n${schemaHint ?? ""}`.trim() }]
            }
          ],
          generationConfig: {
            temperature,
            maxOutputTokens: 4096,
            responseMimeType: "application/json"
          }
        })
      }
    )
  );

  const json = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
    promptFeedback?: { blockReason?: string };
  };

  if (json.promptFeedback?.blockReason) {
    throw new Error(`Gemini blocked the request: ${json.promptFeedback.blockReason}.`);
  }

  return json.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") || "{}";
}

async function callAnthropic({ config, system, prompt, schemaHint, temperature = 0.2, timeoutMs }: ProviderInvocation) {
  const response = await assertResponse(
    await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: providerSignal(timeoutMs),
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: resolveProviderModel(config),
        max_tokens: 4096,
        temperature,
        system,
        messages: [
          {
            role: "user",
            content: `${prompt}\n\n${schemaHint ?? ""}`.trim()
          }
        ]
      })
    })
  );

  const json = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };

  return json.content?.filter((item) => item.type === "text").map((item) => item.text ?? "").join("") || "{}";
}

export async function invokeProvider<T>(input: ProviderInvocation) {
  const normalized = {
    ...input,
    config: {
      ...input.config,
      model: resolveProviderModel(input.config)
    }
  };

  let raw = "{}";
  try {
    if (normalized.config.provider === "openai") {
      raw = await callOpenAI(normalized);
    } else if (normalized.config.provider === "gemini") {
      raw = await callGemini(normalized);
    } else {
      raw = await callAnthropic(normalized);
    }
  } catch (error) {
    throw normalizeProviderError(error, normalized.config.provider);
  }

  return {
    provider: normalized.config.provider,
    model: normalized.config.model || PROVIDER_DEFAULTS[normalized.config.provider].model,
    raw,
    json: parseJsonObject<T>(raw)
  };
}
