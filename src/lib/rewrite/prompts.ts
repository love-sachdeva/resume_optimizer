import type {
  JobDescriptionProfile,
  QuestionnaireAnswers,
  ResumeProfile
} from "@/lib/schemas";

export function buildResumeExtractionPrompt(text: string) {
  return [
    "Extract this resume into strict JSON.",
    "Preserve only facts that are explicitly supported.",
    "Capture identity, summary, experiences, projects, education, skills, certifications, awards, and section order.",
    "Treat these as valid resume sections even when formatting is messy: Education, Experience, Internships, Projects, Live Projects, Business Projects, Selected Deals, Automation Projects, Leadership, PoR, Positions of Responsibility, Co-Curriculars, Extra-Curriculars, Achievements, Certifications, Skills.",
    "Treat standalone bullet symbols like '●' or '•' followed by the next line as one bullet.",
    "Inside Experience, preserve subheadings such as Strategy, Client Impact, Product Development, Process Optimization, Data Analytics, Responsibilities, Selected Deals, Initiatives/Awards, and Training/Awards as context; do not drop the bullets under them.",
    "Resume text:",
    text
  ].join("\n\n");
}

export function buildJobDescriptionExtractionPrompt(text: string) {
  return [
    "Extract this job description into strict JSON.",
    "Identify role title, company, seniority, must-have keywords, domain keywords, tools, hard filters, responsibilities, qualifications, location requirements, and application questions.",
    "Job description text:",
    text
  ].join("\n\n");
}

export function buildRewritePrompt(
  resume: ResumeProfile,
  jd: JobDescriptionProfile,
  answers?: QuestionnaireAnswers
) {
  return [
    "Rewrite this resume truthfully for ATS optimization.",
    "First infer the JD positioning blueprint: role archetype, priority keywords, operating language, success metrics, recruiter story, hard filters, and critical gaps.",
    "For every inserted keyword, mentally tag it as directly supported, adjacent, question-needed, or unsupported.",
    "Do not fabricate tools, titles, metrics, certifications, ownership, or domain expertise.",
    "Only insert JD keywords when the resume or questionnaire clearly supports them.",
    "Never insert unsupported or question-needed keywords into resume bullets or skills.",
    "Preserve every company, title, date, degree, certification, and existing skill unless the user explicitly asked to remove it.",
    "Preserve domain subheadings under each role, for example Strategy, Product Development, Client Impact, Selected Deals, Data Analytics, and Initiatives/Awards.",
    "Preserve the original bullet count and bullet order in same-format mode; rewrite the sentence, do not swap content between bullets.",
    "Detect each bullet's format and keep it: RAC/result-first bullets stay result-first; STAR/action-context-result bullets stay action-context-result.",
    "Keep each rewritten bullet within 115-120 characters, or shorter if the original bullet was shorter.",
    "Never add awkward keyword tails such as 'across API', 'across stakeholder', or generic keyword stuffing.",
    "If the JD asks for hard requirements not present in the resume, list them as unsupportedSuggestions instead of inventing them.",
    "Prefer stronger phrasing, tighter bullets, cleaner sequencing, and recruiter-friendly summaries.",
    `Target role: ${jd.roleTitle} at ${jd.company || "the company"}`,
    `Must-have keywords: ${jd.mustHaveKeywords.join(", ")}`,
    `Domain keywords: ${jd.domainKeywords.join(", ")}`,
    `Tools keywords: ${jd.toolsKeywords.join(", ")}`,
    `Resume summary: ${resume.summary}`,
    `Questionnaire answers: ${answers ? JSON.stringify(answers, null, 2) : "None"}`,
    "Return improved resume content plus a line-by-line diff."
  ].join("\n\n");
}
