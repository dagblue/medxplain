import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

const AI_SERVICE = process.env.AI_SERVICE_URL ?? "http://localhost:8000";

/**
 * POST /api/ai/summarization
 * Proxies to the Python AI microservice → /summarization
 * Connects to: SUMMARAZATION/checkpoint-115620/ (BartForConditionalGeneration)
 *
 * Body: { text: string, max_length?: number, min_length?: number, num_beams?: number }
 * Returns: { summary_en: string, summary_am: null, model, device, note }
 *
 * NOTE: Amharic summarization is NOT yet enabled. Only English output is returned.
 */
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body.text?.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  try {
    const res = await fetch(`${AI_SERVICE}/summarization`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: body.text,
        max_length: body.max_length ?? 128,
        min_length: body.min_length ?? 30,
        num_beams: body.num_beams ?? 4,
      }),
      signal: AbortSignal.timeout(60_000), // 60s — BART can be slow on CPU
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "AI service error" }));
      return NextResponse.json(
        { error: err.detail ?? "Summarization service failed" },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    if (err.name === "TimeoutError") {
      return NextResponse.json({ error: "Summarization timed out — text may be too long" }, { status: 504 });
    }
    if (err.code === "ECONNREFUSED" || err.cause?.code === "ECONNREFUSED") {
      return NextResponse.json(
        {
          error: "AI service is not running",
          hint: "Start it with: cd medxplain/ai_service && uvicorn main:app --port 8000",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: err.message ?? "Unknown error" }, { status: 500 });
  }
}
