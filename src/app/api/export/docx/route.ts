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
    const onePage = String(formData.get("onePage") ?? "true") !== "false";
    const candidateName = String(formData.get("candidateName") ?? "candidate");
    const companyName = String(formData.get("companyName") ?? "company");
    let lineDiffs: { original: string; improved: string }[] = [];

    try {
      const parsed = JSON.parse(lineDiffsRaw);
      lineDiffs = Array.isArray(parsed) ? parsed : [];
    } catch {
      lineDiffs = [];
    }

    const templateBuffer =
      templateFile instanceof File ? Buffer.from(await templateFile.arrayBuffer()) : undefined;

    const result = await patchDocxTemplate({
      templateBuffer,
      originalText,
      exportText,
      lineDiffs,
      onePage,
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
        "X-Render-Verification": qa?.renderVerification ?? "not-run"
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
