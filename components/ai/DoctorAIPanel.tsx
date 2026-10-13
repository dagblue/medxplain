"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { AIUploadPanel } from "./AIUploadPanel";
import { AIResultViewer } from "./AIResultViewer";
import { Sparkles, FileText, FlaskConical, Pill, Brain } from "lucide-react";

const USE_CASES = [
  { type: "clinical_note" as const, icon: FileText, label: "Clinical Notes", desc: "Upload handwritten or typed clinical notes for OCR + NER analysis" },
  { type: "referral" as const, icon: Brain, label: "Referral Letters", desc: "Extract patient info and clinical findings from referral documents" },
  { type: "lab_report" as const, icon: FlaskConical, label: "Lab Reports", desc: "Summarize lab results and flag abnormal values" },
  { type: "prescription" as const, icon: Pill, label: "Prescriptions", desc: "Verify prescriptions and check for drug interactions" },
];

export function DoctorAIPanel() {
  const [selectedType, setSelectedType] = useState<typeof USE_CASES[0]["type"]>("clinical_note");
  const [result, setResult] = useState<any>(null);

  const selected = USE_CASES.find((u) => u.type === selectedType)!;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-black">AI Clinical Analysis</h2>
            <p className="text-purple-200 text-sm">OCR · NER · Assertion · Summarization</p>
          </div>
        </div>
        <p className="text-purple-100 text-sm mt-2">
          Upload clinical documents to extract entities, validate clinical assertions, and generate bilingual summaries (English + Amharic).
        </p>
      </motion.div>

      {/* Document type selector */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {USE_CASES.map((uc, i) => (
          <motion.button
            key={uc.type}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => { setSelectedType(uc.type); setResult(null); }}
            className={`p-4 rounded-2xl border-2 text-left transition-all ${
              selectedType === uc.type
                ? "border-purple-500 bg-purple-50"
                : "border-gray-100 bg-white hover:border-purple-200"
            }`}
          >
            <uc.icon className={`w-5 h-5 mb-2 ${selectedType === uc.type ? "text-purple-600" : "text-gray-400"}`} />
            <p className={`text-sm font-semibold ${selectedType === uc.type ? "text-purple-700" : "text-gray-700"}`}>{uc.label}</p>
            <p className="text-xs text-gray-400 mt-0.5 leading-tight">{uc.desc}</p>
          </motion.button>
        ))}
      </div>

      {/* Upload + Results */}
      <div className={`grid gap-6 ${result ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1 max-w-xl"}`}>
        <AIUploadPanel
          documentType={selectedType}
          onResult={(r) => setResult(r)}
          title={`Analyze ${selected.label}`}
          description={selected.desc}
        />
        {result && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <AIResultViewer result={result} />
          </motion.div>
        )}
      </div>
    </div>
  );
}
