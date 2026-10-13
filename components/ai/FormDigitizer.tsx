"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, X, ScanLine, Table, CheckCircle,
  AlertTriangle, Copy, Check, Download, RefreshCw,
  ChevronDown, ChevronUp, Loader2, Image as ImageIcon,
  Maximize2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CellResult {
  row: number;
  col: number;
  text: string;
  confidence: number;
  low_confidence: boolean;
  box: number[];
}

interface DigitizerResult {
  table: string[][];
  cells: CellResult[];
  detections: any[];
  row_count: number;
  col_count: number;
  cell_count: number;
  processing_time_ms: number;
  message?: string;
}

type Stage = "idle" | "preprocessing" | "detecting" | "reading" | "done" | "error";

// ── Preprocessing options ─────────────────────────────────────────────────────

const PREPROCESS_OPTIONS = [
  { id: "auto", label: "Auto", desc: "Best for most documents" },
  { id: "enhance", label: "Enhance", desc: "Low quality / faded ink" },
  { id: "deskew", label: "Deskew", desc: "Rotated / skewed scans" },
  { id: "binarize", label: "High contrast", desc: "Handwritten forms" },
];

// ── Copy button ───────────────────────────────────────────────────────────────

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
      title="Copy"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

// ── Table viewer ──────────────────────────────────────────────────────────────

function TableViewer({ result }: { result: DigitizerResult }) {
  const [view, setView] = useState<"table" | "cells">("table");
  const [expanded, setExpanded] = useState(false);

  const csvContent = result.table
    .map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const downloadCSV = () => {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `digitized_form_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const lowConfCells = result.cells.filter(c => c.low_confidence);
  const avgConf = result.cells.length
    ? Math.round(result.cells.reduce((s, c) => s + c.confidence, 0) / result.cells.length * 100)
    : 0;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Rows", value: result.row_count, color: "text-blue-600 bg-blue-50" },
          { label: "Columns", value: result.col_count, color: "text-purple-600 bg-purple-50" },
          { label: "Cells", value: result.cell_count, color: "text-green-600 bg-green-50" },
          { label: "Avg Conf", value: `${avgConf}%`, color: avgConf >= 80 ? "text-green-600 bg-green-50" : "text-amber-600 bg-amber-50" },
        ].map(s => (
          <div key={s.label} className={cn("rounded-xl p-3 text-center", s.color)}>
            <p className="text-lg font-black">{s.value}</p>
            <p className="text-xs font-medium opacity-70">{s.label}</p>
          </div>
        ))}
      </div>

      {lowConfCells.length > 0 && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl border border-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">{lowConfCells.length} low-confidence cell{lowConfCells.length > 1 ? "s" : ""} — verify manually.</p>
        </div>
      )}

      {/* View toggle + actions */}
      <div className="flex items-center justify-between">
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
          {(["table", "cells"] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize",
                view === v ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700")}>
              {v === "table" ? "📊 Table" : "🔲 Cells"}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <CopyBtn text={csvContent} />
          <button onClick={downloadCSV}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors">
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        </div>
      </div>

      {/* Table view */}
      {view === "table" && (
        <div className={cn("overflow-auto rounded-xl border border-gray-200", expanded ? "max-h-[70vh]" : "max-h-80")}>
          {result.table.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <Table className="w-8 h-8 mx-auto mb-2 text-gray-200" />
              <p className="text-sm">No table data extracted</p>
            </div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-2 py-2 text-xs text-gray-400 font-semibold border-b border-gray-200 w-8">#</th>
                  {result.table[0]?.map((_, ci) => (
                    <th key={ci} className="px-3 py-2 text-xs text-gray-500 font-semibold border-b border-gray-200 text-left">Col {ci + 1}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.table.map((row, ri) => (
                  <tr key={ri} className="hover:bg-gray-50 transition-colors">
                    <td className="px-2 py-2 text-xs text-gray-300 border-b border-gray-100 text-center">{ri + 1}</td>
                    {row.map((cell, ci) => {
                      const cellData = result.cells.find(c => c.row === ri && c.col === ci);
                      return (
                        <td key={ci}
                          className={cn("px-3 py-2 border-b border-gray-100 text-gray-800",
                            cellData?.low_confidence && "bg-amber-50 text-amber-800")}>
                          {cell || <span className="text-gray-300 italic text-xs">empty</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Cells view */}
      {view === "cells" && (
        <div className={cn("space-y-1.5 overflow-y-auto", expanded ? "max-h-[70vh]" : "max-h-80")}>
          {result.cells.map((cell, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.02 }}
              className={cn("flex items-center gap-3 px-3 py-2 rounded-xl border text-sm",
                cell.low_confidence ? "bg-amber-50 border-amber-200" : "bg-gray-50 border-gray-100")}>
              <span className="text-xs font-bold text-gray-400 w-16 flex-shrink-0">R{cell.row + 1} C{cell.col + 1}</span>
              <span className={cn("flex-1 font-medium", cell.low_confidence ? "text-amber-800" : "text-gray-800")}>
                {cell.text || <span className="text-gray-300 italic">empty</span>}
              </span>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className={cn("h-full rounded-full", cell.confidence >= 0.8 ? "bg-green-500" : cell.confidence >= 0.65 ? "bg-amber-500" : "bg-red-400")}
                    style={{ width: `${Math.round(cell.confidence * 100)}%` }} />
                </div>
                <span className="text-xs font-bold text-gray-500 w-8 text-right">{Math.round(cell.confidence * 100)}%</span>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 flex items-center gap-1.5">
        <span className="w-2 h-2 bg-cyan-400 rounded-full inline-block" />
        TableTransformer + TrOCR cell reader · {result.processing_time_ms}ms
      </p>
    </div>
  );
}
// ── Main component ────────────────────────────────────────────────────────────

export function FormDigitizer() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [result, setResult] = useState<DigitizerResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [preprocess, setPreprocess] = useState("auto");
  const [threshold, setThreshold] = useState(0.4);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    setFile(f);
    setResult(null);
    setError(null);
    setStage("idle");
    const url = URL.createObjectURL(f);
    setPreview(url);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith("image/")) handleFile(f);
    else toast.error("Please upload an image file (JPG, PNG, TIFF)");
  }, []);

  const handleReset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setStage("idle");
  };

  const handleDigitize = async () => {
    if (!file) return;
    setStage("preprocessing");
    setError(null);
    setResult(null);

    try {
      // Stage 1: preprocessing (visual feedback)
      await new Promise(r => setTimeout(r, 400));
      setStage("detecting");

      // Stage 2: send to API
      const form = new FormData();
      form.append("file", file);
      form.append("confidence_threshold", String(threshold));
      form.append("preprocess_mode", preprocess);

      setStage("reading");

      const res = await fetch("/api/ai/digitize", {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(300_000),
      });

      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error ?? `Server error ${res.status}`);
      }

      const data: DigitizerResult = await res.json();
      setResult(data);
      setStage("done");

      if (data.cell_count === 0) {
        toast("No cells detected — try lowering the confidence threshold", { icon: "⚠️" });
      } else {
        toast.success(`Digitized ${data.cell_count} cells in ${(data.processing_time_ms / 1000).toFixed(1)}s`);
      }
    } catch (e: any) {
      setStage("error");
      setError(e.message ?? "Digitization failed");
      toast.error(e.message ?? "Digitization failed");
    }
  };

  const isProcessing = ["preprocessing", "detecting", "reading"].includes(stage);

  const STAGE_LABELS: Record<Stage, string> = {
    idle: "Digitize Form",
    preprocessing: "Preprocessing image...",
    detecting: "Detecting table structure...",
    reading: "Reading cells...",
    done: "Done",
    error: "Failed",
  };

  return (
    <div className="space-y-5">

      {/* Upload area */}
      {!file ? (
        <motion.div
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          animate={{ borderColor: isDragging ? "#0891b2" : "#e5e7eb", backgroundColor: isDragging ? "#ecfeff" : "#fafafa" }}
          className="border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors"
        >
          <input ref={fileInputRef} type="file" accept="image/*,.tiff,.tif" className="hidden"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
          <motion.div animate={{ scale: isDragging ? 1.05 : 1 }} className="flex flex-col items-center gap-3">
            <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center", isDragging ? "bg-cyan-100" : "bg-gray-100")}>
              <Upload className={cn("w-7 h-7", isDragging ? "text-cyan-600" : "text-gray-400")} />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-700">{isDragging ? "Drop to digitize" : "Upload clinical form"}</p>
              <p className="text-xs text-gray-400 mt-1">JPG · PNG · TIFF · BMP — any orientation, any quality</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center mt-1">
              {["Registration forms", "Lab request forms", "Referral letters", "Discharge summaries", "Prescription pads"].map(t => (
                <span key={t} className="text-xs bg-cyan-50 text-cyan-700 px-2 py-0.5 rounded-full border border-cyan-100">{t}</span>
              ))}
            </div>
          </motion.div>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Image preview */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Document Preview</p>
              {!isProcessing && (
                <button onClick={handleReset} className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors">
                  <X className="w-3.5 h-3.5" /> Remove
                </button>
              )}
            </div>
            <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
              {preview && (
                <img src={preview} alt="Document preview" className="w-full object-contain max-h-80" />
              )}
              {isProcessing && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <div className="bg-white rounded-xl px-4 py-3 flex items-center gap-2.5 shadow-lg">
                    <Loader2 className="w-4 h-4 text-cyan-600 animate-spin" />
                    <span className="text-sm font-semibold text-gray-700">{STAGE_LABELS[stage]}</span>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <ImageIcon className="w-3.5 h-3.5" />
              <span className="truncate">{file.name}</span>
              <span className="text-gray-300">·</span>
              <span>{(file.size / 1024).toFixed(0)} KB</span>
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Preprocessing Mode</p>
              <div className="grid grid-cols-2 gap-2">
                {PREPROCESS_OPTIONS.map(opt => (
                  <button key={opt.id} onClick={() => setPreprocess(opt.id)}
                    className={cn(
                      "p-3 rounded-xl border-2 text-left transition-all",
                      preprocess === opt.id
                        ? "border-cyan-500 bg-cyan-50"
                        : "border-gray-100 bg-white hover:border-cyan-200"
                    )}>
                    <p className={cn("text-xs font-bold", preprocess === opt.id ? "text-cyan-700" : "text-gray-700")}>{opt.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5 leading-tight">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Advanced */}
            <div>
              <button onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors">
                {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                Advanced settings
              </button>
              <AnimatePresence>
                {showAdvanced && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }} className="overflow-hidden mt-2">
                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-2">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-medium text-gray-600">Detection threshold</label>
                          <span className="text-xs font-bold text-cyan-600">{threshold}</span>
                        </div>
                        <input type="range" min="0.1" max="0.9" step="0.05"
                          value={threshold} onChange={e => setThreshold(parseFloat(e.target.value))}
                          className="w-full accent-cyan-500" />
                        <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                          <span>More cells (0.1)</span>
                          <span>Fewer, confident (0.9)</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Action */}
            {stage !== "done" && (
              <Button
                className="w-full justify-center bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700"
                onClick={handleDigitize}
                disabled={isProcessing}
                loading={isProcessing}
                icon={!isProcessing ? <ScanLine className="w-4 h-4" /> : undefined}
              >
                {STAGE_LABELS[stage]}
              </Button>
            )}

            {stage === "done" && (
              <Button variant="secondary" className="w-full justify-center"
                icon={<RefreshCw className="w-4 h-4" />} onClick={handleReset}>
                Digitize Another
              </Button>
            )}

            {/* Pipeline steps */}
            <div className="space-y-1.5">
              {[
                { key: "preprocessing", label: "Image preprocessing" },
                { key: "detecting", label: "Table structure detection" },
                { key: "reading", label: "Cell text recognition" },
              ].map(step => {
                const stageOrder = ["preprocessing", "detecting", "reading", "done"];
                const stepIdx = stageOrder.indexOf(step.key);
                const currentIdx = stageOrder.indexOf(stage);
                const isDone = stage === "done" || currentIdx > stepIdx;
                const isActive = stage === step.key;
                return (
                  <div key={step.key} className="flex items-center gap-2">
                    <div className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all",
                      isDone ? "bg-green-500" : isActive ? "bg-cyan-500" : "bg-gray-200"
                    )}>
                      {isDone ? <Check className="w-3 h-3 text-white" /> :
                       isActive ? <Loader2 className="w-3 h-3 text-white animate-spin" /> :
                       <span className="w-1.5 h-1.5 bg-gray-400 rounded-full" />}
                    </div>
                    <span className={cn("text-xs", isDone ? "text-green-700 font-medium" : isActive ? "text-cyan-700 font-semibold" : "text-gray-400")}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {error && (
              <div className="p-3 bg-red-50 rounded-xl border border-red-100">
                <p className="text-xs text-red-600">{error}</p>
                <p className="text-xs text-red-400 mt-1">Try lowering the detection threshold or use a clearer image.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Results */}
      <AnimatePresence>
        {result && stage === "done" && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gradient-to-r from-cyan-50 to-blue-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm font-bold text-gray-800">Digitization Complete</span>
              </div>
              <span className="text-xs text-gray-400">{(result.processing_time_ms / 1000).toFixed(1)}s</span>
            </div>
            <div className="p-5">
              <TableViewer result={result} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
