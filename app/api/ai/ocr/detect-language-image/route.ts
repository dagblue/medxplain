import { NextRequest, NextResponse } from "next/server";

const AI_SERVICE = process.env.AI_SERVICE_URL ?? "http://localhost:8000";

const SERVICE_HEADERS: Record<string, string> = AI_SERVICE.includes("ngrok")
  ? { "ngrok-skip-browser-warning": "1", "User-Agent": "MedXplain/1.0" }
  : {};

/**
 * Detect language from an image BEFORE running OCR.
 * Uses Tesseract (local) for a quick English pre-scan,
 * then checks the Unicode ratio of the result.
 *
 * If Tesseract is unavailable, falls back to assuming Amharic
 * (safer — Amharic TrOCR won't hallucinate on Amharic docs).
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    // Try the local AI service /ocr/smart endpoint which does Tesseract pre-detection
    try {
      const res = await fetch(`${AI_SERVICE}/ocr/smart`, {
        method: "POST",
        headers: { ...SERVICE_HEADERS },
        body: formData,
        signal: AbortSignal.timeout(15_000), // quick timeout — just for detection
      });

      if (res.ok) {
        const data = await res.json();
        return NextResponse.json(data.language ?? { is_amharic: true, language: "am" });
      }
    } catch {
      // Local service unavailable
    }

    // Fallback: try the GPU service detect via quick Tesseract
    // Since GPU service doesn't have Tesseract, use Unicode ratio on a small
    // portion of the image via the GPU /ocr/document with max_lines=2
    try {
      const quickForm = new FormData();
      const file = formData.get("file") as File;
      if (file) {
        quickForm.append("file", file);
        quickForm.append("return_lines", "true");

        const res = await fetch(`${AI_SERVICE}/ocr/document`, {
          method: "POST",
          headers: { ...SERVICE_HEADERS },
          body: quickForm,
          signal: AbortSignal.timeout(60_000),
        });

        if (res.ok) {
          const data = await res.json();
          const text = data.text ?? "";
          // Check Unicode ratio
          const ethiopicChars = (text.match(/[\u1200-\u137F]/g) ?? []).length;
          const alphaChars = (text.match(/[a-zA-Z\u1200-\u137F]/g) ?? []).length;
          const ratio = alphaChars > 0 ? ethiopicChars / alphaChars : 0;
          const isAmharic = ratio >= 0.1;
          return NextResponse.json({
            is_amharic: isAmharic,
            is_english: !isAmharic,
            language: isAmharic ? "am" : "en",
            ethiopic_ratio: Math.round(ratio * 1000) / 1000,
            method: "trocr_unicode_ratio",
          });
        }
      }
    } catch {
      // GPU service unavailable
    }

    // Final fallback — assume Amharic (safer default)
    return NextResponse.json({
      is_amharic: true,
      is_english: false,
      language: "am",
      ethiopic_ratio: 1.0,
      method: "fallback_assume_amharic",
    });

  } catch (e: any) {
    return NextResponse.json({ is_amharic: true, language: "am", error: e.message }, { status: 200 });
  }
}
