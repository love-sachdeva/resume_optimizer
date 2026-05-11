import { DOMAIN_KEYWORDS, ROLE_ADJACENCY, ROLE_PACKS, SENIORITY_KEYWORDS } from "@/lib/constants";
import { jobDescriptionProfileSchema } from "@/lib/schemas";
import {
  detectDomains,
  detectTools,
  extractKeywords,
  normalizeWhitespace,
  splitBlocks,
  splitLines,
  unique
} from "@/lib/parsing/shared";

const ROLE_PHRASE_KEYWORDS = [
  "chief of staff",
  "ceo office",
  "ceo priorities",
  "founder's office",
  "founders office",
  "founder office",
  "founder bandwidth",
  "bizops",
  "okrs",
  "qbrs",
  "quarterly business review",
  "operating cadence",
  "leadership reviews",
  "executive dashboards",
  "business metrics",
  "board decks",
  "board narrative",
  "investor updates",
  "investor tracker",
  "fundraising support",
  "hiring ops",
  "talent sourcing",
  "delivery excellence",
  "sales-to-delivery alignment",
  "client outcomes",
  "client escalations",
  "revenue growth",
  "arr growth",
  "b2b saas",
  "margins",
  "digital growth",
  "seo strategy",
  "aeo",
  "answer engine optimization",
  "content strategy",
  "content engine",
  "performance marketing",
  "ai-led growth",
  "ai discovery",
  "cross-functional governance",
  "stakeholder management",
  "process mapping",
  "end-state design",
  "risk controls",
  "change management",
  ...ROLE_PACKS.flatMap((pack) => pack.keywords)
];

function includesPhrase(text: string, phrase: string) {
  const normalizedText = text.toLowerCase().replace(/[–—-]/g, " ");
  const normalizedPhrase = phrase.toLowerCase().replace(/[–—-]/g, " ");
  return normalizedText.includes(normalizedPhrase);
}

function inferRoleFamily(roleTitle: string) {
  const lower = roleTitle.toLowerCase();

  for (const [family, adjacent] of Object.entries(ROLE_ADJACENCY)) {
    if (lower.includes(family) || adjacent.some((title) => lower.includes(title))) {
      return family;
    }
  }

  return lower.split(/\s+/).slice(-2).join(" ").trim();
}

function inferSeniority(roleTitle: string, text: string) {
  const lower = `${roleTitle} ${text}`.toLowerCase();

  for (const [level, keywords] of Object.entries(SENIORITY_KEYWORDS)) {
    if (keywords.some((keyword) => lower.includes(keyword))) {
      return level;
    }
  }

  if (/\b[3-5]\+?\s+years?\b/i.test(text)) {
    return "mid";
  }

  return "entry";
}

function extractResponsibilities(text: string) {
  const blocks = splitBlocks(text);
  const responsibilitiesBlock =
    blocks.find((block) => /^responsibilities/i.test(block)) ??
    blocks.find((block) => /responsib/i.test(block)) ??
    "";

  return responsibilitiesBlock
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[-*•]/.test(line))
    .map((line) => line.replace(/^[-*•]\s*/, ""));
}

function extractQualifications(text: string) {
  const blocks = splitBlocks(text);
  const qualificationsBlock =
    blocks.find((block) => /qualifications|requirements/i.test(block)) ?? "";

  return qualificationsBlock
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[-*•]/.test(line))
    .map((line) => line.replace(/^[-*•]\s*/, ""));
}

function extractHardFilters(text: string) {
  const filters: { type: "location" | "experience" | "education" | "visa" | "other"; value: string; required: boolean }[] =
    [];
  const isRequired = (value: string) =>
    /\b(mandatory|must[-\s]?have|required|minimum|only candidates|need(?:s|ed)?|should have)\b/i.test(value);
  const locationMatch = text.match(
    /(based in [^.]+|open to relocation[^.]+|location[:\s][^.]+)/i
  );
  if (locationMatch) {
    filters.push({ type: "location", value: locationMatch[1].trim(), required: isRequired(locationMatch[1]) });
  }

  const experienceMatch = text.match(/(\d+\s*[-–]?\s*\d*\+?\s+years?[^.]+)/i);
  if (experienceMatch) {
    filters.push({ type: "experience", value: experienceMatch[1].trim(), required: isRequired(experienceMatch[1]) });
  }

  const educationMatch = text.match(/((?:mandatory|required|must[-\s]?have|minimum|need(?:s|ed)?)[^.]{0,80}(?:bachelor'?s|master'?s|mba|degree)[^.]*|(?:bachelor'?s|master'?s|mba|degree)[^.]{0,80}(?:mandatory|required|must[-\s]?have|minimum|need(?:s|ed)?)[^.]*)/i);
  if (educationMatch) {
    filters.push({ type: "education", value: educationMatch[1].trim(), required: true });
  }

  const visaMatch = text.match(/(visa|work authorization|sponsorship[^.]+)/i);
  if (visaMatch) {
    filters.push({ type: "visa", value: visaMatch[1].trim(), required: isRequired(visaMatch[1]) });
  }

  return filters;
}

function extractMustHaveKeywords(text: string) {
  const lower = text.toLowerCase();
  const candidates = extractKeywords(text, 32);
  const phraseKeywords = ROLE_PHRASE_KEYWORDS.filter((phrase) => includesPhrase(lower, phrase));
  const boosted = candidates.filter(
    (keyword) =>
      new RegExp(`(must|required|responsib|qualif)[\\s\\S]{0,80}${keyword}`, "i").test(lower) ||
      /\b(sql|api|payments|product|analytics|stakeholder|research|roadmap)\b/i.test(keyword)
  );

  return unique([...phraseKeywords, ...boosted]).slice(0, 18);
}

export function parseJobDescriptionText(text: string) {
  const normalized = normalizeWhitespace(text);
  const lines = splitLines(normalized);
  const roleTitle = lines[0] ?? "";
  const company =
    lines.find((line, index) => index > 0 && line.length < 60 && /[A-Z]/.test(line)) ?? "";
  const responsibilities = extractResponsibilities(normalized);
  const qualifications = extractQualifications(normalized);
  const mustHaveKeywords = extractMustHaveKeywords(normalized);
  const domainKeywords = unique([
    ...detectDomains(normalized),
    ...Object.entries(DOMAIN_KEYWORDS)
      .flatMap(([, keywords]) => keywords.filter((keyword) => normalized.toLowerCase().includes(keyword)))
      .slice(0, 10)
  ]);
  const toolsKeywords = detectTools(normalized);

  return jobDescriptionProfileSchema.parse({
    company,
    roleTitle,
    seniority: inferSeniority(roleTitle, normalized),
    roleFamily: inferRoleFamily(roleTitle),
    mustHaveKeywords,
    domainKeywords,
    toolsKeywords,
    hardFilters: extractHardFilters(normalized),
    responsibilities,
    qualifications,
    locationRequirements:
      lines.find((line) => /(remote|hybrid|onsite|relocation|location)/i.test(line)) ?? "",
    applicationQuestions: lines.filter((line) => line.includes("?")),
    rawText: normalized
  });
}
