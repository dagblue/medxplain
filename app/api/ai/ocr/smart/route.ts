import { NextRequest, NextResponse } from "next/server";

const AI_SERVICE = process.env.AI_SERVICE_URL ?? "http://localhost:8000";
const LOCAL_AI_SERVICE = process.env.LOCAL_AI_SERVICE_URL ?? "http://localhost:8000";

const GPU_HEADERS: Record<string, string> = AI_SERVICE.includes("ngrok")
  ? { "ngrok-skip-browser-warning": "1", "User-Agent": "MedXplain/1.0" }
  : {};

export const maxDuration = 300;

const ETHIOPIC = /[\u1200-\u137F\u1380-\u139F]/;

function hasEthiopic(text: string): boolean {
  return ETHIOPIC.test(text);
}

function isReadableEnglish(text: string): boolean {
  if (!text || text.trim().length < 10) return false;
  // Count real English words (3+ letter sequences)
  const words = text.match(/[a-zA-Z]{3,}/g) ?? [];
  const totalChars = text.replace(/\s/g, "").length;
  if (totalChars === 0) return false;
  // If >40% of content is recognizable English words → it's English
  const wordChars = words.join("").length;
  return wordChars / totalChars > 0.4;
}

/**
 * Smart OCR endpoint:
 * 1. Try Tesseract (local, fast) first
 * 2. If Tesseract gets readable English text → return it (language: en)
 * 3. If Tesseract gets garbage/empty OR text has Ethiopic chars → use Amharic TrOCR (GPU)
 * 4. Return text + detected language
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    // ── Step 1: Try Tesseract (local) ──────────────────────────────────────
    let tesseractText = "";
    let tesseractOk = false;

    try {
      const tessForm = new FormData();
      tessForm.append("file", file);

      const tessRes = await fetch(`${LOCAL_AI_SERVICE}/ocr/english`, {
        method: "POST",
        body: tessForm,
        signal: AbortSignal.timeout(20_000),
      });

      if (tessRes.ok) {
        const data = await tessRes.json();
        tesseractText = data.text ?? "";
        tesseractOk = true;
      }
    } catch {
      // Tesseract unavailable — skip to Amharic
    }

    // ── Step 2: Decide based on Tesseract output ───────────────────────────
    const hasEth = hasEthiopic(tesseractText);
    const goodEnglish = isReadableEnglish(tesseractText) && !hasEth;

    if (tesseractOk && goodEnglish) {
      // Confident English — return Tesseract result, skip GPU entirely
      return NextResponse.json({
        text: tesseractText,
        engine: "tesseract",
        language: { language: "en", is_amharic: false, is_english: true, method: "tesseract_confidence" },
      });
    }

    // If Tesseract ran but got Ethiopic chars → definitely Amharic → use GPU
    // If Tesseract failed → assume Amharic (safer default)
    // Either way: send to Amharic TrOCR on GPU
    const amForm = new FormData();
    amForm.append("file", file);
    amForm.append("return_lines", "false");

    const amRes = await fetch(`${AI_SERVICE}/ocr/document`, {
      method: "POST",
      headers: { ...GPU_HEADERS },
      body: amForm,
      signal: AbortSignal.timeout(300_000),
    });

    if (!amRes.ok) {
      const err = await amRes.text().catch(() => "");
      if (err.includes("CUDA") || err.includes("500") || amRes.status === 500) {
        return NextResponse.json({
          error: "GPU OCR failed (CUDA error). The image may be English — try typing the text directly.",
          cuda_error: true,
        }, { status: 503 });
      }
      return NextResponse.json({ error: err || "OCR failed" }, { status: amRes.status });
    }

    const amData = await amRes.json();
    const amText = amData.text ?? "";

    // Final language check on the Amharic OCR output
    const finalHasEth = hasEthiopic(amText);

    return NextResponse.json({
      text: amText,
      engine: "trocr_amharic",
      line_results: amData.line_results ?? [],
      line_count: amData.line_count ?? 0,
      confidence: amData.confidence ?? {},
      language: {
        language: finalHasEth ? "am" : "en",
        is_amharic: finalHasEth || !goodEnglish,
        is_english: !finalHasEth && goodEnglish,
        method: "trocr_unicode_check",
      },
    });

  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Smart OCR failed" }, { status: 500 });
  }
}
