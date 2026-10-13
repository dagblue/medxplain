import { NextRequest, NextResponse } from "next/server";

const AI_SERVICE = process.env.AI_SERVICE_URL ?? "http://localhost:8000";
// English OCR uses local Tesseract — not the GPU server
const LOCAL_AI_SERVICE = process.env.LOCAL_AI_SERVICE_URL ?? "http://localhost:8000";

const SERVICE_HEADERS: Record<string, string> = AI_SERVICE.includes("ngrok")
  ? { "ngrok-skip-browser-warning": "1", "User-Agent": "MedXplain/1.0" }
  : {};

export const maxDuration = 60;

/**
 * English OCR via Tesseract (local AI service).
 * Fast, accurate for printed English clinical documents.
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const res = await fetch(`${LOCAL_AI_SERVICE}/ocr/english`, {
      method: "POST",
      // No ngrok headers needed — local service
      body: formData,
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      return NextResponse.json(
        { error: err || "English OCR failed" },
        { status: res.status }
      );
    }

    return NextResponse.json(await res.json());

  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "English OCR failed" }, { status: 500 });
  }
}
