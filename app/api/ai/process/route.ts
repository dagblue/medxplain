import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

// Single GPU server handles OCR, NER, assertion, and summarization
const AI_SERVICE = process.env.AI_SERVICE_URL ?? "http://localhost:8000";

// Disable Next.js default 30s route timeout — GPU inference can still take time
export const maxDuration = 300; // 5 minutes

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const type    = (formData.get("type") as string) ?? "clinical_note";
  const ocrText = (formData.get("ocrText") as string) ?? "";

  if (!ocrText.trim()) {
    return NextResponse.json({ error: "No text to process" }, { status: 400 });
  }

  // Single call to /pipeline — NER + Assertion + Summarization on GPU
  const res = await fetch(`${AI_SERVICE}/pipeline`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: ocrText }),
    signal: AbortSignal.timeout(270_000),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Pipeline failed" }));
    return NextResponse.json(
      { error: err.detail ?? "AI pipeline failed" },
      { status: res.status }
    );
  }

  const data = await res.json();

  return NextResponse.json({
    success:     true,
    type,
    source:      "gpu_server",
    processedAt: new Date().toISOString(),
    ocrText,
    entities: (data.entities ?? []).map((e: any) => ({
      ...e,
      confidence: e.score,
    })),
    validated: data.validated
      ? {
          status:            data.validated.overall_status,
          overall_status:    data.validated.overall_status,
          summary:           data.validated.summary,
          present_count:     data.validated.present_count    ?? 0,
          absent_count:      data.validated.absent_count      ?? 0,
          possible_count:    data.validated.possible_count    ?? 0,
          historical_count:  data.validated.historical_count  ?? 0,
          // Normalize assertion_label to lowercase only — keep historical as-is
          entity_assertions: (data.validated.entity_assertions ?? []).map((ea: any) => ({
            ...ea,
            assertion_label: ea.assertion_label.toLowerCase(),
          })),
          flags:             [],
          drugInteractions:  [],
          contradictions:    [],
        }
      : null,
    summary_en: data.summary_en ?? null,
    summary_am: null,
    models: {
      ner: {
        status:       "completed",
        checkpoint:   data.models?.ner?.checkpoint   ?? "checkpoint-48561",
        chunks:       data.models?.ner?.chunks        ?? 1,
        total_tokens: data.models?.ner?.total_tokens  ?? 0,
        device:       data.device,
      },
      assertion: {
        status:     "completed",
        checkpoint: data.models?.assertion?.checkpoint ?? "checkpoint-13657",
        device:     data.device,
      },
      summarization: {
        status:     "completed",
        checkpoint: data.models?.summarization?.checkpoint ?? "checkpoint-115620",
        device:     data.device,
      },
    },
  });
}
