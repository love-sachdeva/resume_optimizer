import { SECTION_HEADINGS } from "@/lib/constants";
import { resumeProfileSchema, type ResumeExperience } from "@/lib/schemas";
import {
  collectBullets,
  detectDomains,
  detectTools,
  estimateYearsExperience,
  extractEmail,
  extractKeywords,
  extractLink,
  extractLocation,
  extractMetrics,
  extractPhone,
  normalizeWhitespace,
  sentenceCase,
  splitBlocks,
  splitCommaList,
  splitLines,
  unique
} from "@/lib/parsing/shared";

function buildSectionMap(text: string) {
  const lines = normalizeWhitespace(text).split("\n");
  const sections = new Map<string, string[]>();
  const headings = [...SECTION_HEADINGS].sort((left, right) => right.length - left.length);
  const experienceSections = new Set([
    "experience",
    "work experience",
    "professional experience",
    "employment",
    "work history",
    "internship",
    "internships"
  ]);
  const inRoleSubheadings = new Set([
    "achievements",
    "initiatives",
    "initiatives and achievements",
    "leadership",
    "rewards & recognition"
  ]);
  let currentSection = "general";
  sections.set(currentSection, []);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const normalized = line.toLowerCase().replace(/\s+/g, " ").trim();
    const compactNormalized = normalized.replace(/[^a-z]/g, "");
    const detectedHeading = headings.find((heading) => {
      const compactHeading = heading.replace(/[^a-z]/g, "");
      const exact = normalized === heading;
      const spacedPrefix = normalized.startsWith(`${heading} `) && line.length < 120;
      const compactPrefix =
        ["education", "experience", "internship", "internships", "projects", "skills"].includes(heading) &&
        compactNormalized.startsWith(compactHeading) &&
        compactNormalized.length > compactHeading.length;

      return exact || spacedPrefix || compactPrefix;
    });

    if (detectedHeading) {
      if (experienceSections.has(currentSection) && inRoleSubheadings.has(detectedHeading)) {
        sections.get(currentSection)?.push(rawLine);
        continue;
      }

      currentSection = detectedHeading;
      if (!sections.has(currentSection)) {
        sections.set(currentSection, []);
      }
      const remainder = line.slice(detectedHeading.length).trim();
      if (remainder) {
        sections.get(currentSection)?.push(remainder);
      }
      continue;
    }

    sections.get(currentSection)?.push(rawLine);
  }

  return sections;
}

function splitResumeBlocks(sectionText: string) {
  const lines = splitLines(sectionText);
  if (!lines.length) {
    return [];
  }

  const dateSignal =
    /(?:\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*[’' -]*\d{2,4}\b|\b(?:19|20)\d{2}\b|\bpresent\b|\bcurrent\b)/i;
  const educationSignal = /\b(class|cgpa|gpa|school|college|university|institute|bachelor|b\.?tech|mba|pgp)\b/i;
  const blocks: string[] = [];
  let current: string[] = [];

  lines.forEach((line) => {
    const startsNewRole =
      current.length > 1 &&
      dateSignal.test(line) &&
      !educationSignal.test(line) &&
      line.length < 190;

    if (startsNewRole) {
      blocks.push(current.join("\n"));
      current = [];
    }

    current.push(line);
  });

  if (current.length) {
    blocks.push(current.join("\n"));
  }

  return blocks.length > 1 ? blocks : splitBlocks(sectionText);
}

function parseExperienceBlock(block: string, fallbackTitle?: string): ResumeExperience | null {
  const lines = splitLines(block);
  if (!lines.length) {
    return null;
  }

  const header = lines[0];
  const headerParts = header.split("|").map((part) => part.trim());
  const [first, second = "", third = "", fourth = ""] = headerParts;

  let title = first;
  let company = second;
  let datePart = third;
  let location = fourth;

  if (!company && / at /i.test(first)) {
    const [left, right] = first.split(/ at /i);
    title = left.trim();
    company = right.trim();
  }

  if (!company && lines[1] && !/^[-*•●]/.test(lines[1])) {
    company = title;
    title = lines[1].trim();
  }

  if (!datePart) {
    datePart =
      lines.find((line) => /(20\d{2}|present|current)/i.test(line) && line !== header) ?? "";
  }

  if (!location) {
    location = lines.find((line) => /(remote|india|usa|uk|onsite|hybrid)/i.test(line)) ?? "";
  }

  const bullets = collectBullets(block);
  if (!bullets.length && lines.length <= 2) {
    return null;
  }

  const [startDate = "", endDate = ""] = datePart
    .split(/-|–|to/)
    .map((part) => part.trim());

  return {
    company: company || (fallbackTitle ? sentenceCase(fallbackTitle) : "Company"),
    title: title || fallbackTitle || "Role",
    location,
    startDate,
    endDate,
    summary: "",
    bullets,
    keywords: extractKeywords(block, 10),
    metrics: extractMetrics(bullets)
  };
}

function parseEducation(blocks: string[]) {
  return blocks.map((block) => {
    const lines = splitLines(block);
    const [header = "", detail = ""] = lines;
    const [degree = "", institution = ""] = header.split("|").map((part) => part.trim());
    const years = detail.match(/(20\d{2})(?:\s*[-–]\s*(20\d{2}|Present))?/i);

    return {
      institution: institution || header || "Institution",
      degree: degree || detail || "",
      field: "",
      startDate: years?.[1] ?? "",
      endDate: years?.[2] ?? "",
      details: lines.slice(2)
    };
  });
}

export function parseResumeText(text: string) {
  const normalized = normalizeWhitespace(text);
  const lines = splitLines(normalized);
  const sections = buildSectionMap(normalized);
  const firstLine = lines[0] ?? "Candidate";
  const summary =
    sections.get("summary")?.join(" ").trim() ||
    sections.get("professional summary")?.join(" ").trim() ||
    "";

  const experienceSections = [
    "experience",
    "work experience",
    "professional experience",
    "employment",
    "work history",
    "internship",
    "internships",
    "founder's ops",
    "founders ops"
  ] as const;

  const experienceBlocks = experienceSections.flatMap((sectionName) =>
    splitResumeBlocks(sections.get(sectionName)?.join("\n") || "").map((block) => ({
      block,
      sectionName
    }))
  );

  const projectText =
    sections.get("projects")?.join("\n") ||
    sections.get("project experience")?.join("\n") ||
    sections.get("live projects")?.join("\n") ||
    sections.get("business projects")?.join("\n") ||
    sections.get("selected deals")?.join("\n") ||
    sections.get("automation projects")?.join("\n") ||
    sections.get("achievements")?.join("\n") ||
    "";

  const educationText = sections.get("education")?.join("\n") || "";
  const skillsText =
    sections.get("skills")?.join("\n") ||
    sections.get("technical skills")?.join("\n") ||
    sections.get("industry knowledge")?.join("\n") ||
    sections.get("tools & technologies")?.join("\n") ||
    "";

  const experiences = experienceBlocks
    .map(({ block, sectionName }) => parseExperienceBlock(block, sectionName))
    .filter((item): item is ResumeExperience => Boolean(item));

  const projects = splitBlocks(projectText).map((block) => {
    const linesInBlock = splitLines(block);
    const [name = "Project", ...rest] = linesInBlock;
    const bullets = collectBullets(block);

    return {
      name,
      role: "",
      description: rest.filter((line) => !/^[-*•●]/.test(line)).join(" "),
      bullets,
      technologies: detectTools(block)
    };
  });

  const leadershipText = [
    sections.get("leadership")?.join("\n"),
    sections.get("positions of responsibility")?.join("\n"),
    sections.get("positions of")?.join("\n"),
    sections.get("por")?.join("\n"),
    sections.get("co-curriculars")?.join("\n"),
    sections.get("co-curricular")?.join("\n"),
    sections.get("extra-curricular")?.join("\n"),
    sections.get("extra curricular")?.join("\n"),
    sections.get("extracurricular")?.join("\n"),
    sections.get("extra-curriculars")?.join("\n"),
    sections.get("community")?.join("\n"),
    sections.get("social")?.join("\n")
  ].filter(Boolean).join("\n\n");

  const education = parseEducation(splitBlocks(educationText));
  const skills = unique([
    ...splitCommaList(skillsText),
    ...detectTools(normalized),
    ...detectDomains(normalized)
  ]);

  return resumeProfileSchema.parse({
    identity: {
      name: sentenceCase(firstLine),
      email: extractEmail(normalized),
      phone: extractPhone(normalized),
      linkedin: extractLink(normalized, "linkedin"),
      github: extractLink(normalized, "github"),
      location: extractLocation(lines)
    },
    summary,
    targetRoles: [],
    industries: detectDomains(normalized),
    sectionOrder: [...sections.keys()].filter((section) => section !== "general"),
    experiences,
    projects,
    education,
    skills,
    certifications: splitBlocks(
      sections.get("certifications")?.join("\n") ||
      sections.get("certification")?.join("\n") ||
      ""
    ),
    awards: splitBlocks([
      sections.get("awards")?.join("\n"),
      sections.get("achievements")?.join("\n"),
      sections.get("initiatives")?.join("\n"),
      sections.get("initiatives and achievements")?.join("\n"),
      sections.get("rewards & recognition")?.join("\n"),
      leadershipText
    ].filter(Boolean).join("\n\n")),
    rawText: normalized,
    totalYearsExperience: estimateYearsExperience(normalized),
    formattingPreferences: {
      onePage: normalized.length < 5000,
      keepSameFormat: false,
      tone: "balanced",
      formatMode: "ats-optimized"
    }
  });
}
