import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

const AI_SERVICE = process.env.AI_SERVICE_URL ?? "http://localhost:8000";

// Headers needed for ngrok free tier (bypasses browser warning page)
const NGROK_HEADERS: Record<string, string> = AI_SERVICE.includes("ngrok")
  ? { "ngrok-skip-browser-warning": "1" }
  : {};

export const maxDuration = 300; // 5 min timeout for GPU inference

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Forward the multipart form data directly to the AI service
  const formData = await req.formData();

  const res = await fetch(`${AI_SERVICE}/ocr/document`, {
    method: "POST",
    headers: {
      "ngrok-skip-browser-warning": "1",
      "User-Agent": "MedXplain/1.0",
    },
    body: formData,
    signal: AbortSignal.timeout(300_000),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: err || "OCR service error" }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json(data);
}

export async function GET() {
  // Health check — ping the OCR service
  try {
    const res = await fetch(`${AI_SERVICE}/ocr/health`, {
      headers: {
        "ngrok-skip-browser-warning": "1",
        "User-Agent": "MedXplain/1.0",
      },
      signal: AbortSignal.timeout(10_000),
    });
    const data = await res.json();
    return NextResponse.json({ available: true, ...data });
  } catch (e: any) {
    return NextResponse.json({ available: false, error: e?.message ?? "OCR service unreachable" });
  }
}
