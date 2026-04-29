import {
  AlignmentType,
  Document,
  Packer,
  Paragraph,
  ShadingType,
  TabStopType,
  TextRun,
} from "docx";
import { jsPDF } from "jspdf";

import { buildExportBaseName } from "@/lib/export/shared";

const SECTION_LABELS = new Set([
  "education",
  "experience",
  "internship",
  "internships",
  "founder's ops",
  "founders ops",
  "achievements",
  "certifications",
  "skills",
  "projects",
  "summary",
  "professional summary"
]);

/* ── Layout geometry matching pm_resume.docx ────────────── */

const LEFT_TAB = 1400;
const CENTER_TAB = 2550;
const RIGHT_TAB = 8700;
const BODY_FONT_SIZE = 20; // half-points (10pt)
const NAME_FONT_SIZE = 28; // 14pt
const CONTACT_FONT_SIZE = 20; // 10pt
const SECTION_FONT_SIZE = 22; // 11pt
const CENTER_BOLD_SIZE = 21; // 10.5pt

type LayoutLine =
  | { kind: "name"; text: string }
  | { kind: "contact"; text: string }
  | { kind: "section"; text: string }
  | { kind: "triple"; left: string; center: string; right: string }
  | { kind: "double"; left: string; center: string }
  | { kind: "bullet"; text: string }
  | { kind: "text"; text: string }
  | { kind: "blank" };

function normalizeLine(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function splitPreservingMeaning(line: string) {
  return line
    .split(/\s{2,}/)
    .map((part) => normalizeLine(part))
    .filter(Boolean);
}

export function classifyResumeLayoutLines(text: string) {
  const rawLines = text.replace(/\r/g, "").split("\n");
  const lines: LayoutLine[] = [];
  let nonEmptyCount = 0;

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();

    if (!trimmed) {
      lines.push({ kind: "blank" });
      continue;
    }

    nonEmptyCount += 1;

    if (nonEmptyCount === 1) {
      lines.push({ kind: "name", text: normalizeLine(trimmed) });
      continue;
    }

    if (
      nonEmptyCount === 2 &&
      (/@/.test(trimmed) || /\+\d/.test(trimmed) || /linkedin/i.test(trimmed))
    ) {
      lines.push({ kind: "contact", text: normalizeLine(trimmed) });
      continue;
    }

    const lower = normalizeLine(trimmed).toLowerCase();
    if (SECTION_LABELS.has(lower)) {
      lines.push({ kind: "section", text: trimmed });
      continue;
    }

    if (/^[-*•]\s*/.test(trimmed)) {
      lines.push({ kind: "bullet", text: trimmed.replace(/^[-*•]\s*/, "") });
      continue;
    }

    const parts = splitPreservingMeaning(rawLine);
    if (parts.length >= 3) {
      lines.push({
        kind: "triple",
        left: parts[0],
        center: parts.slice(1, -1).join(" "),
        right: parts[parts.length - 1]
      });
      continue;
    }

    if (parts.length === 2) {
      lines.push({
        kind: "double",
        left: parts[0],
        center: parts[1]
      });
      continue;
    }

    lines.push({ kind: "text", text: normalizeLine(trimmed) });
  }

  return lines;
}

/* ── DOCX builder ───────────────────────────────────────── */

function buildDocxParagraphs(lines: LayoutLine[]) {
  return lines.flatMap((line) => {
    if (line.kind === "blank") {
      return [new Paragraph({ spacing: { after: 40 } })];
    }

    if (line.kind === "section") {
      return [
        new Paragraph({
          spacing: { before: 100, after: 40 },
          children: [
            new TextRun({
              text: line.text,
              bold: true,
              font: "Times New Roman",
              size: SECTION_FONT_SIZE,
              shading: {
                fill: "FFF200",
                type: ShadingType.CLEAR,
                color: "auto"
              }
            })
          ]
        })
      ];
    }

    if (line.kind === "triple") {
      return [
        new Paragraph({
          spacing: { after: 20 },
          tabStops: [
            { type: TabStopType.LEFT, position: LEFT_TAB },
            { type: TabStopType.LEFT, position: CENTER_TAB },
            { type: TabStopType.RIGHT, position: RIGHT_TAB }
          ],
          children: [
            new TextRun({ text: line.left, font: "Times New Roman", size: BODY_FONT_SIZE }),
            new TextRun("\t"),
            new TextRun({ text: line.center, font: "Times New Roman", bold: true, size: CENTER_BOLD_SIZE }),
            new TextRun("\t"),
            new TextRun({ text: line.right, font: "Times New Roman", size: BODY_FONT_SIZE })
          ]
        })
      ];
    }

    if (line.kind === "double") {
      return [
        new Paragraph({
          spacing: { after: 20 },
          tabStops: [
            { type: TabStopType.LEFT, position: LEFT_TAB },
            { type: TabStopType.LEFT, position: CENTER_TAB }
          ],
          children: [
            new TextRun({ text: line.left, font: "Times New Roman", size: BODY_FONT_SIZE }),
            new TextRun("\t"),
            new TextRun({ text: line.center, font: "Times New Roman", size: BODY_FONT_SIZE })
          ]
        })
      ];
    }

    if (line.kind === "bullet") {
      return [
        new Paragraph({
          indent: { left: CENTER_TAB, hanging: 160 },
          spacing: { after: 10 },
          children: [new TextRun({ text: `• ${line.text}`, font: "Times New Roman", size: BODY_FONT_SIZE })]
        })
      ];
    }

    if (line.kind === "text") {
      return [
        new Paragraph({
          indent: { left: CENTER_TAB },
          spacing: { after: 10 },
          children: [new TextRun({ text: line.text, font: "Times New Roman", size: BODY_FONT_SIZE })]
        })
      ];
    }

    return [];
  });
}

export async function buildStyledDocxFromLayout(input: {
  exportText: string;
  candidateName: string;
  companyName: string;
}) {
  const baseName = buildExportBaseName(input.candidateName, input.companyName);
  const lines = classifyResumeLayoutLines(input.exportText);
  const headerLines = lines.filter((line) => line.kind === "name" || line.kind === "contact");
  const bodyLines = lines.filter((line) => line.kind !== "name" && line.kind !== "contact");

  const document = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 480,
              bottom: 480,
              left: 420,
              right: 420
            }
          }
        },
        children: [
          ...headerLines.map((line) =>
            line.kind === "name"
              ? new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 60 },
                  children: [new TextRun({ text: line.text, font: "Times New Roman", bold: true, size: NAME_FONT_SIZE })]
                })
              : new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 120 },
                  children: [new TextRun({ text: line.text, font: "Times New Roman", size: CONTACT_FONT_SIZE })]
                })
          ),
          ...buildDocxParagraphs(bodyLines)
        ]
      }
    ]
  });

  return {
    buffer: await Packer.toBuffer(document),
    fileName: `${baseName}.docx`,
    preservedTemplate: false
  };
}

/* ── PDF builder ────────────────────────────────────────── */

function wrapText(doc: jsPDF, text: string, width: number) {
  return doc.splitTextToSize(text, width) as string[];
}

export async function buildStyledPdfFromLayout(input: {
  exportText: string;
  candidateName: string;
  companyName: string;
}) {
  const doc = new jsPDF({
    unit: "pt",
    format: "a4"
  });

  const baseName = buildExportBaseName(input.candidateName, input.companyName);
  const lines = classifyResumeLayoutLines(input.exportText);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const leftX = 24;
  const centerX = 138;
  const rightX = pageWidth - 24;
  const centerWidth = rightX - centerX - 10;
  let y = 34;

  const ensureSpace = (height: number) => {
    if (y + height <= pageHeight - 40) {
      return;
    }
    doc.addPage();
    y = 42;
  };

  for (const line of lines) {
    if (line.kind === "blank") {
      y += 8;
      continue;
    }

    if (line.kind === "name") {
      doc.setFont("times", "bold");
      doc.setFontSize(16.5);
      doc.text(line.text, pageWidth / 2, y, { align: "center" });
      y += 18;
      continue;
    }

    if (line.kind === "contact") {
      doc.setFont("times", "normal");
      doc.setFontSize(9.4);
      doc.text(line.text, pageWidth / 2, y, { align: "center" });
      y += 18;
      continue;
    }

    if (line.kind === "section") {
      ensureSpace(14);
      // Yellow highlight behind section header — measure text width dynamically
      doc.setFont("times", "bold");
      doc.setFontSize(10.8);
      const textWidth = doc.getTextWidth(line.text);
      doc.setFillColor(255, 242, 0);
      doc.rect(leftX - 2, y - 9, textWidth + 8, 14, "F");
      doc.text(line.text, leftX, y);
      y += 14;
      continue;
    }

    if (line.kind === "triple") {
      const wrappedCenter = wrapText(doc, line.center, centerWidth);
      const height = Math.max(11.5 * wrappedCenter.length, 11.5);
      ensureSpace(height + 2);
      doc.setFont("times", "normal");
      doc.setFontSize(9.6);
      doc.text(line.left, leftX, y);
      doc.setFont("times", "bold");
      doc.text(wrappedCenter, centerX, y);
      doc.setFont("times", "normal");
      doc.text(line.right, rightX, y, { align: "right" });
      y += height + 1.5;
      continue;
    }

    if (line.kind === "double") {
      const wrappedCenter = wrapText(doc, line.center, centerWidth);
      const height = Math.max(11.5 * wrappedCenter.length, 11.5);
      ensureSpace(height + 2);
      doc.setFont("times", "normal");
      doc.setFontSize(9.6);
      doc.text(line.left, leftX, y);
      doc.text(wrappedCenter, centerX, y);
      y += height + 1.5;
      continue;
    }

    if (line.kind === "bullet") {
      const wrapped = wrapText(doc, `• ${line.text}`, centerWidth);
      const height = wrapped.length * 11.5;
      ensureSpace(height + 1);
      doc.setFont("times", "normal");
      doc.setFontSize(9.6);
      doc.text(wrapped, centerX, y);
      y += height + 0.5;
      continue;
    }

    if (line.kind === "text") {
      const wrapped = wrapText(doc, line.text, centerWidth);
      const height = wrapped.length * 11.5;
      ensureSpace(height + 1);
      doc.setFont("times", "normal");
      doc.setFontSize(9.6);
      doc.text(wrapped, centerX, y);
      y += height + 0.5;
    }
  }

  return {
    buffer: Buffer.from(doc.output("arraybuffer")),
    fileName: `${baseName}.pdf`
  };
}
