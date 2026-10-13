"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Pill, CheckCircle, RefreshCw, Clock, Package,
  Search, X, QrCode, AlertTriangle, ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { cn, formatDateTime } from "@/lib/utils";
import toast from "react-hot-toast";

interface Medicine { id: string; name: string; dosage: string; frequency: string; duration: string; instructions?: string }
interface Prescription {
  id: string; code: string; status: string; notes?: string; createdAt: string;
  patient: { id: string; name: string; phone: string; gender: string; bloodGroup?: string; allergies?: string };
  doctor: { user: { name: string } };
  medicines: Medicine[];
  visit?: { id: string; queueNumber?: number; status: string } | null;
  dispensation?: { dispensedAt: string; pharmacist: { user: { name: string } } };
}

// ─── Code scanner panel ───────────────────────────────────────────────────────

function CodeScanner({ onFound }: { onFound: (rx: Prescription) => void }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const lookup = async (code: string) => {
    const clean = code.trim().toUpperCase();
    if (!clean) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/prescriptions?code=${encodeURIComponent(clean)}`);
      if (!res.ok) {
        const e = await res.json();
        setError(e.error ?? "Prescription not found");
        return;
      }
      const data = await res.json();
      onFound(data.prescription);
      setInput("");
    } catch {
      setError("Failed to look up prescription");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center flex-shrink-0">
          <QrCode className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-semibold text-gray-900">Scan Prescription</h2>
          <p className="text-xs text-gray-500">Enter the prescription code (e.g. RX-A3F9) or scan QR</p>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => { setInput(e.target.value.toUpperCase()); setError(""); }}
            onKeyDown={e => e.key === "Enter" && lookup(input)}
            placeholder="RX-XXXX"
            className="w-full pl-9 pr-8 py-2.5 border border-gray-200 rounded-xl text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white uppercase"
            autoFocus
          />
          {input && (
            <button onClick={() => { setInput(""); setError(""); inputRef.current?.focus(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <Button
          loading={loading}
          disabled={!input.trim()}
          onClick={() => lookup(input)}
          icon={<Search className="w-4 h-4" />}
        >
          Look up
        </Button>
      </div>

      {error && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </motion.div>
      )}

      <p className="text-xs text-gray-400 text-center">
        The prescription code is printed on the patient's receipt or shown on their visit summary.
      </p>
    </div>
  );
}

// ─── Prescription detail + dispense ──────────────────────────────────────────

function PrescriptionDetail({ rx, onDone }: { rx: Prescription; onDone: () => void }) {
  const qc = useQueryClient();
  const [notes, setNotes] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/prescriptions/${rx.id}/dispense`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Prescription dispensed — visit marked complete");
      qc.invalidateQueries({ queryKey: ["pharmacist-queue"] });
      onDone();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const alreadyDispensed = rx.status === "DISPENSED";

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl border border-orange-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-orange-50 border-b border-orange-100 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-black font-mono bg-orange-200 text-orange-800 px-2 py-0.5 rounded-lg tracking-widest">
              {rx.code}
            </span>
            <StatusBadge status={rx.status} />
            {rx.visit?.queueNumber && (
              <span className="text-xs text-gray-500">Queue #{rx.visit.queueNumber}</span>
            )}
          </div>
          <p className="text-sm font-bold text-gray-900 mt-1">{rx.patient.name}</p>
          <p className="text-xs text-gray-500">
            {rx.patient.phone} · {rx.patient.gender}
            {rx.patient.bloodGroup ? ` · ${rx.patient.bloodGroup}` : ""}
          </p>
          {rx.patient.allergies && (
            <p className="text-xs text-red-600 flex items-center gap-1 mt-0.5">
              <AlertTriangle className="w-3 h-3" /> Allergies: {rx.patient.allergies}
            </p>
          )}
        </div>
        <button onClick={onDone} className="p-1.5 rounded-lg hover:bg-orange-100 text-orange-400 flex-shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Doctor + date */}
        <p className="text-xs text-gray-500">
          Prescribed by Dr. {rx.doctor.user.name} · {formatDateTime(rx.createdAt)}
        </p>

        {/* Medicines */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Medicines</p>
          {rx.medicines.map(m => (
            <div key={m.id} className="flex items-start gap-3 p-3 bg-orange-50 rounded-xl border border-orange-100">
              <Package className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">
                  {m.name} <span className="text-gray-500 font-normal">{m.dosage}</span>
                </p>
                <p className="text-xs text-gray-600">{m.frequency} · {m.duration}</p>
                {m.instructions && <p className="text-xs text-gray-400 italic mt-0.5">{m.instructions}</p>}
              </div>
            </div>
          ))}
        </div>

        {rx.notes && (
          <div className="p-2 bg-gray-50 rounded-lg border border-gray-100">
            <p className="text-xs text-gray-500 font-medium">Doctor's notes:</p>
            <p className="text-xs text-gray-700 mt-0.5">{rx.notes}</p>
          </div>
        )}

        {alreadyDispensed ? (
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            Dispensed {rx.dispensation ? formatDateTime(rx.dispensation.dispensedAt) : ""} by {rx.dispensation?.pharmacist.user.name}
          </div>
        ) : (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dispensing Notes <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none bg-white"
                rows={2} placeholder="Any notes for the patient…"
                value={notes} onChange={e => setNotes(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={onDone}>Cancel</Button>
              <Button className="flex-1" loading={mutation.isPending} onClick={() => mutation.mutate()}
                icon={<CheckCircle className="w-4 h-4" />}>
                Confirm Dispensed
              </Button>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}

// ─── Pending queue (secondary view) ──────────────────────────────────────────

function PendingQueue({ onSelect }: { onSelect: (rx: Prescription) => void }) {
  const [open, setOpen] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["pharmacist-queue"],
    queryFn: async () => {
      const res = await fetch("/api/prescriptions?status=PENDING&limit=50");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 30_000,
    enabled: open,
  });

  const prescriptions: Prescription[] = data?.prescriptions ?? [];

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
        <span className="font-semibold text-gray-900 flex items-center gap-2 text-sm">
          <Clock className="w-4 h-4 text-orange-500" />
          Pending Queue
          {data?.total > 0 && (
            <span className="text-xs font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
              {data.total}
            </span>
          )}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
            className="overflow-hidden border-t border-gray-100">
            <div className="p-4 space-y-2">
              <div className="flex justify-end">
                <button onClick={() => refetch()} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
              {isLoading ? (
                <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}</div>
              ) : prescriptions.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No pending prescriptions</p>
              ) : (
                prescriptions.map(rx => (
                  <button key={rx.id} onClick={() => { onSelect(rx); setOpen(false); }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-orange-200 hover:bg-orange-50 transition-all text-left">
                    <div className="w-8 h-8 bg-orange-100 text-orange-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Pill className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900 truncate">{rx.patient.name}</p>
                        <span className="text-xs font-mono font-bold text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded flex-shrink-0">
                          {rx.code}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {rx.medicines.length} medicine{rx.medicines.length !== 1 ? "s" : ""} · Dr. {rx.doctor.user.name}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main pharmacist workflow ─────────────────────────────────────────────────

export function PharmacistWorkflow() {
  const [scanned, setScanned] = useState<Prescription | null>(null);

  return (
    <div className="space-y-4">
      {/* Code scanner — primary interface */}
      <CodeScanner onFound={setScanned} />

      {/* Scanned prescription detail */}
      <AnimatePresence>
        {scanned && (
          <PrescriptionDetail rx={scanned} onDone={() => setScanned(null)} />
        )}
      </AnimatePresence>

      {/* Pending queue — secondary, collapsible */}
      <PendingQueue onSelect={setScanned} />
    </div>
  );
}
