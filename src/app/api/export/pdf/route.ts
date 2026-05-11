import { NextResponse } from "next/server";

import { patchDocxTemplate } from "@/lib/export/docx-template";
import { convertDocxToPdfWithIlovePdf } from "@/lib/export/ilovepdf";
import { buildExportBaseName } from "@/lib/export/shared";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    let templateBuffer: Buffer | undefined;
    let originalText = "";
    let exportText = "";
    let lineDiffs: { original: string; improved: string }[] = [];
    let skillsDiff: { original?: string; improved?: string; accepted?: boolean } | null = null;
    let layoutHints: unknown = null;
    let qualityMode: "visual-fit-first" | "strict-character-target" | "content-first" = "visual-fit-first";
    let candidateName = "candidate";
    let companyName = "company";

    if (contentType.includes("application/json")) {
      const body = await request.json().catch(() => ({}));
      exportText = String(body.exportText ?? "");
      candidateName = String(body.candidateName ?? "candidate");
      companyName = String(body.companyName ?? "company");
    } else if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const templateFile = formData.get("templateFile");
      templateBuffer =
        templateFile instanceof File ? Buffer.from(await templateFile.arrayBuffer()) : undefined;
      originalText = String(formData.get("originalText") ?? "");
      exportText = String(formData.get("exportText") ?? "");
      candidateName = String(formData.get("candidateName") ?? "candidate");
      companyName = String(formData.get("companyName") ?? "company");
      try {
        const parsed = JSON.parse(String(formData.get("lineDiffs") ?? "[]"));
        lineDiffs = Array.isArray(parsed) ? parsed : [];
      } catch {
        lineDiffs = [];
      }
      try {
        const parsed = JSON.parse(String(formData.get("skillsDiff") ?? "null"));
        skillsDiff = parsed && typeof parsed === "object" ? parsed : null;
      } catch {
        skillsDiff = null;
      }
      try {
        layoutHints = JSON.parse(String(formData.get("layoutHints") ?? "null"));
      } catch {
        layoutHints = null;
      }
      const qualityModeRaw = String(formData.get("qualityMode") ?? "visual-fit-first");
      qualityMode =
        qualityModeRaw === "strict-character-target" || qualityModeRaw === "content-first"
          ? qualityModeRaw
          : "visual-fit-first";
    }

    if (!exportText.trim()) {
      return NextResponse.json({ error: "Missing resume text for PDF export." }, { status: 400 });
    }

    const docxResult = await patchDocxTemplate({
      templateBuffer,
      originalText,
      exportText,
      lineDiffs,
      skillsDiff,
      onePage: true,
      qualityMode,
      layoutHints,
      candidateName,
      companyName
    });
    const pdfBuffer = await convertDocxToPdfWithIlovePdf({
      docxBuffer: docxResult.buffer,
      fileName: docxResult.fileName
    });
    const fileName = `${buildExportBaseName(candidateName, companyName)}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "X-PDF-Engine": "ilovepdf-officepdf",
        "X-Template-Preserved": String(docxResult.preservedTemplate)
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to export exact PDF.";
    const status =
      /ILOVEPDF_|ILOVEAPI_|valid iLoveAPI|public site key|auth failed/i.test(message) ? 409 : 400;
    return NextResponse.json(
      {
        error: message
      },
      { status }
    );
  }
}
