import { NextRequest, NextResponse } from "next/server";

const LOCAL_AI_SERVICE = process.env.LOCAL_AI_SERVICE_URL ?? "http://localhost:8000";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const res = await fetch(`${LOCAL_AI_SERVICE}/summarization/amharic`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      return NextResponse.json({ error: err || "Amharic summarization failed" }, { status: res.status });
    }

    return NextResponse.json(await res.json());
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Amharic summarization failed" }, { status: 500 });
  }
}
