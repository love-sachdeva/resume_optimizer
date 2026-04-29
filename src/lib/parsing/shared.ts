import {
  DOMAIN_KEYWORDS,
  KNOWN_TOOLS,
  MONTH_NAMES,
  STOPWORDS
} from "@/lib/constants";
import { titleCase } from "@/lib/utils";

export function normalizeWhitespace(text: string) {
  return text.replace(/\r/g, "").replace(/\t/g, " ").replace(/\u2022/g, "-");
}

export function splitLines(text: string) {
  return normalizeWhitespace(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function splitBlocks(text: string) {
  return normalizeWhitespace(text)
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);
}

export function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#./ -]/g, " ")
    .split(/\s+/)
    .map((token) => token.replace(/^[^a-z0-9+#]+|[^a-z0-9+#]+$/gi, ""))
    .filter((token) => token.length > 2 && !STOPWORDS.has(token) && !/^\d/.test(token));
}

export function unique<T>(items: T[]) {
  return [...new Set(items)];
}

export function extractKeywords(text: string, limit = 18) {
  const scores = new Map<string, number>();
  for (const token of tokenize(text)) {
    scores.set(token, (scores.get(token) ?? 0) + 1);
  }
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([token]) => token);
}

export function extractEmail(text: string) {
  return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "";
}

export function extractPhone(text: string) {
  return (
    text.match(
      /(\+?\d[\d\s().-]{7,}\d)/g
    )?.find((value) => value.replace(/\D/g, "").length >= 10) ?? ""
  );
}

export function extractLink(text: string, label: "linkedin" | "github") {
  return text.match(new RegExp(`${label}[^\\s|]*[:\\s]+([^\\s|]+)`, "i"))?.[1] ?? "";
}

export function extractLocation(lines: string[]) {
  return (
    lines.find((line) =>
      /(remote|hybrid|onsite|india|bengaluru|bangalore|mumbai|delhi|pune|usa|uk|europe|singapore)/i.test(
        line
      )
    ) ?? ""
  );
}

export function detectDomains(text: string) {
  const lower = text.toLowerCase();
  return unique(
    Object.entries(DOMAIN_KEYWORDS)
      .filter(([, keywords]) => keywords.some((keyword) => lower.includes(keyword)))
      .map(([domain]) => domain)
  );
}

export function detectTools(text: string) {
  const lower = text.toLowerCase();
  return unique(
    KNOWN_TOOLS.filter((tool) => lower.includes(tool)).map((tool) => titleCase(tool))
  );
}

export function estimateYearsExperience(text: string) {
  const years = [...text.matchAll(/\b(20\d{2}|19\d{2})\b/g)].map((match) =>
    Number(match[1])
  );
  if (years.length < 2) {
    return 0;
  }

  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  const yearSpan = Math.max(0, maxYear - minYear);

  const monthMatches = MONTH_NAMES.filter((month) =>
    text.toLowerCase().includes(month)
  ).length;

  return Number((yearSpan + Math.min(monthMatches / 12, 0.9)).toFixed(1));
}

export function collectBullets(blockText: string) {
  const lines = blockText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const bullets: string[] = [];
  const actionLine =
    /^(achieved|aided|amplified|analyzed|automated|built|closed|collaborated|conducted|consulted|contributed|coordinated|created|curated|delivered|designed|developed|devised|drove|enabled|executed|formulated|gathered|grossed|implemented|improved|increased|launched|led|maintained|managed|mentored|owned|prepared|provided|reduced|researched|scaled|secured|selected|standardized|streamlined|supported|surpassed|won)\b/i;
  const likelyHeaderLine =
    /\b(pvt\.?|ltd\.?|limited|inc\.?|llp|corp\.?|corporation|company|mnc|university|school|institute|college)\b/i;
  const likelyDateHeader =
    /^(?:\d{4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*[’' -]*\d{2,4})\b/i;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (/^[-*•●]\s*$/.test(line)) {
      const nextLine = lines[index + 1]?.replace(/^[-*•●]\s*/, "").trim();
      if (nextLine) {
        bullets.push(nextLine);
        index += 1;
      }
      continue;
    }

    if (/^[-*•●]\s+/.test(line)) {
      bullets.push(line.replace(/^[-*•●]\s*/, "").trim());
      continue;
    }

    if (
      line.length >= 45 &&
      line.length <= 220 &&
      !(likelyHeaderLine.test(line) && !actionLine.test(line)) &&
      !(likelyDateHeader.test(line) && !actionLine.test(line)) &&
      !(/\brevenue\s*[:|]\s*/i.test(line) && !actionLine.test(line)) &&
      (actionLine.test(line) || (/\d/.test(line) && /\b(revenue|cost|growth|saved|reduced|increased|managed|led|built|launched|clients?|users?|teams?|projects?|deals?)\b/i.test(line)))
    ) {
      bullets.push(line);
    }
  }

  return bullets;
}

export function extractMetrics(lines: string[]) {
  return lines.filter((line) => /\d/.test(line));
}

export function sentenceCase(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export function splitCommaList(text: string) {
  return text
    .split(/[,|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}
