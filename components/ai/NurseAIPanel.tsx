"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { AIUploadPanel } from "./AIUploadPanel";
import { AIResultViewer } from "./AIResultViewer";
import { Heart, AlertTriangle, AlertCircle, Info, Activity } from "lucide-react";
import { StatusBadge } from "@/components/ui/Badge";
import { formatDateTime } from "@/lib/utils";

async function fetchActiveVisits() {
  const res = await fetch("/api/visits?status=IN_TRIAGE&limit=10");
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

export function NurseAIPanel() {
  const [result, setResult] = useState<any>(null);
  const [selectedVisit, setSelectedVisit] = useState<any>(null);

  const { data: visitsData } = useQuery({ queryKey: ["active-triage-visits"], queryFn: fetchActiveVisits });

  const riskLevel = result?.validated?.flags?.some((f: any) => f.severity === "high")
    ? "high"
    : result?.validated?.flags?.some((f: any) => f.severity === "medium")
    ? "medium"
    : result ? "low" : null;

  const riskConfig = {
    high: { color: "bg-red-50 border-red-200", icon: <AlertCircle className="w-5 h-5 text-red-500" />, label: "High Risk — Immediate attention required", text: "text-red-700" },
    medium: { color: "bg-yellow-50 border-yellow-200", icon: <AlertTriangle className="w-5 h-5 text-yellow-500" />, label: "Medium Risk — Monitor closely", text: "text-yellow-700" },
    low: { color: "bg-green-50 border-green-200", icon: <Info className="w-5 h-5 text-green-500" />, label: "Low Risk — Routine care", text: "text-green-700" },
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-gradient-to-br from-green-600 to-teal-600 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Heart className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-black">AI Triage Assistant</h2>
            <p className="text-green-200 text-sm">NER · Assertion · Risk Flagging</p>
          </div>
        </div>
        <p className="text-green-100 text-sm mt-2">
          Upload patient symptom notes or referral letters. The AI extracts symptoms, identifies risk flags, and suggests triage priority.
        </p>
      </motion.div>

      {/* Active triage patients */}
      {visitsData?.visits?.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
            <Activity className="w-4 h-4 text-green-600" />
            <h3 className="font-semibold text-gray-900 text-sm">Patients Currently in Triage</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {visitsData.visits.map((v: any) => (
              <button
                key={v.id}
                onClick={() => setSelectedVisit(v)}
                className={`w-full flex items-center gap-3 px-5 py-3 hover:bg-green-50 transition-colors text-left ${selectedVisit?.id === v.id ? "bg-green-50" : ""}`}
              >
                <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center text-green-700 font-bold text-sm flex-shrink-0">
                  {v.patient?.name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{v.patient?.name}</p>
                  <p className="text-xs text-gray-500 truncate">{v.chiefComplaint || "No complaint noted"}</p>
                </div>
                <StatusBadge status={v.status} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Risk indicator */}
      {riskLevel && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`flex items-center gap-3 p-4 rounded-2xl border-2 ${riskConfig[riskLevel].color}`}
        >
          {riskConfig[riskLevel].icon}
          <div>
            <p className={`font-bold text-sm ${riskConfig[riskLevel].text}`}>{riskConfig[riskLevel].label}</p>
            {result?.entities?.filter((e: any) => e.label === "SYMPTOM").length > 0 && (
              <p className="text-xs text-gray-600 mt-0.5">
                Symptoms: {result.entities.filter((e: any) => e.label === "SYMPTOM").map((e: any) => e.text).join(", ")}
              </p>
            )}
          </div>
        </motion.div>
      )}

      {/* Upload + Results */}
      <div className={`grid gap-6 ${result ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1 max-w-xl"}`}>
        <AIUploadPanel
          documentType="clinical_note"
          onResult={(r) => setResult(r)}
          title="Analyze Patient Symptoms"
          description="Upload symptom notes, referral letters, or clinical documents"
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
