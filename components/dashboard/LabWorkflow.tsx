"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { FlaskConical, ChevronDown, ChevronUp, CheckCircle, RefreshCw, Clock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { StatusBadge } from "@/components/ui/Badge";
import { cn, formatDateTime } from "@/lib/utils";
import toast from "react-hot-toast";

interface LabRequest {
  id: string;
  testName: string;
  testType: string;
  urgency: string;
  status: string;
  notes?: string;
  createdAt: string;
  patient: { name: string };
  doctor: { user: { name: string } };
  labResult?: {
    result: string;
    normalRange?: string;
    interpretation?: string;
  };
}

const URGENCY_COLOR: Record<string, string> = {
  STAT: "bg-red-100 text-red-700",
  URGENT: "bg-orange-100 text-orange-700",
  ROUTINE: "bg-gray-100 text-gray-600",
};

function ResultForm({ request, onDone }: { request: LabRequest; onDone: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    result: request.labResult?.result ?? "",
    normalRange: request.labResult?.normalRange ?? "",
    interpretation: request.labResult?.interpretation ?? "",
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!form.result.trim()) throw new Error("Result is required");
      // First mark as IN_PROGRESS
      await fetch(`/api/lab-requests/${request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "IN_PROGRESS" }),
      });
      // Then upload result (POST to same route — handled by POST handler)
      const res = await fetch(`/api/lab-requests/${request.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Lab result uploaded — visit moved to WAITING DOCTOR if all tests done");
      qc.invalidateQueries({ queryKey: ["lab-queue"] });
      onDone();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="border-t border-gray-100 pt-4 mt-2 space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Result *</label>
        <textarea
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none bg-white"
          rows={3}
          placeholder="Enter test result values…"
          value={form.result}
          onChange={(e) => setForm(f => ({ ...f, result: e.target.value }))}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Normal Range"
          placeholder="e.g. 4.5–11.0 × 10⁹/L"
          value={form.normalRange}
          onChange={(e) => setForm(f => ({ ...f, normalRange: e.target.value }))}
        />
        <Input
          label="Interpretation"
          placeholder="e.g. Elevated — possible infection"
          value={form.interpretation}
          onChange={(e) => setForm(f => ({ ...f, interpretation: e.target.value }))}
        />
      </div>
      <div className="flex gap-2 pt-1">
        <Button variant="secondary" className="flex-1" onClick={onDone}>Cancel</Button>
        <Button
          className="flex-1"
          loading={mutation.isPending}
          onClick={() => mutation.mutate()}
          icon={<CheckCircle className="w-4 h-4" />}
        >
          Upload Result
        </Button>
      </div>
    </div>
  );
}

export function LabWorkflow() {
  const [openId, setOpenId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["lab-queue"],
    queryFn: async () => {
      const res = await fetch("/api/lab-requests?status=PENDING&limit=50");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 20_000,
  });

  const requests: LabRequest[] = data?.requests ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-cyan-600" />
          Pending Lab Requests
          {requests.length > 0 && (
            <span className="text-xs font-bold bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded-full">
              {requests.length} pending
            </span>
          )}
        </h2>
        <button onClick={() => refetch()} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : requests.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Clock className="w-8 h-8 mx-auto mb-2 text-gray-200" />
          <p className="text-sm">No pending lab requests</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => {
            const isOpen = openId === r.id;
            return (
              <motion.div key={r.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <button onClick={() => setOpenId(isOpen ? null : r.id)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center flex-shrink-0">
                    <FlaskConical className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900">{r.testName}</p>
                      <span className="text-xs text-gray-400">({r.testType})</span>
                      <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", URGENCY_COLOR[r.urgency] ?? URGENCY_COLOR.ROUTINE)}>
                        {r.urgency}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      Patient: {r.patient.name} · Dr. {r.doctor.user.name} · {formatDateTime(r.createdAt)}
                    </p>
                  </div>
                  <StatusBadge status={r.status} />
                  {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden px-4 pb-4">
                      <ResultForm request={r} onDone={() => setOpenId(null)} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
