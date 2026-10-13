"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileText, Image as ImageIcon, X, Sparkles, RefreshCw, PenLine, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AIStatusBadge, ServiceStatusBadge, PipelineProgress, type AIStatus } from "./AIStatusBadge";
import { cn } from "@/lib/utils";

export type AIDocumentType = "clinical_note" | "id_card" | "referral" | "lab_report" | "prescription";
type InputMode = "text" | "file";
type DocLanguage = "auto" | "amharic" | "english";

interface AIUploadPanelProps {
  documentType: AIDocumentType;
  onResult: (result: any) => void;
  title?: string;
  description?: string;
  acceptedTypes?: string;
  compact?: boolean;
}

const TYPE_LABELS: Record<AIDocumentType, string> = {
  clinical_note: "Clinical Note",
  id_card: "ID Card",
  referral: "Referral Letter",
  lab_report: "Lab Report",
  prescription: "Prescription",
};

const TYPE_PLACEHOLDERS: Record<AIDocumentType, string> = {
  clinical_note:
    "Patient presents with fever 38.5°C, persistent headache for 3 days, nausea.\nHistory of hypertension. BP: 145/92 mmHg. HR: 88 bpm.\nNo known drug allergies.\nPrescribed Paracetamol 500mg TID and Amlodipine 5mg OD.",
  id_card: "Full Name: ...\nDate of Birth: DD/MM/YYYY\nGender: Male / Female\nPhone: +...\nAddress: ...",
  referral:
    "REFERRAL LETTER\nFrom: Dr. ..., [Hospital]\nTo: [Department]\nPatient: [Name], [Age/Gender]\nReason: ...",
  lab_report:
    "Test: Complete Blood Count (CBC)\nWBC: ... × 10⁹/L\nHemoglobin: ... g/dL\nHematocrit: ...%\nPlatelets: ... × 10⁹/L",
  prescription:
    "Rx:\nAmoxicillin 500mg — 1 cap TID × 7 days\nOmeprazole 20mg — 1 cap OD before meals × 14 days\nDr. [Name] | License: ...",
};

const STEP_DURATIONS = { ocr: 800, ner: 900, assertion: 700, summarization: 1000 };

export function AIUploadPanel({
  documentType,
  onResult,
  title,
  description,
  acceptedTypes = ".pdf,.png,.jpg,.jpeg,.txt",
  compact = false,
}: AIUploadPanelProps) {
  const [inputMode, setInputMode] = useState<InputMode>("text");
  const [docLanguage, setDocLanguage] = useState<DocLanguage>("auto");
  const [typedText, setTypedText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<AIStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [serviceOnline, setServiceOnline] = useState<boolean | null>(null);
  const [steps, setSteps] = useState<Record<string, "waiting" | "running" | "done" | "skipped">>({
    ocr: "waiting", ner: "waiting", assertion: "waiting", summarization: "waiting",
  });
  const [chunkInfo, setChunkInfo] = useState<{ ner?: number; summarization?: number }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check service health on mount, then every 60s
  useEffect(() => {
    const check = () =>
      fetch("/api/ai/health")
        .then((r) => r.json())
        .then((data) => setServiceOnline(data.online === true))
        .catch(() => setServiceOnline(false));
    check();
    const id = setInterval(check, 120_000); // every 2 minutes is enough
    return () => clearInterval(id);
  }, []);

  const resetSteps = () =>
    setSteps({ ocr: "waiting", ner: "waiting", assertion: "waiting", summarization: "waiting" });

  const handleFile = (f: File) => {
    setFile(f);
    setStatus("idle");
    setError(null);
    resetSteps();
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFile(dropped);
  }, []);

  const runStep = async (key: string, delay: number) => {
    setSteps((p) => ({ ...p, [key]: "running" }));
    await new Promise((r) => setTimeout(r, delay));
    setSteps((p) => ({ ...p, [key]: "done" }));
  };

  const hasInput = inputMode === "text" ? typedText.trim().length > 10 : !!file;

  const handleProcess = async () => {
    if (!hasInput) return;
    setStatus("uploading");
    setError(null);
    resetSteps();

    try {
      let ocrText = "";

      if (inputMode === "text") {
        // Typed text — skip OCR, text is already available
        ocrText = typedText.trim();
        setSteps((p) => ({ ...p, ocr: "done" }));
        await new Promise((r) => setTimeout(r, 300));
      } else {
        // File upload
        setSteps((p) => ({ ...p, ocr: "running" }));

        if (file!.type === "text/plain") {
          // Plain text file — read directly
          ocrText = await file!.text();
          setSteps((p) => ({ ...p, ocr: "done" }));
        } else if (file!.type.startsWith("image/")) {
          // Route based on selected language
          // "auto" → try Tesseract first, fall back to TrOCR
          // "amharic" → go straight to TrOCR GPU
          // "english" → go straight to Tesseract

          const isAmharicSelected = docLanguage === "amharic";
          const isEnglishSelected = docLanguage === "english";

          if (isEnglishSelected) {
            // English → Tesseract directly
            const engForm = new FormData();
            engForm.append("file", file!);
            const engRes = await fetch("/api/ai/ocr/english", { method: "POST", body: engForm });
            if (!engRes.ok) { const e = await engRes.json().catch(() => ({})); throw new Error(e.error ?? "English OCR failed"); }
            const engData = await engRes.json();
            ocrText = engData.text ?? "";
            setSteps((p) => ({ ...p, ocr: "done" }));
            if (!ocrText.trim()) throw new Error("No text extracted. Try a clearer image.");
            // English → fall through to NER pipeline

          } else if (isAmharicSelected) {
            // Amharic → TrOCR GPU directly
            const amForm = new FormData();
            amForm.append("file", file!);
            amForm.append("return_lines", "false");
            const amRes = await fetch("/api/ai/ocr", { method: "POST", body: amForm });
            if (!amRes.ok) { const e = await amRes.json().catch(() => ({})); throw new Error(e.error ?? "Amharic OCR failed — check GPU service"); }
            const amData = await amRes.json();
            ocrText = amData.text ?? "";
            setSteps((p) => ({ ...p, ocr: "done" }));
            if (!ocrText.trim()) throw new Error("No text extracted. Try a clearer image.");
            // Amharic → show OCR only, no summarization
            setSteps((p) => ({ ...p, ner: "skipped", assertion: "skipped", summarization: "skipped" }));
            setStatus("completed");
            onResult({
              ocrText,
              entities: [],
              validated: undefined,
              summary_en: undefined,
              source: "ocr_amharic",
              processedAt: new Date().toISOString(),
              detectedLanguage: { language: "am", is_amharic: true },
              models: {
                ner: { status: "skipped", reason: "Amharic — NER model is English-only" },
                assertion: { status: "skipped" },
                summarization: { status: "skipped" },
              },
            });
            return;

          } else {
            // Auto → smart routing (Tesseract first, then TrOCR)
            const smartForm = new FormData();
            smartForm.append("file", file!);
            const smartRes = await fetch("/api/ai/ocr/smart", { method: "POST", body: smartForm });
            if (!smartRes.ok) { const e = await smartRes.json().catch(() => ({})); throw new Error(e.error ?? "OCR failed — try selecting a language manually"); }
            const smartData = await smartRes.json();
            ocrText = smartData.text ?? "";
            const detectedLang = smartData.language ?? { is_amharic: false };
            setSteps((p) => ({ ...p, ocr: "done" }));
            if (!ocrText.trim()) throw new Error("No text extracted. Try selecting a language manually.");
            if (detectedLang.is_amharic) {
              setSteps((p) => ({ ...p, ner: "skipped", assertion: "skipped", summarization: "skipped" }));
              setStatus("completed");
              onResult({
                ocrText, entities: [], validated: undefined, summary_en: undefined,
                source: "ocr_amharic", processedAt: new Date().toISOString(),
                detectedLanguage: detectedLang,
                models: { ner: { status: "skipped" }, assertion: { status: "skipped" }, summarization: { status: "skipped" } },
              });
              return;
            }
            // English detected → fall through to NER
          }
        } else {
          // PDF or other — send to process API as-is
          await new Promise((r) => setTimeout(r, STEP_DURATIONS.ocr));
          setSteps((p) => ({ ...p, ocr: "done" }));
        }
      }

      setStatus("ner_processing");

      const formData = new FormData();
      if (inputMode === "file" && file) formData.append("file", file);
      formData.append("type", documentType);
      if (ocrText) formData.append("ocrText", ocrText);

      const [result] = await Promise.all([
        fetch("/api/ai/process", { method: "POST", body: formData }).then((r) => {
          if (!r.ok) throw new Error("Processing failed");
          return r.json();
        }),
        (async () => {
          await runStep("ner", STEP_DURATIONS.ner);
          setStatus("assertion_processing");
          await runStep("assertion", STEP_DURATIONS.assertion);
          setStatus("summarization_processing");
          await runStep("summarization", STEP_DURATIONS.summarization);
        })(),
      ]);

      // Inject typed text as ocrText if not returned by API
      if (inputMode === "text" && !result.ocrText) {
        result.ocrText = ocrText;
      }

      setStatus("completed");
      // Mark online if we got a real response from any server variant
      if (result.source && result.source !== "mock_service_offline") {
        setServiceOnline(true);
      }
      // Store chunk info for display
      if (result.models) {
        setChunkInfo({
          ner: result.models.ner?.chunks ?? 1,
          summarization: result.models.summarization?.chunks ?? 1,
        });
      }
      onResult(result);
    } catch (err: any) {
      setStatus("error");
      setError(err.message || "Processing failed. Please try again.");
      resetSteps();
    }
  };

  const handleReset = () => {
    setFile(null);
    setTypedText("");
    setStatus("idle");
    setError(null);
    resetSteps();
    setChunkInfo({});
  };

  const isProcessing = [
    "uploading", "ner_processing", "assertion_processing", "summarization_processing",
  ].includes(status);

  return (
    <div className={cn("bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden", compact && "rounded-xl")}>

      {/* ── Header ── */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">
              {title ?? `AI Analysis — ${TYPE_LABELS[documentType]}`}
            </h3>
            {description && <p className="text-xs text-gray-400">{description}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ServiceStatusBadge online={serviceOnline} />
          <AIStatusBadge status={status} />
        </div>
      </div>

      <div className="p-5 space-y-4">

        {/* ── Input mode tabs ── */}
        {status !== "completed" && (
          <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
            <button
              onClick={() => { setInputMode("text"); handleReset(); }}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all",
                inputMode === "text"
                  ? "bg-white text-purple-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              <PenLine className="w-4 h-4" />
              Type Text
            </button>
            <button
              onClick={() => { setInputMode("file"); handleReset(); }}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all",
                inputMode === "file"
                  ? "bg-white text-purple-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              <Paperclip className="w-4 h-4" />
              Upload File
            </button>
          </div>
        )}

        {/* ── Language selector (for file mode) ── */}
        {inputMode === "file" && status !== "completed" && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500">Document language:</span>
            <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
              {([
                { id: "auto", label: "🔍 Auto" },
                { id: "amharic", label: "🇪🇹 Amharic" },
                { id: "english", label: "🇬🇧 English" },
              ] as { id: DocLanguage; label: string }[]).map(opt => (
                <button key={opt.id} onClick={() => setDocLanguage(opt.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                    docLanguage === opt.id ? "bg-white text-purple-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  )}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Text input mode ── */}
        <AnimatePresence mode="wait">
          {inputMode === "text" && status !== "completed" && (
            <motion.div
              key="text-input"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
            >
              <div className="relative">
                <textarea
                  value={typedText}
                  onChange={(e) => {
                    setTypedText(e.target.value);
                    if (status !== "idle") { setStatus("idle"); resetSteps(); }
                  }}
                  disabled={isProcessing}
                  placeholder={TYPE_PLACEHOLDERS[documentType]}
                  rows={8}
                  className={cn(
                    "w-full px-4 py-3 border-2 rounded-xl text-sm text-gray-800 leading-relaxed resize-none",
                    "focus:outline-none focus:border-purple-400 transition-colors",
                    "placeholder:text-gray-300 font-mono",
                    isProcessing ? "bg-gray-50 border-gray-200" : "bg-white border-gray-200 hover:border-purple-200"
                  )}
                />
                {typedText && !isProcessing && (
                  <button
                    onClick={() => setTypedText("")}
                    className="absolute top-2.5 right-2.5 p-1 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <p className="text-xs text-gray-400">
                  {typedText.length > 0
                    ? `${typedText.length} characters · ${typedText.trim().split(/\s+/).length} words`
                    : "Type or paste clinical text directly"}
                </p>
                {typedText.trim().length > 0 && typedText.trim().length <= 10 && (
                  <p className="text-xs text-amber-500">Need at least 10 characters</p>
                )}
              </div>
            </motion.div>
          )}

          {/* ── File upload mode ── */}
          {inputMode === "file" && status !== "completed" && (
            <motion.div
              key="file-input"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
            >
              {!file ? (
                <motion.div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  animate={{
                    borderColor: isDragging ? "#7c3aed" : "#e5e7eb",
                    backgroundColor: isDragging ? "#f5f3ff" : "#fafafa",
                  }}
                  className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={acceptedTypes}
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                  />
                  <motion.div animate={{ scale: isDragging ? 1.1 : 1 }} className="flex flex-col items-center gap-3">
                    <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", isDragging ? "bg-purple-100" : "bg-gray-100")}>
                      <Upload className={cn("w-6 h-6", isDragging ? "text-purple-600" : "text-gray-400")} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-700">
                        {isDragging ? "Drop to upload" : "Drag & drop or click to upload"}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">PDF, PNG, JPG, TXT supported</p>
                    </div>
                  </motion.div>
                </motion.div>
              ) : (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    {file.type.startsWith("image/")
                      ? <ImageIcon className="w-5 h-5 text-blue-600" />
                      : <FileText className="w-5 h-5 text-blue-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{file.name}</p>
                    <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                  {!isProcessing && (
                    <button onClick={handleReset} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Pipeline progress ── */}
        <AnimatePresence>
          {(isProcessing || status === "completed") && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
              <PipelineProgress steps={steps} chunkInfo={chunkInfo} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Service offline notice ── */}
        {serviceOnline === false && status === "idle" && (
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
            <p className="text-xs font-semibold text-amber-700 mb-1">AI Service Offline — Using Mock Data</p>
            <p className="text-xs text-amber-600 font-mono">npm run ai:start</p>
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div className="p-3 bg-red-50 rounded-xl border border-red-100">
            <p className="text-xs text-red-600">{error}</p>
          </div>
        )}

        {/* ── Action button ── */}
        <div className="flex gap-2">
          {status === "completed" ? (
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw className="w-3.5 h-3.5" />}
              onClick={handleReset}
              className="flex-1 justify-center"
            >
              Analyse Another
            </Button>
          ) : (
            <Button
              size="sm"
              className="flex-1 justify-center bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              icon={<Sparkles className="w-3.5 h-3.5" />}
              onClick={handleProcess}
              disabled={!hasInput || isProcessing}
              loading={isProcessing}
            >
              {status === "uploading" ? "Preparing..." :
               status === "ner_processing" ? "Running NER..." :
               status === "assertion_processing" ? "Running Assertion..." :
               status === "summarization_processing" ? "Summarizing..." :
               inputMode === "text" ? "Analyse Text" : "Process File"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
