import { buildStyledPdfFromLayout } from "@/lib/export/layout";

export async function buildPdfFromText(input: {
  exportText: string;
  candidateName: string;
  companyName: string;
}) {
  return buildStyledPdfFromLayout(input);
}
