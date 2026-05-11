import { NextResponse } from "next/server";

export const runtime = "nodejs";

const COACH_AUTH_BASE_URL = "https://api.mastersunion.in/api/v1/auth";

async function readJsonSafe(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export async function GET() {
  try {
    const response = await fetch(`${COACH_AUTH_BASE_URL}/get-google-credentials`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 * 60 }
    });
    const payload = await readJsonSafe(response);
    const clientId = payload?.Data?.configuration?.apiKey || "";

    if (!response.ok || !clientId) {
      return NextResponse.json(
        { error: payload?.message || "Coach Google configuration is unavailable." },
        { status: response.status || 400 }
      );
    }

    return NextResponse.json({ clientId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Coach Google configuration failed." },
      { status: 400 }
    );
  }
}
