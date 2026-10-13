import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

const DIGITIZATION_SERVICE = process.env.DIGITIZATION_SERVICE_URL ?? "http://localhost:8001";

const SERVICE_HEADERS: Record<string, string> = DIGITIZATION_SERVICE.includes("ngrok")
  ? { "ngrok-skip-browser-warning": "1", "User-Agent": "MedXplain/1.0" }
  : {};

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!["ADMIN", "RECEPTIONIST"].includes(session.user.role as string)) {
    return NextResponse.json({ error: "Only receptionists can digitize forms" }, { status: 403 });
  }

  const formData = await req.formData();

  // Forward to GPU service
  const res = await fetch(`${DIGITIZATION_SERVICE}/digitize/form`, {
    method: "POST",
    headers: { ...SERVICE_HEADERS },
    body: formData,
    signal: AbortSignal.timeout(300_000),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    return NextResponse.json(
      { error: err || `Digitization service error (${res.status})` },
      { status: res.status }
    );
  }

  return NextResponse.json(await res.json());
}

export async function GET() {
  try {
    const res = await fetch(`${DIGITIZATION_SERVICE}/digitize/health`, {
      headers: { ...SERVICE_HEADERS },
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json();
    return NextResponse.json({ available: true, ...data });
  } catch {
    return NextResponse.json({ available: false, error: "Digitization service unreachable" });
  }
}
