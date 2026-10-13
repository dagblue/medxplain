import { cn } from "@/lib/utils";
import { Loader2, CheckCircle, XCircle, Minus, Wifi, WifiOff } from "lucide-react";

export type AIStatus =
  | "idle"
  | "uploading"
  | "ner_processing"
  | "assertion_processing"
  | "summarization_processing"
  | "completed"
  | "error";

const CONFIG: Record<AIStatus, { label: string; color: string; icon: React.ReactNode }> = {
  idle: { label: "Ready", color: "bg-gray-100 text-gray-600 border-gray-200", icon: <Minus className="w-3 h-3" /> },
  uploading: { label: "Uploading...", color: "bg-blue-100 text-blue-700 border-blue-200", icon: <Loader2 className="w-3 h-3 animate-spin" /> },
  ner_processing: { label: "NER Processing...", color: "bg-indigo-100 text-indigo-700 border-indigo-200", icon: <Loader2 className="w-3 h-3 animate-spin" /> },
  assertion_processing: { label: "Assertion Check...", color: "bg-purple-100 text-purple-700 border-purple-200", icon: <Loader2 className="w-3 h-3 animate-spin" /> },
  summarization_processing: { label: "Summarizing...", color: "bg-violet-100 text-violet-700 border-violet-200", icon: <Loader2 className="w-3 h-3 animate-spin" /> },
  completed: { label: "Analysis Complete", color: "bg-green-100 text-green-700 border-green-200", icon: <CheckCircle className="w-3 h-3" /> },
  error: { label: "Failed", color: "bg-red-100 text-red-700 border-red-200", icon: <XCircle className="w-3 h-3" /> },
};

export function AIStatusBadge({ status, className }: { status: AIStatus; className?: string }) {
  const cfg = CONFIG[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border", cfg.color, className)}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// ── Service status indicator ──────────────────────────────────────────────────
export function ServiceStatusBadge({ online }: { online: boolean | null }) {
  if (online === null) return null;
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold",
      online ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
    )}>
      {online ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
      {online ? "AI Service Online" : "AI Service Offline (mock)"}
    </span>
  );
}

// ── Pipeline step row ─────────────────────────────────────────────────────────
type StepState = "waiting" | "running" | "done" | "skipped";

const STEP_MODELS = [
  { key: "ocr",           name: "OCR",           model: "TrOCR / Tesseract",                                    lang: ["EN", "AM"], color: "text-cyan-600"   },
  { key: "ner",           name: "NER",           model: "BertForTokenClassification · checkpoint-48561",        lang: ["EN"],       color: "text-indigo-600" },
  { key: "assertion",     name: "Assertion",     model: "BertForSequenceClassification · checkpoint-13657",     lang: ["EN"],       color: "text-purple-600" },
  { key: "summarization", name: "Summarization", model: "BartForConditionalGeneration · checkpoint-115620",     lang: ["EN"],       color: "text-violet-600" },
];

export function PipelineProgress({ steps, chunkInfo }: { steps: Record<string, StepState>; chunkInfo?: { ner?: number; summarization?: number } }) {
  return (
    <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100 space-y-1">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">AI Pipeline — GPU Server</p>
      {STEP_MODELS.map((s) => {
        const state = steps[s.key] ?? "waiting";
        const chunks = s.key === "ner" ? chunkInfo?.ner : s.key === "summarization" ? chunkInfo?.summarization : undefined;
        return (
          <div key={s.key} className="flex items-center gap-2.5 py-1">
            <div className="w-4 flex-shrink-0 flex items-center justify-center">
              {state === "waiting" && <div className="w-3 h-3 rounded-full border-2 border-gray-300" />}
              {state === "running" && <Loader2 className={cn("w-3.5 h-3.5 animate-spin", s.color)} />}
              {state === "done" && <CheckCircle className="w-3.5 h-3.5 text-green-500" />}
              {state === "skipped" && <Minus className="w-3 h-3 text-gray-300" />}
            </div>
            <div className="flex-1 min-w-0">
              <span className={cn("text-xs font-semibold", state === "running" ? s.color : state === "done" ? "text-green-700" : "text-gray-400")}>
                {s.name}
              </span>
              <span className="text-xs text-gray-400 ml-1.5 truncate hidden sm:inline">{s.model}</span>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/* Show chunk count badge when chunking was used */}
              {state === "done" && chunks && chunks > 1 && (
                <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-semibold">
                  {chunks} chunks
                </span>
              )}
              <div className="flex gap-1">
                {s.lang.map((l) => (
                  <span key={l} className={cn(
                    "text-xs px-1.5 py-0.5 rounded font-mono",
                    l === "AM" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-500"
                  )}>{l}</span>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
