import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

const AI_SERVICE = process.env.AI_SERVICE_URL ?? "http://localhost:8000";

/**
 * POST /api/ai/ner
 * Proxies to the Python AI microservice → /ner
 * Connects to: NER/checkpoint-48561/ (BertForTokenClassification)
 *
 * Body: { text: string }
 * Returns: { entities: [{ text, label, score, start, end }], model, device }
 */
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body.text?.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  try {
    const res = await fetch(`${AI_SERVICE}/ner`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: body.text }),
      signal: AbortSignal.timeout(30_000), // 30s timeout
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "AI service error" }));
      return NextResponse.json(
        { error: err.detail ?? "NER service failed" },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    if (err.name === "TimeoutError") {
      return NextResponse.json({ error: "NER service timed out" }, { status: 504 });
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
