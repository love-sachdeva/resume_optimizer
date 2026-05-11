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

function cleanMobileNumber(value: unknown) {
  return String(value ?? "").replace(/[^\d]/g, "");
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as {
      mobileNumber?: string;
      countryCode?: string;
    };
    const mobileNumber = cleanMobileNumber(body.mobileNumber);
    const countryCode = String(body.countryCode || "+91").trim() || "+91";

    if (!mobileNumber || mobileNumber.length < 8) {
      return NextResponse.json(
        { error: "Enter the mobile number registered on Coach LMS." },
        { status: 400 }
      );
    }

    const response = await fetch(`${COACH_AUTH_BASE_URL}/studentLoginOtp`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ mobileNumber, countryCode })
    });
    const payload = await readJsonSafe(response);

    if (!response.ok || payload?.IsSuccess === false) {
      return NextResponse.json(
        {
          error:
            payload?.message ||
            payload?.error ||
            `Coach OTP request failed with status ${response.status}.`
        },
        { status: response.status || 400 }
      );
    }

    return NextResponse.json({
      message: payload?.message || "OTP sent successfully.",
      mobileNumber,
      countryCode,
      maskedDestination: payload?.Data?.officialEmail || payload?.Data?.mobileNumber || mobileNumber
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Coach OTP request failed." },
      { status: 400 }
    );
  }
}
