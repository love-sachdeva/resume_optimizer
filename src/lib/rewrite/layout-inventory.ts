import { SECTION_HEADINGS } from "@/lib/constants";
import type { LayoutInventory } from "@/lib/schemas";

const SECTION_HEADING_SET = new Set(SECTION_HEADINGS.map((heading) => heading.toLowerCase()));

function normalizeLine(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function stripBullet(value: string) {
  return normalizeLine(value.replace(/^[-*•●]\s*/, ""));
}

function isLikelySectionHeading(line: string) {
  const normalized = stripBullet(line).toLowerCase().replace(/[:|]$/, "");
  return SECTION_HEADING_SET.has(normalized);
}

function isLikelyCandidateLine(line: string) {
  const text = stripBullet(line);
  if (text.length < 45 || text.length > 190) {
    return false;
  }
  if (/@|\blinkedin\b|\bportfolio\b/i.test(text)) {
    return false;
  }
  if (isLikelySectionHeading(text)) {
    return false;
  }
  if (/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{4}|20\d{2}|19\d{2})\b/i.test(text)) {
    return false;
  }
  if (/\b(cgpa|gpa|class\s+x|class\s+xii|b\.?\s*tech|pgp|mba|school|university|institute)\b/i.test(text)) {
    return false;
  }

  return /^[-*•●]\s*/.test(line) || /\d|₹|%|users?|teams?|clients?|vendors?|partners?|meetings?|revenue|launched|built|improved|reduced|scaled|increased/i.test(text);
}

function inferLayoutKind(lines: string[]): LayoutInventory["layoutKind"] {
  const tabbedLines = lines.filter((line) => line.includes("\t")).length;
  const pipeLines = lines.filter((line) => (line.match(/\|/g) ?? []).length >= 2).length;
  const tableLikeRows = lines.filter((line) => /\S\s{3,}\S\s{3,}\S/.test(line)).length;

  if (tabbedLines >= 4 || tableLikeRows >= 4) {
    return pipeLines >= 4 ? "mixed" : "paragraphs";
  }
  if (pipeLines >= 5) {
    return "tables";
  }
  return "text";
}

function findSkillsLine(lines: string[]): LayoutInventory["skillsLine"] {
  const skillsLabelPattern =
    /^(technical\s+skills|product\s+skills|business\s+skills|management\s+skills|program\s+skills|growth\s+skills|gtm\s+skills|industry knowledge|tools?\s*&?\s*technologies?|skills)$/i;
  const directIndex = lines.findIndex((line) => /^\s*(technical\s+skills|product\s+skills|business\s+skills|management\s+skills|program\s+skills|growth\s+skills|gtm\s+skills|industry knowledge|tools?\s*&?\s*technologies?|skills)\s*[:|\t]/i.test(line));
  if (directIndex >= 0) {
    return {
      text: lines[directIndex],
      lineIndex: directIndex
    };
  }

  const headingIndex = lines.findIndex((line) => skillsLabelPattern.test(stripBullet(line)));
  if (headingIndex < 0) {
    return null;
  }

  const nextIndex = lines.findIndex((line, index) => index > headingIndex && stripBullet(line).length > 0);
  if (nextIndex < 0) {
    return {
      text: lines[headingIndex],
      lineIndex: headingIndex
    };
  }

  return {
    text: lines[nextIndex],
    lineIndex: nextIndex
  };
}

function collectHyperlinks(text: string): LayoutInventory["hyperlinks"] {
  const links: LayoutInventory["hyperlinks"] = [];
  const emailMatches = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  emailMatches.forEach((email) => {
    links.push({
      text: email,
      target: `mailto:${email}`,
      kind: "email"
    });
  });

  const urlMatches = text.match(/https?:\/\/[^\s)]+/gi) ?? [];
  urlMatches.forEach((url) => {
    links.push({
      text: url,
      target: url,
      kind: /linkedin/i.test(url) ? "linkedin" : "url"
    });
  });

  if (/\blinkedin\b/i.test(text) && !links.some((link) => link.kind === "linkedin")) {
    links.push({
      text: "LinkedIn",
      target: "",
      kind: "linkedin"
    });
  }

  return links;
}

function inferDensityRisk(lines: string[], candidateCount: number): LayoutInventory["densityRisk"] {
  const visibleLines = lines.filter((line) => stripBullet(line).length > 0).length;
  const longLines = lines.filter((line) => stripBullet(line).length > 110).length;

  if (visibleLines >= 65 || candidateCount >= 24 || longLines >= 16) {
    return "high";
  }
  if (visibleLines >= 48 || candidateCount >= 16 || longLines >= 8) {
    return "medium";
  }
  return "low";
}

export function buildTextLayoutInventory(text: string): LayoutInventory {
  const lines = text.replace(/\r/g, "").split("\n");
  const sections = lines
    .map((line, lineIndex) => ({ line, lineIndex }))
    .filter(({ line }) => isLikelySectionHeading(line))
    .map(({ line, lineIndex }) => ({
      heading: stripBullet(line).replace(/[:|]$/, ""),
      lineIndex
    }));
  const candidateLines = lines
    .map((line, lineIndex) => ({ text: stripBullet(line), lineIndex }))
    .filter(({ text }) => isLikelyCandidateLine(text))
    .map(({ text, lineIndex }) => ({
      text,
      lineIndex,
      charCount: text.length,
      reason: /^[-*•●]/.test(lines[lineIndex]) ? "bullet-like" : "impact-like"
    }));

  return {
    layoutKind: inferLayoutKind(lines),
    sections,
    candidateLines,
    skillsLine: findSkillsLine(lines),
    hyperlinks: collectHyperlinks(text),
    fontPt: null,
    pageSize: "unknown",
    densityRisk: inferDensityRisk(lines, candidateLines.length)
  };
}
