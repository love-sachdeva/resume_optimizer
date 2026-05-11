import { NextResponse } from "next/server";

import { buildStyledPdfFromLayout } from "@/lib/export/layout";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    let exportText = "";
    let candidateName = "candidate";
    let companyName = "company";

    if (contentType.includes("application/json")) {
      const body = await request.json().catch(() => ({}));
      exportText = String(body.exportText ?? "");
      candidateName = String(body.candidateName ?? "candidate");
      companyName = String(body.companyName ?? "company");
    } else if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      exportText = String(formData.get("exportText") ?? "");
      candidateName = String(formData.get("candidateName") ?? "candidate");
      companyName = String(formData.get("companyName") ?? "company");
    }

    if (!exportText.trim()) {
      return NextResponse.json({ error: "Missing resume text for PDF export." }, { status: 400 });
    }

    const result = await buildStyledPdfFromLayout({
      exportText,
      candidateName,
      companyName
    });

    return new NextResponse(new Uint8Array(result.buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${result.fileName}"`
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to export PDF."
      },
      { status: 400 }
    );
  }
}
