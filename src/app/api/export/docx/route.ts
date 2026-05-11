import { NextResponse } from "next/server";

import { patchDocxTemplate } from "@/lib/export/docx-template";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const templateFile = formData.get("templateFile");
    const originalText = String(formData.get("originalText") ?? "");
    const exportText = String(formData.get("exportText") ?? "");
    const lineDiffsRaw = String(formData.get("lineDiffs") ?? "[]");
    const skillsDiffRaw = String(formData.get("skillsDiff") ?? "null");
    const layoutHintsRaw = String(formData.get("layoutHints") ?? "null");
    const qualityModeRaw = String(formData.get("qualityMode") ?? "visual-fit-first");
    const onePage = String(formData.get("onePage") ?? "true") !== "false";
    const candidateName = String(formData.get("candidateName") ?? "candidate");
    const companyName = String(formData.get("companyName") ?? "company");
    let lineDiffs: { original: string; improved: string }[] = [];
    let skillsDiff: { original?: string; improved?: string; accepted?: boolean } | null = null;
    let layoutHints: unknown = null;

    try {
      const parsed = JSON.parse(lineDiffsRaw);
      lineDiffs = Array.isArray(parsed) ? parsed : [];
    } catch {
      lineDiffs = [];
    }

    try {
      const parsed = JSON.parse(skillsDiffRaw);
      skillsDiff = parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      skillsDiff = null;
    }

    try {
      layoutHints = JSON.parse(layoutHintsRaw);
    } catch {
      layoutHints = null;
    }

    const qualityMode =
      qualityModeRaw === "strict-character-target" || qualityModeRaw === "content-first"
        ? qualityModeRaw
        : "visual-fit-first";

    const templateBuffer =
      templateFile instanceof File ? Buffer.from(await templateFile.arrayBuffer()) : undefined;

    const result = await patchDocxTemplate({
      templateBuffer,
      originalText,
      exportText,
      lineDiffs,
      skillsDiff,
      onePage,
      qualityMode,
      layoutHints,
      candidateName,
      companyName
    });
    const qa = "qa" in result ? result.qa : undefined;

    return new NextResponse(new Uint8Array(result.buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${result.fileName}"`,
        "X-Template-Preserved": String(result.preservedTemplate),
        "X-Patched-Lines": String(qa?.patchedLines ?? 0),
        "X-Trailing-Blank-Rows-Removed": String(qa?.trailingBlankRowsRemoved ?? 0),
        "X-Visible-Paragraphs-Before": String(qa?.visibleParagraphsBefore ?? 0),
        "X-Visible-Paragraphs-After": String(qa?.visibleParagraphsAfter ?? 0),
        "X-Compressed-Lines": String(qa?.compressedLines ?? 0),
        "X-Skills-Patched": String(qa?.skillsPatched ?? false),
        "X-Quality-Mode": qa?.qualityMode ?? qualityMode,
        "X-Fit-Strategy": qa?.fitStrategy ?? "target",
        "X-PDF-Exported": String(qa?.pdfExported ?? false),
        "X-Render-Verification": qa?.renderVerification ?? "not-run",
        "X-Export-QA": JSON.stringify({
          docxPatched: Boolean(qa?.patchedLines || qa?.skillsPatched),
          pdfExported: false,
          pageCount: qa?.renderVerification === "passed-one-page" ? 1 : null,
          textSelectable: null,
          linksPreserved: null,
          renderedPages: qa?.renderVerification === "passed-one-page" ? 1 : 0,
          warnings:
            qa?.renderVerification === "unavailable"
              ? ["DOCX render verification is unavailable in this environment."]
              : qa?.renderVerification === "failed-multiple-pages"
                ? ["DOCX render verification found multiple pages."]
                : []
        })
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to export DOCX."
      },
      { status: 400 }
    );
  }
}
