"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Stethoscope, ChevronDown, ChevronUp, FlaskConical,
  Pill, CheckCircle, RefreshCw, Clock, AlertTriangle,
  Plus, Trash2, Send,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { StatusBadge } from "@/components/ui/Badge";
import { cn, formatDateTime } from "@/lib/utils";
import toast from "react-hot-toast";

interface Medicine { name: string; dosage: string; frequency: string; duration: string; instructions: string }
interface LabResult { result: string; normalRange?: string; interpretation?: string }
interface LabRequest { id: string; testName: string; testType: string; urgency: string; status: string; labResult?: LabResult }
interface Visit {
  id: string; queueNumber?: number; status: string; visitType: string;
  chiefComplaint?: string; triageNotes?: string; createdAt: string;
  patient: { id: string; name: string; phone: string; gender: string; bloodGroup?: string; allergies?: string; dischargeDocument?: string };
  nurse?: { user: { name: string } };
  vitals?: { temperature?: string; bloodPressure?: string; heartRate?: string; oxygenSat?: string; weight?: string; height?: string };
  labRequests?: LabRequest[];
}

const EMPTY_MED: Medicine = { name: "", dosage: "", frequency: "", duration: "", instructions: "" };

// ─── Prescription writer ──────────────────────────────────────────────────────
function PrescriptionWriter({ visit, onSent }: { visit: Visit; onSent: () => void }) {
  const qc = useQueryClient();
  const [medicines, setMedicines] = useState<Medicine[]>([{ ...EMPTY_MED }]);
  const [notes, setNotes] = useState("");

  const setMed = (i: number, k: keyof Medicine, v: string) =>
    setMedicines(ms => ms.map((m, idx) => idx === i ? { ...m, [k]: v } : m));

  const addMed = () => setMedicines(ms => [...ms, { ...EMPTY_MED }]);
  const removeMed = (i: number) => setMedicines(ms => ms.filter((_, idx) => idx !== i));

  const mutation = useMutation({
    mutationFn: async () => {
      const valid = medicines.filter(m => m.name.trim() && m.dosage.trim() && m.frequency.trim() && m.duration.trim());
      if (valid.length === 0) throw new Error("Add at least one complete medicine");
      const res = await fetch("/api/prescriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: visit.patient.id, visitId: visit.id, notes, medicines: valid }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Failed"); }
      return res.json();
    },
    onSuccess: (data) => {
      const code = data.prescription?.code;
      toast.success(code ? `Prescription sent to pharmacy — Code: ${code}` : "Prescription sent to pharmacy");
      qc.invalidateQueries({ queryKey: ["doctor-queue"] });
      onSent();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="mt-3 p-3 bg-orange-50 rounded-xl border border-orange-100 space-y-3">
      <p className="text-xs font-semibold text-orange-700 flex items-center gap-1">
        <Pill className="w-3.5 h-3.5" /> Write Prescription
      </p>

      {medicines.map((m, i) => (
        <div key={i} className="bg-white rounded-xl border border-orange-100 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-600">Medicine {i + 1}</p>
            {medicines.length > 1 && (
              <button onClick={() => removeMed(i)} className="text-red-400 hover:text-red-600 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input label="Name *" placeholder="e.g. Amoxicillin" value={m.name} onChange={e => setMed(i, "name", e.target.value)} />
            <Input label="Dosage *" placeholder="e.g. 500mg" value={m.dosage} onChange={e => setMed(i, "dosage", e.target.value)} />
            <Input label="Frequency *" placeholder="e.g. TID" value={m.frequency} onChange={e => setMed(i, "frequency", e.target.value)} />
            <Input label="Duration *" placeholder="e.g. 7 days" value={m.duration} onChange={e => setMed(i, "duration", e.target.value)} />
            <div className="col-span-2">
              <Input label="Instructions" placeholder="e.g. Take after meals" value={m.instructions} onChange={e => setMed(i, "instructions", e.target.value)} />
            </div>
          </div>
        </div>
      ))}

      <button onClick={addMed} className="flex items-center gap-1 text-xs text-orange-700 font-medium hover:text-orange-800 transition-colors">
        <Plus className="w-3.5 h-3.5" /> Add another medicine
      </button>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Prescription Notes</label>
        <textarea className="w-full px-3 py-2 border border-orange-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none bg-white"
          rows={2} placeholder="Additional instructions for pharmacist…" value={notes} onChange={e => setNotes(e.target.value)} />
      </div>

      <div className="flex gap-2">
        <Button variant="secondary" size="sm" className="flex-1" onClick={onSent}>Cancel</Button>
        <Button size="sm" className="flex-1" loading={mutation.isPending} onClick={() => mutation.mutate()}
          icon={<Send className="w-3.5 h-3.5" />}>
          Send to Pharmacy
        </Button>
      </div>
    </div>
  );
}

// ─── Lab Technician picker ────────────────────────────────────────────────────
function LabTechPicker({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["lab-techs-for-request"],
    queryFn: async () => {
      const res = await fetch("/api/lab-technicians");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  const techs = data?.technicians ?? [];

  if (isLoading) return (
    <div className="grid grid-cols-2 gap-2">
      {[1,2].map(i => <div key={i} className="h-16 bg-cyan-100 rounded-xl animate-pulse" />)}
    </div>
  );

  if (isError) return (
    <div className="text-center py-3 text-xs text-red-500">
      Failed to load technicians.{" "}
      <button onClick={() => refetch()} className="underline">Retry</button>
    </div>
  );

  if (techs.length === 0) return (
    <p className="text-xs text-gray-400 text-center py-2">No lab technicians registered</p>
  );

  return (
    <div className="grid grid-cols-2 gap-2">
      {techs.map((t: any) => {
        const isBusy = t.busy;
        const isSelected = selected === t.id;
        const initials = t.user.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
        return (
          <button
            key={t.id}
            disabled={isBusy}
            onClick={() => !isBusy && onSelect(isSelected ? "" : t.id)}
            className={`relative text-left rounded-xl border-2 overflow-hidden transition-all ${
              isSelected ? "border-cyan-500 bg-cyan-50 shadow-sm"
              : isBusy ? "border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed"
              : "border-gray-100 bg-white hover:border-cyan-300 cursor-pointer"
            }`}
          >
            <div className={`h-1 w-full ${isSelected ? "bg-cyan-500" : isBusy ? "bg-red-400" : "bg-green-400"}`} />
            <div className="p-2.5 flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                isSelected ? "bg-cyan-100 text-cyan-700" : isBusy ? "bg-red-100 text-red-600" : "bg-green-100 text-green-700"
              }`}>
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-900 truncate">{t.user.name}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    isBusy ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                  }`}>
                    {isBusy ? "Busy" : "Available"}
                  </span>
                  {t.resultsToday > 0 && (
                    <span className="text-[10px] text-gray-400">{t.resultsToday} today</span>
                  )}
                </div>
              </div>
              {isSelected && <CheckCircle className="w-3.5 h-3.5 text-cyan-600 flex-shrink-0" />}
            </div>
          </button>
        );
      })}
    </div>
  );
}


function ConsultationForm({ visit, onDone }: { visit: Visit; onDone: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ diagnosis: "", symptoms: "", treatment: "", consultationNotes: "", dischargeNotes: "", followUpDate: "", admitPatient: false });
  const [labForm, setLabForm] = useState({ testName: "", testType: "", urgency: "ROUTINE" });
  const [labTechId, setLabTechId] = useState("");
  const [showLab, setShowLab] = useState(false);
  const [showRx, setShowRx] = useState(false);
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const consultMutation = useMutation({
    mutationFn: async () => {
      if (!form.diagnosis.trim()) throw new Error("Diagnosis is required");
      const res = await fetch(`/api/visits/${visit.id}/consult`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      toast.success(form.admitPatient ? "Patient admitted" : "Consultation completed");
      qc.invalidateQueries({ queryKey: ["doctor-queue"] });
      onDone();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const labMutation = useMutation({
    mutationFn: async () => {
      if (!labForm.testName.trim()) throw new Error("Test name required");
      const res = await fetch("/api/lab-requests", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...labForm, patientId: visit.patient.id, visitId: visit.id, labTechnicianId: labTechId || undefined }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Lab test requested");
      setLabForm({ testName: "", testType: "", urgency: "ROUTINE" });
      setShowLab(false);
      qc.invalidateQueries({ queryKey: ["doctor-queue"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const hasLabResults = (visit.labRequests ?? []).some(r => r.labResult);

  return (
    <div className="border-t border-gray-100 pt-4 mt-2 space-y-4">
      {/* Discharge document */}
      <div className="rounded-xl border-2 border-amber-300 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 bg-amber-100 border-b border-amber-300">
          <p className="text-xs font-bold text-amber-900">📋 Past Clinical History</p>
          {visit.patient?.dischargeDocument && (
            <button
              onClick={() => navigator.clipboard.writeText(visit.patient.dischargeDocument ?? "").then(() => toast.success("Copied!"))}
              className="text-xs font-bold text-amber-800 hover:text-amber-950 bg-amber-200 hover:bg-amber-300 px-2 py-0.5 rounded-lg transition-colors"
            >
              Copy
            </button>
          )}
        </div>
        <pre className="px-3 py-3 text-xs whitespace-pre-wrap font-mono bg-amber-50 leading-relaxed min-h-[48px] max-h-52 overflow-y-auto text-gray-800">
          {visit.patient?.dischargeDocument || "Empty — no past clinical history on record for this patient."}
        </pre>
      </div>

      {/* Triage summary */}
      {(visit.vitals || visit.triageNotes) && (
        <div className="p-3 bg-green-50 rounded-xl border border-green-100 space-y-2">
          <p className="text-xs font-semibold text-green-700">Nurse Triage Summary</p>
          {visit.vitals && (
            <div className="grid grid-cols-3 gap-2">
              {[["Temp", visit.vitals.temperature], ["BP", visit.vitals.bloodPressure], ["HR", visit.vitals.heartRate],
                ["O₂", visit.vitals.oxygenSat], ["Weight", visit.vitals.weight], ["Height", visit.vitals.height]]
                .filter(([, v]) => v).map(([label, value]) => (
                  <div key={label} className="bg-white rounded-lg p-2 text-center border border-green-100">
                    <p className="text-xs text-gray-500">{label}</p>
                    <p className="text-sm font-semibold text-gray-900">{value}</p>
                  </div>
                ))}
            </div>
          )}
          {visit.triageNotes && <p className="text-xs text-green-800 italic">"{visit.triageNotes}"</p>}
        </div>
      )}

      {/* Lab results */}
      {hasLabResults && (
        <div className="p-3 bg-cyan-50 rounded-xl border border-cyan-100 space-y-2">
          <p className="text-xs font-semibold text-cyan-700 flex items-center gap-1"><FlaskConical className="w-3.5 h-3.5" /> Lab Results</p>
          {visit.labRequests?.filter((r): r is typeof r & { labResult: NonNullable<typeof r["labResult"]> } => r.labResult != null).map(r => (
            <div key={r.id} className="bg-white rounded-lg p-2 border border-cyan-100">
              <p className="text-xs font-semibold text-gray-900">{r.testName} <span className="text-gray-400">({r.testType})</span></p>
              <p className="text-xs text-gray-700 mt-0.5">Result: {r.labResult.result}</p>
              {r.labResult.normalRange && <p className="text-xs text-gray-500">Normal: {r.labResult.normalRange}</p>}
              {r.labResult.interpretation && <p className="text-xs text-blue-700 mt-0.5">{r.labResult.interpretation}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Diagnosis */}
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Consultation</p>
      <Input label="Diagnosis *" placeholder="Primary diagnosis" value={form.diagnosis} onChange={e => set("diagnosis", e.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Symptoms</label>
          <textarea className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none bg-white" rows={2}
            placeholder="Presenting symptoms…" value={form.symptoms} onChange={e => set("symptoms", e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Treatment Plan</label>
          <textarea className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none bg-white" rows={2}
            placeholder="Treatment prescribed…" value={form.treatment} onChange={e => set("treatment", e.target.value)} />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Consultation Notes</label>
        <textarea className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none bg-white" rows={2}
          placeholder="Additional notes…" value={form.consultationNotes} onChange={e => set("consultationNotes", e.target.value)} />
      </div>

      {/* Discharge notes */}
      <div className="border-t border-gray-100 pt-3 space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Discharge</p>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Discharge Notes / Instructions</label>
          <textarea className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none bg-white" rows={3}
            placeholder="Discharge instructions, follow-up advice, referral notes… (appended to patient's permanent record)"
            value={form.dischargeNotes} onChange={e => set("dischargeNotes", e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Follow-up Date</label>
          <input type="date" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            value={form.followUpDate} onChange={e => set("followUpDate", e.target.value)} />
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={form.admitPatient} onChange={e => set("admitPatient", e.target.checked)}
          className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
        <span className="text-sm text-gray-700">Admit patient</span>
      </label>

      {/* Quick actions row */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => { setShowRx(!showRx); setShowLab(false); }}
          className={cn("flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors",
            showRx ? "bg-orange-100 text-orange-700 border-orange-300" : "bg-white text-orange-600 border-orange-200 hover:bg-orange-50")}>
          <Pill className="w-4 h-4" /> {showRx ? "Hide Prescription" : "Write Prescription"}
        </button>
        <button onClick={() => { setShowLab(!showLab); setShowRx(false); }}
          className={cn("flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors",
            showLab ? "bg-cyan-100 text-cyan-700 border-cyan-300" : "bg-white text-cyan-600 border-cyan-200 hover:bg-cyan-50")}>
          <FlaskConical className="w-4 h-4" /> {showLab ? "Hide Lab Request" : "Request Lab Test"}
        </button>
      </div>

      {/* Prescription writer */}
      <AnimatePresence>
        {showRx && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <PrescriptionWriter visit={visit} onSent={() => setShowRx(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lab request */}
      <AnimatePresence>
        {showLab && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="p-3 bg-cyan-50 rounded-xl border border-cyan-100 space-y-3">
              <p className="text-xs font-semibold text-cyan-700 flex items-center gap-1"><FlaskConical className="w-3.5 h-3.5" /> Request Lab Test</p>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Test Name" placeholder="e.g. CBC" value={labForm.testName} onChange={e => setLabForm(f => ({ ...f, testName: e.target.value }))} />
                <Input label="Test Type" placeholder="e.g. Blood" value={labForm.testType} onChange={e => setLabForm(f => ({ ...f, testType: e.target.value }))} />
              </div>
              <select value={labForm.urgency} onChange={e => setLabForm(f => ({ ...f, urgency: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option value="ROUTINE">Routine</option>
                <option value="URGENT">Urgent</option>
                <option value="STAT">STAT</option>
              </select>
              {/* Lab technician picker */}
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1.5">Assign Lab Technician <span className="text-gray-400">(optional)</span></p>
                <LabTechPicker selected={labTechId} onSelect={setLabTechId} />
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" className="flex-1" onClick={() => setShowLab(false)}>Cancel</Button>
                <Button size="sm" className="flex-1" loading={labMutation.isPending} onClick={() => labMutation.mutate()} icon={<FlaskConical className="w-3.5 h-3.5" />}>
                  {labTechId ? "Request & Assign" : "Request"}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Complete */}
      <div className="flex gap-2 pt-1">
        <Button variant="secondary" className="flex-1" onClick={onDone}>Cancel</Button>
        <Button className="flex-1" loading={consultMutation.isPending} onClick={() => consultMutation.mutate()}
          icon={<CheckCircle className="w-4 h-4" />}>
          {form.admitPatient ? "Admit & Complete" : "Complete Consultation"}
        </Button>
      </div>
    </div>
  );
}

// ─── Doctor Workflow ──────────────────────────────────────────────────────────
export function DoctorWorkflow() {
  const [openId, setOpenId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["doctor-queue"],
    queryFn: async () => {
      const res = await fetch("/api/visits?limit=50");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 20_000,
  });

  const visits: Visit[] = (data?.visits ?? []).filter(
    (v: Visit) => ["WAITING_DOCTOR", "IN_CONSULTATION"].includes(v.status)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <Stethoscope className="w-4 h-4 text-blue-600" />
          Patient Queue
          {visits.length > 0 && (
            <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{visits.length} waiting</span>
          )}
        </h2>
        <button onClick={() => refetch()} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : visits.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Clock className="w-8 h-8 mx-auto mb-2 text-gray-200" />
          <p className="text-sm">No patients waiting for consultation</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visits.map(v => {
            const isOpen = openId === v.id;
            const hasLab = (v.labRequests ?? []).length > 0;
            const labDone = hasLab && (v.labRequests ?? []).every(r => r.status === "COMPLETED");
            return (
              <motion.div key={v.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <button onClick={() => setOpenId(isOpen ? null : v.id)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors">
                  <span className="text-xl font-black text-gray-200 w-8 text-center flex-shrink-0">#{v.queueNumber ?? "—"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900">{v.patient.name}</p>
                      {v.patient.allergies && (
                        <span className="text-xs text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                          <AlertTriangle className="w-3 h-3" /> {v.patient.allergies}
                        </span>
                      )}
                      {hasLab && (
                        <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-semibold",
                          labDone ? "bg-cyan-100 text-cyan-700" : "bg-yellow-100 text-yellow-700")}>
                          {labDone ? "Lab ✓" : "Lab pending"}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {v.patient.gender}{v.patient.bloodGroup ? ` · ${v.patient.bloodGroup}` : ""}
                      {v.chiefComplaint ? ` · ${v.chiefComplaint}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={v.status} />
                  {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden px-4 pb-4">
                      <ConsultationForm visit={v} onDone={() => setOpenId(null)} />
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
