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

function pickBearerToken(tokenPayload: any) {
  return (
    tokenPayload?.access?.token ||
    tokenPayload?.token?.access?.token ||
    tokenPayload?.accessToken ||
    tokenPayload?.token ||
    ""
  );
}

function pickTokenExpiry(tokenPayload: any) {
  return (
    tokenPayload?.access?.expires ||
    tokenPayload?.token?.access?.expires ||
    tokenPayload?.expiresAt ||
    ""
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as { googleCode?: string };
    const googleCode = String(body.googleCode || "").trim();

    if (!googleCode) {
      return NextResponse.json({ error: "Missing Google authorization code." }, { status: 400 });
    }

    const response = await fetch(`${COACH_AUTH_BASE_URL}/student-google-login`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ googleCode })
    });
    const payload = await readJsonSafe(response);
    const data = payload?.Data || {};
    const user = data.user || {};
    const bearerToken = pickBearerToken(data.token);
    const userUuid = user.uuid || user.id || data.userUuid || "";

    if (!response.ok || payload?.IsSuccess === false || !bearerToken || !userUuid) {
      return NextResponse.json(
        {
          error:
            payload?.message ||
            payload?.error ||
            "Coach Google login failed. Use the same Google account registered on Coach LMS."
        },
        { status: response.status || 400 }
      );
    }

    return NextResponse.json({
      coachApiToken: bearerToken,
      coachUserUuid: userUuid,
      tokenExpiresAt: pickTokenExpiry(data.token),
      coachEmail: user.officialEmail || user.email || "",
      name: [user.firstName, user.lastName].filter(Boolean).join(" ").trim(),
      mobileNumber: user.mobileNumber || user.officialNumber || "",
      countryCode: user.countryCode || "+91"
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Coach Google login failed." },
      { status: 400 }
    );
  }
}
