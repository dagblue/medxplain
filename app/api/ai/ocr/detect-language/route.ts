import { NextRequest, NextResponse } from "next/server";

const AI_SERVICE = process.env.AI_SERVICE_URL ?? "http://localhost:8000";

const SERVICE_HEADERS: Record<string, string> = AI_SERVICE.includes("ngrok")
  ? { "ngrok-skip-browser-warning": "1", "User-Agent": "MedXplain/1.0", "Content-Type": "application/json" }
  : { "Content-Type": "application/json" };

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text: string = body.text ?? "";

    // Fast local detection using Unicode ratio — no external service needed
    const ethiopicPattern = /[\u1200-\u137F\u1380-\u139F\u2D80-\u2DDF]/g;
    const ethiopicChars = (text.match(ethiopicPattern) ?? []).length;
    const alphaChars = (text.match(/[a-zA-Z\u1200-\u137F]/g) ?? []).length;
    const ethiopicRatio = alphaChars > 0 ? ethiopicChars / alphaChars : 0;

    const isAmharic = ethiopicRatio >= 0.1;

    // Try the AI service for more accurate detection if available
    try {
      const res = await fetch(`${AI_SERVICE}/ocr/detect-language`, {
        method: "POST",
        headers: SERVICE_HEADERS,
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        return NextResponse.json(await res.json());
      }
    } catch {
      // AI service unavailable — use local detection
    }

    // Local fallback result
    return NextResponse.json({
      language: isAmharic ? "am" : "en",
      is_amharic: isAmharic,
      is_english: !isAmharic,
      ethiopic_ratio: Math.round(ethiopicRatio * 1000) / 1000,
      confidence: isAmharic ? 0.95 : 0.85,
      method: "unicode_ratio_local",
    });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
