import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await request.json();
    return NextResponse.json(
      {
        error:
          "PDF export is disabled in this build because there is no exact DOCX-to-PDF converter installed on the server."
      },
      { status: 409 }
    );
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
