import { NextResponse } from "next/server";

import { extractTextFromFile } from "@/lib/parsing/extract-text";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("resumeFile");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Upload a resume file to parse." }, { status: 400 });
    }

    const text = await extractTextFromFile(file);
    return NextResponse.json({ text });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to parse resume."
      },
      { status: 400 }
    );
  }
}
