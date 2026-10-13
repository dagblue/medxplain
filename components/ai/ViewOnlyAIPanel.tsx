"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { AIUploadPanel, type AIDocumentType } from "./AIUploadPanel";
import { AIResultViewer } from "./AIResultViewer";
import { Sparkles } from "lucide-react";

interface ViewOnlyAIPanelProps {
  type: AIDocumentType;
  title: string;
  description: string;
}

export function ViewOnlyAIPanel({ type, title, description }: ViewOnlyAIPanelProps) {
  const [result, setResult] = useState<any>(null);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-black">{title}</h2>
            <p className="text-indigo-200 text-sm">AI-powered document analysis</p>
          </div>
        </div>
        <p className="text-indigo-100 text-sm mt-2">{description}</p>
      </motion.div>

      <div className={`grid gap-6 ${result ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1 max-w-xl"}`}>
        <AIUploadPanel
          documentType={type}
          onResult={(r) => setResult(r)}
          title={title}
          description={description}
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
