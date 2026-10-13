import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export const maxDuration = 30;

/**
 * Translate text to English using Google Translate (unofficial free API).
 * Works for Amharic (am) → English (en).
 */
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { text } = await req.json();
    if (!text?.trim()) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    // Google Translate unofficial API — free, no key needed
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=am&tl=en&dt=t&q=${encodeURIComponent(text)}`;

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      throw new Error(`Translation service returned ${res.status}`);
    }

    const data = await res.json();

    // Google Translate response format:
    // [[["translated", "original", null, null, 1]], ...]
    const translated = data[0]
      ?.map((chunk: any) => chunk[0])
      .filter(Boolean)
      .join("") ?? "";

    if (!translated) {
      return NextResponse.json({ error: "Empty translation result" }, { status: 500 });
    }

    return NextResponse.json({ translation: translated, source: "am", target: "en" });

  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Translation failed" }, { status: 500 });
  }
}
