"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { FormDigitizer } from "./FormDigitizer";
import { AIUploadPanel } from "./AIUploadPanel";
import { AIResultViewer } from "./AIResultViewer";
import { ScanLine, Table, UserCheck, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

type Mode = "digitize" | "scan";

export function ReceptionistAIPanel() {
  const [mode, setMode] = useState<Mode>("digitize");
  const [scanResult, setScanResult] = useState<any>(null);
  const [filled, setFilled] = useState(false);

  const MODES = [
    {
      id: "digitize" as Mode,
      icon: Table,
      label: "Form Digitizer",
      desc: "Convert any clinical form into a structured table",
      color: "from-cyan-600 to-blue-600",
      badge: "bg-cyan-100 text-cyan-700",
    },
    {
      id: "scan" as Mode,
      icon: UserCheck,
      label: "ID / Referral Scanner",
      desc: "Extract patient info and auto-fill registration",
      color: "from-blue-600 to-indigo-600",
      badge: "bg-blue-100 text-blue-700",
    },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-cyan-600 to-blue-600 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <ScanLine className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-black">AI Document Scanner</h2>
            <p className="text-cyan-200 text-sm">Form Digitization · ID Scanning · Auto-fill</p>
          </div>
        </div>
        <p className="text-cyan-100 text-sm mt-2">
          Upload any clinical document — registration forms, lab requests, referral letters, discharge summaries.
          The AI detects the table structure and reads every cell.
        </p>
      </motion.div>

      {/* Mode selector */}
      <div className="grid grid-cols-2 gap-3">
        {MODES.map(m => (
          <button key={m.id} onClick={() => setMode(m.id)}
            className={cn(
              "p-4 rounded-2xl border-2 text-left transition-all",
              mode === m.id
                ? "border-cyan-500 bg-cyan-50 shadow-sm"
                : "border-gray-100 bg-white hover:border-cyan-200"
            )}>
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className={cn(
                "w-8 h-8 rounded-xl flex items-center justify-center",
                mode === m.id ? "bg-gradient-to-br " + m.color : "bg-gray-100"
              )}>
                <m.icon className={cn("w-4 h-4", mode === m.id ? "text-white" : "text-gray-400")} />
              </div>
              <p className={cn("text-sm font-bold", mode === m.id ? "text-cyan-700" : "text-gray-700")}>
                {m.label}
              </p>
            </div>
            <p className="text-xs text-gray-400 leading-tight">{m.desc}</p>
          </button>
        ))}
      </div>

      {/* Form Digitizer */}
      {mode === "digitize" && (
        <motion.div key="digitize" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <FormDigitizer />
        </motion.div>
      )}

      {/* ID / Referral Scanner */}
      {mode === "scan" && (
        <motion.div key="scan" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="space-y-4">

          {/* How it works */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { step: "1", icon: ScanLine, label: "Upload document", desc: "ID card, passport, referral letter" },
              { step: "2", icon: UserCheck, label: "AI extracts data", desc: "Name, DOB, phone, address" },
              { step: "3", icon: CheckCircle, label: "Auto-fill form", desc: "One click fills registration" },
            ].map(s => (
              <div key={s.step} className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
                <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-black text-xs mx-auto mb-2">
                  {s.step}
                </div>
                <s.icon className="w-4 h-4 text-blue-500 mx-auto mb-1" />
                <p className="text-xs font-semibold text-gray-800">{s.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{s.desc}</p>
              </div>
            ))}
          </div>

          <div className={cn("grid gap-6", scanResult ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1 max-w-xl")}>
            <AIUploadPanel
              documentType="id_card"
              onResult={r => { setScanResult(r); setFilled(false); }}
              title="Scan ID Card or Referral Letter"
              description="Ethiopian ID, passport, referral letter"
            />
            {scanResult && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                <AIResultViewer result={scanResult} onAutoFill={() => {
                  setFilled(true);
                  toast.success("Patient form auto-filled!");
                }} />
                {filled && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="mt-3 flex items-center gap-2 p-3 bg-green-50 rounded-xl border border-green-100">
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <p className="text-sm text-green-700 font-medium">Form auto-filled successfully!</p>
                  </motion.div>
                )}
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
