import { NextResponse } from "next/server";

const AI_SERVICE = process.env.AI_SERVICE_URL ?? "http://localhost:8000";

const SERVICE_HEADERS: Record<string, string> = AI_SERVICE.includes("ngrok")
  ? { "ngrok-skip-browser-warning": "1", "User-Agent": "MedXplain/1.0" }
  : {};

export async function GET() {
  try {
    const res = await fetch(`${AI_SERVICE}/health`, {
      headers: SERVICE_HEADERS,
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json({ online: true, ...data });
    }

    return NextResponse.json({ online: false }, { status: 200 });
  } catch {
    return NextResponse.json({ online: false }, { status: 200 });
  }
}
