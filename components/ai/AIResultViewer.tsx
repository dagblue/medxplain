"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  FileText, Tag, ShieldCheck, Languages,
  AlertTriangle, Info, AlertCircle, CheckCircle,
  Copy, Check, ChevronDown,
} from "lucide-react";

interface AIResult {
  ocrText?: string;
  entities?: { text: string; label: string; score?: number; confidence?: number }[];
  validated?: {
    status: string;
    overall_status?: string;
    summary?: string;
    present_count?: number;
    absent_count?: number;
    possible_count?: number;
    historical_count?: number;
    entity_assertions?: {
      entity_text: string;
      entity_label: string;
      ner_score: number;
      assertion_label: "present" | "absent" | "possible" | "historical";
      assertion_score: number;
      all_scores: { present: number; absent: number; possible: number; historical: number };
      context_sentence: string;
    }[];
    // legacy
    flags?: { type: string; message: string; severity: "low" | "medium" | "high" }[];
    drugInteractions?: { drugs: string[]; interaction: string; severity: string }[];
    entityContext?: { text: string; label: string; nerScore: number }[];
  };
  summary_en?: string;
  summary_am?: string;
  autoFill?: Record<string, string>;
  models?: Record<string, any>;
  processedAt?: string;
  source?: string;
}

interface AIResultViewerProps {
  result: AIResult;
  onAutoFill?: (data: Record<string, string>) => void;
}

const TABS = [
  { key: "ocr", label: "OCR Output", icon: FileText },
  { key: "ner", label: "NER Entities", icon: Tag },
  { key: "assertion", label: "Assertion", icon: ShieldCheck },
  { key: "summary", label: "Summary", icon: Languages },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const ENTITY_COLORS: Record<string, string> = {
  // Real model labels (BIO format)
  "B-Disease": "bg-red-100 text-red-700 border-red-200",
  "I-Disease": "bg-red-50 text-red-600 border-red-100",
  "B-Symptom": "bg-orange-100 text-orange-700 border-orange-200",
  "I-Symptom": "bg-orange-50 text-orange-600 border-orange-100",
  "B-Medication": "bg-green-100 text-green-700 border-green-200",
  "I-Medication": "bg-green-50 text-green-600 border-green-100",
  "B-Lab_Result": "bg-violet-100 text-violet-700 border-violet-200",
  "I-Lab_Result": "bg-violet-50 text-violet-600 border-violet-100",
  // Normalized (without B-/I- prefix)
  Disease: "bg-red-100 text-red-700 border-red-200",
  Symptom: "bg-orange-100 text-orange-700 border-orange-200",
  Medication: "bg-green-100 text-green-700 border-green-200",
  Lab_Result: "bg-violet-100 text-violet-700 border-violet-200",
  // Legacy / mock labels
  SYMPTOM: "bg-orange-100 text-orange-700 border-orange-200",
  CONDITION: "bg-red-100 text-red-700 border-red-200",
  MEDICATION: "bg-green-100 text-green-700 border-green-200",
  VITAL_SIGN: "bg-blue-100 text-blue-700 border-blue-200",
  PROCEDURE: "bg-purple-100 text-purple-700 border-purple-200",
  FINDING: "bg-yellow-100 text-yellow-700 border-yellow-200",
  LAB_VALUE: "bg-violet-100 text-violet-700 border-violet-200",
  PHYSICIAN: "bg-cyan-100 text-cyan-700 border-cyan-200",
  PERSON_NAME: "bg-indigo-100 text-indigo-700 border-indigo-200",
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function TranslateButton({ text, onTranslated }: { text: string; onTranslated: (t: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [translated, setTranslated] = useState(false);

  const handleTranslate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      onTranslated(data.translation || "Translation unavailable");
      setTranslated(true);
    } catch {
      onTranslated("Translation failed — try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleTranslate}
      disabled={loading || translated}
      className={cn(
        "flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-colors",
        translated
          ? "bg-green-50 text-green-600 cursor-default"
          : "bg-blue-50 hover:bg-blue-100 text-blue-600"
      )}
    >
      {loading ? "Translating..." : translated ? "🇬🇧 Translated" : "🇬🇧 Translate to English"}
    </button>
  );
}

// ── AssertionTab — per-entity visualization ───────────────────────────────────

const ASSERTION_CONFIG = {
  present: {
    label: "Present",
    color: "bg-green-100 text-green-700 border-green-200",
    dot: "bg-green-500",
    bar: "bg-green-500",
    row: "bg-green-50/50",
  },
  absent: {
    label: "Absent",
    color: "bg-red-100 text-red-700 border-red-200",
    dot: "bg-red-500",
    bar: "bg-red-500",
    row: "bg-red-50/50",
  },
  historical: {
    label: "Historical",
    color: "bg-purple-100 text-purple-700 border-purple-200",
    dot: "bg-purple-500",
    bar: "bg-purple-500",
    row: "bg-purple-50/50",
  },
  possible: {
    label: "Possible",
    color: "bg-yellow-100 text-yellow-700 border-yellow-200",
    dot: "bg-yellow-500",
    bar: "bg-yellow-500",
    row: "bg-yellow-50/30",
  },
};

function AssertionTab({ validated }: { validated: AIResult["validated"] }) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  if (!validated) return <p className="text-sm text-gray-400 italic">No assertion data</p>;

  const assertions = [...(validated.entity_assertions ?? [])].sort(
    (a, b) => b.assertion_score - a.assertion_score
  );
  const overallStatus = (validated.overall_status ?? validated.status ?? "PASS").toUpperCase();
  const statusColor = overallStatus === "PASS"
    ? "bg-green-50 border-green-200 text-green-700"
    : "bg-yellow-50 border-yellow-200 text-yellow-700";

  return (
    <div className="space-y-4">
      {/* ── Overall status banner ── */}
      <div className={cn("flex items-center gap-3 p-3 rounded-xl border", statusColor)}>
        {overallStatus === "PASS"
          ? <CheckCircle className="w-5 h-5 flex-shrink-0" />
          : <AlertTriangle className="w-5 h-5 flex-shrink-0" />}
        <div className="flex-1">
          <p className="text-sm font-bold">
            {overallStatus === "PASS" ? "All Entities Present" : "Review Required"}
          </p>
          {validated.summary && (
            <p className="text-xs opacity-70 mt-0.5">{validated.summary}</p>
          )}
        </div>
        {/* Count pills */}
        <div className="flex gap-1.5 flex-shrink-0">
          {(validated.present_count ?? 0) > 0 && (
            <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
              {validated.present_count} present
            </span>
          )}
          {(validated.absent_count ?? 0) > 0 && (
            <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
              {validated.absent_count} absent
            </span>
          )}
          {(validated.historical_count ?? 0) > 0 && (
            <span className="text-xs font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
              {validated.historical_count} historical
            </span>
          )}
          {(validated.possible_count ?? 0) > 0 && (
            <span className="text-xs font-bold bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
              {validated.possible_count} possible
            </span>
          )}
        </div>
      </div>

      {/* ── Per-entity assertion table ── */}
      {assertions.length === 0 ? (
        <p className="text-sm text-gray-400 italic">No entities to assert on</p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Per-Entity Assertion ({assertions.length} entities)
          </p>
          <div className="rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-100">
            {assertions.map((ea, i) => {
              const normalizedLabel = ea.assertion_label.toLowerCase() as keyof typeof ASSERTION_CONFIG;
              const cfg = ASSERTION_CONFIG[normalizedLabel] ?? ASSERTION_CONFIG.present;
              const isExpanded = expandedIdx === i;
              const pct = Math.round(ea.assertion_score * 100);

              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={cn("transition-colors", cfg.row)}
                >
                  {/* Main row */}
                  <button
                    onClick={() => setExpandedIdx(isExpanded ? null : i)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-black/5 transition-colors"
                  >
                    {/* Assertion label badge */}
                    <span className={cn(
                      "text-xs font-bold px-2.5 py-1 rounded-full border flex-shrink-0 min-w-[68px] text-center",
                      cfg.color
                    )}>
                      {cfg.label}
                    </span>

                    {/* Entity type + text */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={cn(
                          "text-xs font-semibold px-1.5 py-0.5 rounded border flex-shrink-0",
                          ENTITY_COLORS[`B-${ea.entity_label}`] ?? ENTITY_COLORS[ea.entity_label.toUpperCase()] ?? "bg-gray-100 text-gray-600 border-gray-200"
                        )}>
                          {ea.entity_label.replace(/_/g, " ")}
                        </span>
                        <span className="text-sm font-semibold text-gray-900 truncate">
                          {ea.entity_text}
                        </span>
                      </div>
                    </div>

                    {/* Assertion confidence bar */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ delay: i * 0.05 + 0.2, duration: 0.5 }}
                          className={cn("h-full rounded-full", cfg.bar)}
                        />
                      </div>
                      <span className="text-xs font-bold tabular-nums w-8 text-right text-gray-600">
                        {pct}%
                      </span>
                      <ChevronDown className={cn(
                        "w-3.5 h-3.5 text-gray-400 transition-transform flex-shrink-0",
                        isExpanded && "rotate-180"
                      )} />
                    </div>
                  </button>

                  {/* Expanded detail */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 space-y-3">
                          {/* All 3 scores */}
                          <div className="grid grid-cols-4 gap-2">
                            {(["present", "absent", "historical", "possible"] as const).map((lbl) => {
                              const s = Math.round((ea.all_scores[lbl] ?? 0) * 100);
                              const c = ASSERTION_CONFIG[lbl];
                              const isWinner = ea.assertion_label.toLowerCase() === lbl;
                              return (
                                <div key={lbl} className={cn(
                                  "rounded-lg p-2 text-center border transition-all",
                                  isWinner ? cn(c.color, "ring-2 ring-offset-1 ring-current") : "bg-gray-50 border-gray-100 text-gray-500"
                                )}>
                                  <p className="text-xs font-bold capitalize">{lbl}</p>
                                  <p className="text-lg font-black tabular-nums">{s}%</p>
                                  <div className="w-full h-1.5 bg-black/10 rounded-full mt-1 overflow-hidden">
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ width: `${s}%` }}
                                      transition={{ duration: 0.4 }}
                                      className={cn("h-full rounded-full", isWinner ? "bg-current opacity-60" : "bg-gray-400 opacity-40")}
                                    />
                                  </div>
                                  {lbl === "possible" && (
                                    <p className="text-xs opacity-60 mt-0.5">uncertainty</p>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Absent warning — tell the user to review the context */}
                          {(ea.assertion_label === "absent" || ea.assertion_label === "historical") && (
                            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
                              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="text-xs font-bold text-red-700">
                                  {ea.assertion_label === "historical" ? "Entity marked HISTORICAL" : "Entity marked ABSENT"}
                                </p>
                                <p className="text-xs text-red-600 mt-0.5 leading-relaxed">
                                  {ea.assertion_label === "historical"
                                    ? "The model detected this entity as a past or historical condition — it was present before but is not an active current finding."
                                    : "The model detected this entity as negated or not present. The original text may contain phrases like \"no\", \"denies\", \"without\", or \"ruled out\"."}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Context sentence */}
                          <div className="bg-white rounded-lg border border-gray-100 p-3">
                            <p className="text-xs font-semibold text-gray-500 mb-1">Context sentence used</p>
                            <p className="text-xs text-gray-700 leading-relaxed italic">
                              "{ea.context_sentence}"
                            </p>
                          </div>

                          {/* NER score */}
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>NER confidence:</span>
                            <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-400 rounded-full"
                                style={{ width: `${Math.round(ea.ner_score * 100)}%` }} />
                            </div>
                            <span className="font-semibold text-blue-600">
                              {Math.round(ea.ner_score * 100)}%
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 flex items-center gap-1">
        <span className="w-2 h-2 bg-green-400 rounded-full inline-block" />
        BertForSequenceClassification · checkpoint-104652
        · Input: [CLS] entity [SEP] sentence_context [SEP]
        · Only entities ≥80% NER confidence
      </p>
    </div>
  );
}

export function AIResultViewer({ result, onAutoFill }: AIResultViewerProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("ocr");
  const [displayedOcrText, setDisplayedOcrText] = useState<string | undefined>(result.ocrText);
  // Track whether the user has translated — don't overwrite with original on re-render
  const translatedRef = useRef(false);

  // When a new result comes in (new upload), reset displayed text and translation state
  useEffect(() => {
    translatedRef.current = false;
    setDisplayedOcrText(result.ocrText);
  }, [result.ocrText, result.processedAt]);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-purple-50 to-blue-50">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-sm font-semibold text-gray-700">AI Analysis Results</span>
        </div>
        {result.processedAt && (
          <span className="text-xs text-gray-400">
            {new Date(result.processedAt).toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Auto-fill banner */}
      {result.autoFill && onAutoFill && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-5 mt-4 p-3 bg-blue-50 rounded-xl border border-blue-100 flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <p className="text-sm text-blue-700 font-medium">Patient data extracted — ready to auto-fill form</p>
          </div>
          <button
            onClick={() => onAutoFill(result.autoFill!)}
            className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-colors"
          >
            Auto-fill
          </button>
        </motion.div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-100 px-5 pt-4">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-colors mr-1",
              activeTab === tab.key
                ? "border-purple-500 text-purple-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
          >
            {/* OCR Output */}
            {activeTab === "ocr" && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Extracted Text</p>
                  <div className="flex items-center gap-1">
                    {result.ocrText && result.source?.includes("amharic") && (
                      <TranslateButton
                        key={result.processedAt}
                        text={result.ocrText}
                        onTranslated={(t) => {
                          translatedRef.current = true;
                          setDisplayedOcrText(t);
                        }}
                      />
                    )}
                    {displayedOcrText && <CopyButton text={displayedOcrText} />}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 font-mono text-sm text-gray-700 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
                  {displayedOcrText || <span className="text-gray-400 italic">No text extracted</span>}
                </div>
                <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                  <span className="w-2 h-2 bg-purple-400 rounded-full inline-block" />
                  MedOCR-v2 · English + Amharic
                </p>
              </div>
            )}

            {/* NER Entities */}
            {activeTab === "ner" && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Medical Entities ({result.entities?.length ?? 0} shown
                  <span className="font-normal text-gray-400"> · ≥80% confidence only</span>)
                  {result.models?.ner?.chunks > 1 && (
                    <span className="ml-2 text-purple-600 font-semibold bg-purple-50 px-2 py-0.5 rounded-full text-xs normal-case">
                      {result.models.ner.chunks} chunks
                    </span>
                  )}
                  {result.models?.ner?.total_tokens > 0 && (
                    <span className="ml-1.5 text-gray-400 font-normal text-xs normal-case">
                      · {result.models.ner.total_tokens} tokens
                    </span>
                  )}
                </p>
                {!result.entities?.length ? (
                  <p className="text-sm text-gray-400 italic">No entities extracted</p>
                ) : (
                  <div className="space-y-2">
                    {result.entities.map((entity, i) => {
                      // Support both real model (score) and mock (confidence)
                      const conf = entity.score ?? entity.confidence ?? 0;
                      const pct = Math.round(conf * 100);
                      // Clean label: strip B-/I- prefix for display
                      const displayLabel = entity.label
                        .replace(/^[BI]-/, "")
                        .replace(/_/g, " ");
                      const colorKey = entity.label in ENTITY_COLORS
                        ? entity.label
                        : displayLabel.replace(" ", "_").toUpperCase();

                      return (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.04 }}
                          className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100"
                        >
                          {/* Label badge */}
                          <span className={cn(
                            "text-xs font-bold px-2 py-0.5 rounded-full border flex-shrink-0 whitespace-nowrap",
                            ENTITY_COLORS[entity.label] ?? ENTITY_COLORS[colorKey] ?? "bg-gray-100 text-gray-600 border-gray-200"
                          )}>
                            {displayLabel}
                          </span>

                          {/* Entity text */}
                          <span className="text-sm text-gray-800 font-medium flex-1 min-w-0 truncate">
                            {entity.text}
                          </span>

                          {/* Confidence bar + % */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ delay: i * 0.04 + 0.2, duration: 0.5 }}
                                className={cn(
                                  "h-full rounded-full",
                                  pct >= 95 ? "bg-gradient-to-r from-green-500 to-emerald-400" :
                                  pct >= 80 ? "bg-gradient-to-r from-blue-500 to-cyan-400" :
                                  pct >= 60 ? "bg-gradient-to-r from-yellow-500 to-amber-400" :
                                  "bg-gradient-to-r from-red-400 to-orange-400"
                                )}
                              />
                            </div>
                            <span className={cn(
                              "text-xs font-bold w-9 text-right tabular-nums",
                              pct >= 95 ? "text-green-600" :
                              pct >= 80 ? "text-blue-600" :
                              pct >= 60 ? "text-yellow-600" :
                              "text-red-500"
                            )}>
                              {pct}%
                            </span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
                {/* Summary stats */}
                {result.entities && result.entities.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Object.entries(
                      result.entities.reduce((acc: Record<string, number>, e) => {
                        const key = e.label.replace(/^[BI]-/, "").replace(/_/g, " ");
                        acc[key] = (acc[key] ?? 0) + 1;
                        return acc;
                      }, {})
                    ).map(([label, count]) => (
                      <span key={label} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {label}: {count}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-3 flex items-center gap-1">
                  <span className="w-2 h-2 bg-blue-400 rounded-full inline-block" />
                  BertForTokenClassification · checkpoint-48561 · English only · filtered ≥80%
                </p>
              </div>
            )}

            {/* Assertion */}
            {activeTab === "assertion" && (
              <AssertionTab validated={result.validated} />
            )}

            {/* Summary */}
            {activeTab === "summary" && (
              <div className="space-y-4">
                {/* Short-text notice */}
                {(result.models?.summarization?.total_tokens ?? result.models?.ner?.total_tokens ?? 0) < 128 && result.summary_en && (
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <Info className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-amber-700">Short text — model may repeat the original</p>
                      <p className="text-xs text-amber-600 mt-0.5 leading-relaxed">
                        The input is under 128 tokens. BART summarization models are trained on longer documents
                        and tend to echo or slightly rephrase the original text when the input is this short.
                        The summary below is still generated but treat it as a paraphrase, not a condensed summary.
                      </p>
                    </div>
                  </div>
                )}

                {/* English */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                      <span className="text-base">🇬🇧</span> English Summary
                    </p>
                    {result.summary_en && <CopyButton text={result.summary_en} />}
                  </div>
                  <div className="bg-blue-50 rounded-xl p-4 border border-blue-100 text-sm text-gray-700 leading-relaxed">
                    {result.summary_en || <span className="text-gray-400 italic">No summary available</span>}
                  </div>
                </div>

                {/* Amharic toggle */}
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    <span className="text-base">🇪🇹</span> Amharic Summary
                    {!result.summary_am && (
                      <span className="text-xs font-normal text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100 normal-case tracking-normal">
                        Coming soon
                      </span>
                    )}
                  </div>
                  {result.summary_am ? (
                    <div className="bg-green-50 rounded-xl p-4 border border-green-100 text-sm text-gray-800 leading-relaxed font-['Noto_Sans_Ethiopic',sans-serif]">
                      {result.summary_am}
                    </div>
                  ) : (
                    <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 text-sm text-amber-700">
                      Amharic summarization is not yet enabled. Only English output is currently supported.
                      This feature will be added in a future update.
                    </div>
                  )}
                </div>

                <p className="text-xs text-gray-400 flex items-center gap-1">
                  <span className="w-2 h-2 bg-indigo-400 rounded-full inline-block" />
                  BartForConditionalGeneration · checkpoint-115620 · English only
                  {result.models?.summarization?.chunks > 1 && (
                    <span className="ml-1 text-purple-600 font-semibold bg-purple-50 px-2 py-0.5 rounded-full">
                      {result.models.summarization.chunks} chunks → hierarchical summary
                    </span>
                  )}
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
