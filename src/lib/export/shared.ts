import { slugify } from "@/lib/utils";

export function buildExportBaseName(candidateName: string, companyName: string) {
  const safeCandidate = slugify(candidateName || "candidate");
  const safeCompany = slugify(companyName || "company");
  return `${safeCandidate}-${safeCompany}-thankyoulove`;
}

export function decodeXmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function encodeXmlEntities(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function normalizeExportLines(exportText: string) {
  return exportText
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0);
}
