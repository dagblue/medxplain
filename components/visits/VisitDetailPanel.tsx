"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { useSession } from "@/lib/auth-client";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  triageSchema, assignNurseSchema, assignDoctorSchema, consultationSchema,
  TriageInput, AssignNurseInput, AssignDoctorInput, ConsultationInput,
} from "@/lib/validations";
import {
  X, User, Heart, Stethoscope, FlaskConical, Pill,
  CheckCircle, ChevronRight, AlertTriangle, Clock,
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import toast from "react-hot-toast";
import { TriageTicket, TicketData } from "./TriageTicket";

interface VisitDetailPanelProps {
  visitId: string;
  onClose: () => void;
  onUpdate: () => void;
}

async function fetchVisit(id: string) {
  const res = await fetch(`/api/visits/${id}`);
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

async function fetchNurses() {
  const res = await fetch("/api/users?role=NURSE&limit=50");
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

async function fetchDoctors() {
  const res = await fetch("/api/doctors?limit=50");
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

// ── Step indicator ────────────────────────────────────────────────────────────
const STEPS = [
  { key: "WAITING_TRIAGE", label: "Triage Queue" },
  { key: "IN_TRIAGE", label: "Triaging" },
  { key: "WAITING_DOCTOR", label: "Doctor Queue" },
  { key: "IN_CONSULTATION", label: "Consulting" },
  { key: "COMPLETED", label: "Done" },
];

function StepBar({ status }: { status: string }) {
  const currentIdx = STEPS.findIndex((s) => s.key === status);
  return (
    <div className="flex items-center gap-1 mb-4">
      {STEPS.map((step, i) => (
        <div key={step.key} className="flex items-center gap-1 flex-1">
          <div className={`flex-1 h-1.5 rounded-full transition-colors ${
            i <= currentIdx ? "bg-blue-500" : "bg-gray-200"
          }`} />
          {i < STEPS.length - 1 && <ChevronRight className="w-3 h-3 text-gray-300 flex-shrink-0" />}
        </div>
      ))}
    </div>
  );
}

export function VisitDetailPanel({ visitId, onClose, onUpdate }: VisitDetailPanelProps) {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const role = session?.user?.role as string;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["visit", visitId],
    queryFn: () => fetchVisit(visitId),
    refetchInterval: 10000,
  });

  const { data: nurseData } = useQuery({ queryKey: ["nurses-list"], queryFn: fetchNurses });
  const { data: doctorData } = useQuery({ queryKey: ["doctors-list"], queryFn: fetchDoctors });

  const visit = data?.visit;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["visit", visitId] });
    onUpdate();
  };

  if (isLoading) return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6 space-y-4">
      {[1,2,3,4].map(i => <Skeleton key={i} className="h-12" />)}
    </div>
  );

  if (!visit) return null;

  const nurseOptions = nurseData?.users?.map((u: any) => ({ value: u.id, label: u.name })) ?? [];
  const doctorOptions = doctorData?.doctors?.map((d: any) => ({
    value: d.id,
    label: `Dr. ${d.user?.name} — ${d.specialization}`,
  })) ?? [];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden flex flex-col max-h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-gray-900">{visit.patient?.name}</h3>
            <StatusBadge status={visit.status} />
          </div>
          <p className="text-xs text-gray-500">{visit.patient?.phone} · {visit.patient?.gender}</p>
          {visit.patient?.allergies && (
            <p className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5">
              <AlertTriangle className="w-3 h-3" /> {visit.patient.allergies}
            </p>
          )}
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress */}
      {visit.status !== "CANCELLED" && (
        <div className="px-5 pt-4">
          <StepBar status={visit.status} />
        </div>
      )}

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-4">

        {/* Visit info */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-gray-50 rounded-lg p-2">
            <p className="text-gray-400">Type</p>
            <p className="font-semibold text-gray-700">{visit.visitType === "WALK_IN" ? "Walk-in" : "Online"}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2">
            <p className="text-gray-400">Arrived</p>
            <p className="font-semibold text-gray-700">{formatDateTime(visit.createdAt)}</p>
          </div>
          {visit.chiefComplaint && (
            <div className="col-span-2 bg-blue-50 rounded-lg p-2">
              <p className="text-blue-400">Chief Complaint</p>
              <p className="font-semibold text-blue-800">{visit.chiefComplaint}</p>
            </div>
          )}
        </div>

        {/* ── STEP 3: Assign Nurse ── */}
        {visit.status === "WAITING_TRIAGE" && ["ADMIN", "RECEPTIONIST", "NURSE"].includes(role) && (
          <AssignNurseSection visitId={visitId} nurseOptions={nurseOptions} onDone={invalidate} />
        )}

        {/* ── STEP 4: Triage ── */}
        {visit.status === "IN_TRIAGE" && ["ADMIN", "NURSE"].includes(role) && (
          <TriageSection visitId={visitId} visit={visit} onDone={invalidate} />
        )}

        {/* Show vitals if recorded */}
        {visit.vitals && <VitalsDisplay vitals={visit.vitals} />}

        {/* ── Past Discharge Document ── */}
        {visit.patient?.dischargeDocument && (
          <div className="rounded-xl border border-amber-200 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-amber-50 border-b border-amber-200">
              <p className="text-xs font-bold text-amber-800">📋 Past Clinical History</p>
              <button
                onClick={() => navigator.clipboard.writeText(visit.patient.dischargeDocument).then(() => toast.success("Copied!"))}
                className="text-xs font-semibold text-amber-700 hover:text-amber-900 bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded-lg transition-colors"
              >
                Copy
              </button>
            </div>
            <pre className="px-3 py-3 text-xs text-gray-700 whitespace-pre-wrap font-mono bg-white leading-relaxed max-h-56 overflow-y-auto">
              {visit.patient.dischargeDocument}
            </pre>
          </div>
        )}

        {/* ── STEP 6: Assign Doctor ── */}
        {visit.status === "WAITING_DOCTOR" && ["ADMIN", "RECEPTIONIST"].includes(role) && (
          <AssignDoctorSection visitId={visitId} doctorOptions={doctorOptions} onDone={invalidate} />
        )}

        {/* ── STEP 7: Consultation ── */}
        {visit.status === "IN_CONSULTATION" && ["ADMIN", "DOCTOR"].includes(role) && (
          <>
            {/* Discharge document — always visible for doctor BEFORE the form */}
            <div className="rounded-xl border-2 border-amber-300 overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-4 py-3 bg-amber-100 border-b-2 border-amber-300">
                <div className="flex items-center gap-2">
                  <span className="text-base">📋</span>
                  <p className="text-sm font-bold text-amber-900">Patient Discharge Document</p>
                </div>
                {visit.patient?.dischargeDocument && (
                  <button
                    onClick={() => navigator.clipboard.writeText(visit.patient.dischargeDocument).then(() => toast.success("Copied!"))}
                    className="text-xs font-bold text-amber-800 hover:text-amber-950 bg-amber-200 hover:bg-amber-300 px-3 py-1 rounded-lg transition-colors"
                  >
                    Copy All
                  </button>
                )}
              </div>
              <pre className="px-4 py-4 text-xs whitespace-pre-wrap font-mono bg-amber-50 leading-relaxed min-h-[60px] max-h-64 overflow-y-auto text-gray-800">
                {visit.patient?.dischargeDocument || "Empty — no past clinical history on record for this patient."}
              </pre>
            </div>
            <ConsultationSection visitId={visitId} visit={visit} onDone={invalidate} />
          </>
        )}

        {/* Show medical record if done */}
        {visit.medicalRecord && <MedicalRecordDisplay record={visit.medicalRecord} />}

        {/* Lab requests */}
        {visit.labRequests?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
              <FlaskConical className="w-3.5 h-3.5" /> Lab Requests
            </p>
            <div className="space-y-1.5">
              {visit.labRequests.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium">{r.testName}</p>
                    {r.labResult && <p className="text-xs text-gray-500 mt-0.5">Result: {r.labResult.result}</p>}
                  </div>
                  <StatusBadge status={r.status} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Prescriptions */}
        {visit.prescriptions?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
              <Pill className="w-3.5 h-3.5" /> Prescriptions
            </p>
            <div className="space-y-1.5">
              {visit.prescriptions.map((rx: any) => (
                <div key={rx.id} className="p-2.5 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-gray-500">Dr. {rx.doctor?.user?.name}</p>
                    <StatusBadge status={rx.status} />
                  </div>
                  {rx.medicines?.map((m: any) => (
                    <p key={m.id} className="text-xs text-gray-700">{m.name} — {m.dosage} × {m.frequency}</p>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Completed */}
        {visit.status === "COMPLETED" && (
          <div className="flex items-center gap-2 p-3 bg-green-50 rounded-xl">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-green-800">Visit Completed</p>
              {visit.completedAt && (
                <p className="text-xs text-green-600">{formatDateTime(visit.completedAt)}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-sections ──────────────────────────────────────────────────────────────

function AssignNurseSection({ visitId, nurseOptions, onDone }: { visitId: string; nurseOptions: any[]; onDone: () => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<AssignNurseInput>({ resolver: zodResolver(assignNurseSchema) });
  const [ticket, setTicket] = useState<TicketData | null>(null);

  const mutation = useMutation({
    mutationFn: async (data: AssignNurseInput) => {
      const res = await fetch(`/api/visits/${visitId}/assign-nurse`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (data) => {
      toast.success("Nurse assigned — visit in triage");
      const v = data.visit;
      setTicket({
        queueNumber:    v.queueNumber,
        patientName:    v.patient?.name ?? "—",
        patientId:      v.patient?.id ?? visitId,
        nurseName:      v.nurse?.user?.name ?? "—",
        chiefComplaint: v.chiefComplaint,
        visitType:      v.visitType ?? "WALK_IN",
        createdAt:      v.createdAt ?? new Date().toISOString(),
      });
      onDone();
    },
    onError: () => toast.error("Failed to assign nurse"),
  });

  return (
    <>
      <div className="p-4 bg-orange-50 rounded-xl border border-orange-100">
        <p className="text-sm font-semibold text-orange-800 mb-3 flex items-center gap-1.5">
          <Heart className="w-4 h-4" /> Assign Nurse for Triage
        </p>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="flex gap-2">
          <Select options={nurseOptions} placeholder="Select nurse" error={errors.nurseId?.message} className="flex-1" {...register("nurseId")} />
          <Button type="submit" size="sm" loading={mutation.isPending}>Assign</Button>
        </form>
      </div>
      <TriageTicket ticket={ticket} onClose={() => setTicket(null)} />
    </>
  );
}

// ── Minor case discharge ticket printer ──────────────────────────────────────
function printMinorCaseTicket(visit: any, prescription: any, diagnosis: string, treatment: string, summaryText: string) {
  const win = window.open("", "_blank", "width=500,height=700");
  if (!win) return;
  const now = new Date().toLocaleString();
  const medicines = prescription?.medicines ?? [];

  win.document.write(`<!DOCTYPE html>
<html><head><title>Minor Case Discharge</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Courier New',monospace; width:80mm; padding:8mm; font-size:12px; color:#000; }
  .center { text-align:center; }
  .bold { font-weight:bold; }
  .divider { border-top:1px dashed #000; margin:6px 0; }
  .hospital { font-size:16px; font-weight:900; text-align:center; letter-spacing:1px; }
  .subtitle { font-size:10px; text-align:center; color:#555; margin-bottom:2px; }
  .title { font-size:13px; font-weight:bold; text-align:center; margin:4px 0; }
  .label { font-size:10px; color:#555; text-transform:uppercase; letter-spacing:0.5px; margin-top:5px; }
  .value { font-size:12px; font-weight:bold; margin-bottom:2px; }
  .medicine { padding:3px 0; border-bottom:1px dotted #ccc; font-size:11px; }
  .footer { font-size:9px; text-align:center; color:#888; margin-top:8px; }
  .badge { display:inline-block; background:#000; color:#fff; font-size:10px; font-weight:bold; padding:2px 8px; border-radius:4px; margin:4px 0; }
  @media print { body { width:80mm; } }
</style></head><body>
  <p class="hospital">MedXplain</p>
  <p class="subtitle">Hospital Management System</p>
  <div class="divider"></div>
  <p class="title">⚕ MINOR CASE DISCHARGE</p>
  <div class="divider"></div>

  <p class="label">Patient</p>
  <p class="value">${visit?.patient?.name ?? "—"}</p>
  <p class="label">Patient ID (FAN)</p>
  <p class="value">${visit?.patient?.id ?? "—"}</p>
  <p class="label">Queue #</p>
  <p class="value">${visit?.queueNumber ?? "—"}</p>

  <div class="divider"></div>

  <p class="label">Diagnosis</p>
  <p class="value">${diagnosis}</p>
  ${treatment ? `<p class="label">Treatment</p><p class="value">${treatment}</p>` : ""}

  <div class="divider"></div>

  <p class="label">Prescribed Medicines</p>
  ${medicines.map((m: any, i: number) => `
    <div class="medicine">
      <b>${i + 1}. ${m.name}</b><br>
      Dose: ${m.dosage} &nbsp;|&nbsp; ${m.frequency}<br>
      Duration: ${m.duration}
      ${m.instructions ? `<br><i>${m.instructions}</i>` : ""}
    </div>`).join("")}

  <div class="divider"></div>
  <p class="label">Rx Code</p>
  <div class="badge">${prescription?.code ?? "—"}</div>

  <div class="divider"></div>
  <p class="label">Date &amp; Time</p>
  <p class="value">${now}</p>

  <div class="divider"></div>
  <p class="footer">This is a minor case discharge summary.</p>
  <p class="footer">Please follow the prescribed treatment.</p>
  <p class="footer">Return if symptoms worsen.</p>
</body></html>`);
  win.document.close();
  win.focus();
  win.print();
  win.close();
}

// ── Minor Case Section ────────────────────────────────────────────────────────
function MinorCaseSection({ visitId, visit, onDone }: { visitId: string; visit: any; onDone: () => void }) {
  const [medicines, setMedicines] = useState([{ name: "", dosage: "", frequency: "", duration: "", instructions: "" }]);
  const [diagnosis, setDiagnosis] = useState("");
  const [treatment, setTreatment] = useState("");
  const [dischargeSummary, setDischargeSummary] = useState("");
  const [temperature, setTemperature] = useState("");
  const [bloodPressure, setBloodPressure] = useState("");
  const [heartRate, setHeartRate] = useState("");
  const [oxygenSat, setOxygenSat] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [triageNotes, setTriageNotes] = useState("");

  const addMedicine = () => setMedicines(m => [...m, { name: "", dosage: "", frequency: "", duration: "", instructions: "" }]);
  const removeMedicine = (i: number) => setMedicines(m => m.filter((_, idx) => idx !== i));
  const updateMedicine = (i: number, field: string, value: string) =>
    setMedicines(m => m.map((med, idx) => idx === i ? { ...med, [field]: value } : med));

  const mutation = useMutation({
    mutationFn: async () => {
      const validMeds = medicines.filter(m => m.name && m.dosage && m.frequency && m.duration);
      if (!diagnosis.trim()) throw new Error("Diagnosis is required");
      if (validMeds.length === 0) throw new Error("At least one complete medicine is required");

      const res = await fetch(`/api/visits/${visitId}/minor-case`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          diagnosis, treatment, dischargeSummary,
          medicines: validMeds,
          temperature, bloodPressure, heartRate, oxygenSat, weight, height, triageNotes,
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Failed"); }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success("Minor case handled — patient discharged");
      printMinorCaseTicket(data.visit, data.prescription, diagnosis, treatment, data.summaryText);
      onDone();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <div className="p-4 bg-teal-50 rounded-xl border border-teal-200 space-y-4">
      <p className="text-sm font-bold text-teal-800 flex items-center gap-1.5">
        <Pill className="w-4 h-4" /> Minor Case — Prescribe &amp; Discharge
      </p>

      {/* Vitals */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Vitals</p>
        <div className="grid grid-cols-2 gap-2">
          <Input label="Temperature (°C)" placeholder="36.6" value={temperature} onChange={e => setTemperature(e.target.value)} />
          <Input label="Blood Pressure" placeholder="120/80" value={bloodPressure} onChange={e => setBloodPressure(e.target.value)} />
          <Input label="Heart Rate (bpm)" placeholder="72" value={heartRate} onChange={e => setHeartRate(e.target.value)} />
          <Input label="O₂ Saturation (%)" placeholder="98" value={oxygenSat} onChange={e => setOxygenSat(e.target.value)} />
          <Input label="Weight (kg)" placeholder="70" value={weight} onChange={e => setWeight(e.target.value)} />
          <Input label="Height (cm)" placeholder="175" value={height} onChange={e => setHeight(e.target.value)} />
        </div>
      </div>

      {/* Diagnosis */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Diagnosis &amp; Treatment</p>
        <div className="space-y-2">
          <div>
            <label className="label">Diagnosis <span className="text-red-500">*</span></label>
            <input className="input" placeholder="e.g. Upper respiratory tract infection" value={diagnosis} onChange={e => setDiagnosis(e.target.value)} />
          </div>
          <div>
            <label className="label">Treatment Plan</label>
            <textarea className="input resize-none" rows={2} placeholder="e.g. Rest, fluids, antipyretics..." value={treatment} onChange={e => setTreatment(e.target.value)} />
          </div>
          <div>
            <label className="label">Triage Notes</label>
            <textarea className="input resize-none" rows={2} placeholder="Observations during triage..." value={triageNotes} onChange={e => setTriageNotes(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Medicines */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Medicines <span className="text-red-500">*</span></p>
          <button type="button" onClick={addMedicine} className="text-xs text-teal-700 font-semibold hover:underline flex items-center gap-1">
            + Add Medicine
          </button>
        </div>
        <div className="space-y-3">
          {medicines.map((med, i) => (
            <div key={i} className="p-3 bg-white rounded-xl border border-teal-100 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-teal-700">Medicine {i + 1}</p>
                {medicines.length > 1 && (
                  <button type="button" onClick={() => removeMedicine(i)} className="text-xs text-red-500 hover:underline">Remove</button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input label="Name *" placeholder="e.g. Paracetamol" value={med.name} onChange={e => updateMedicine(i, "name", e.target.value)} />
                <Input label="Dosage *" placeholder="e.g. 500mg" value={med.dosage} onChange={e => updateMedicine(i, "dosage", e.target.value)} />
                <Input label="Frequency *" placeholder="e.g. 3x daily" value={med.frequency} onChange={e => updateMedicine(i, "frequency", e.target.value)} />
                <Input label="Duration *" placeholder="e.g. 5 days" value={med.duration} onChange={e => updateMedicine(i, "duration", e.target.value)} />
              </div>
              <Input label="Instructions" placeholder="e.g. Take after meals" value={med.instructions} onChange={e => updateMedicine(i, "instructions", e.target.value)} />
            </div>
          ))}
        </div>
      </div>

      {/* Discharge summary */}
      <div>
        <label className="label">Discharge Summary / Additional Notes</label>
        <textarea
          className="input resize-none font-mono text-xs"
          rows={3}
          placeholder="Additional discharge instructions, follow-up advice, referral notes..."
          value={dischargeSummary}
          onChange={e => setDischargeSummary(e.target.value)}
        />
        <p className="text-xs text-gray-400 mt-1">This will be saved to the patient's clinical history.</p>
      </div>

      <Button
        className="w-full justify-center"
        loading={mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        <Pill className="w-4 h-4 mr-1.5" /> Save &amp; Print Discharge Ticket
      </Button>
    </div>
  );
}

function TriageSection({ visitId, visit, onDone }: { visitId: string; visit: any; onDone: () => void }) {
  const [mode, setMode] = useState<"normal" | "minor">("normal");
  const [requiresDoctor, setRequiresDoctor] = useState(false);
  const { register, handleSubmit } = useForm<TriageInput>({ resolver: zodResolver(triageSchema) });

  const mutation = useMutation({
    mutationFn: async (data: TriageInput) => {
      const res = await fetch(`/api/visits/${visitId}/triage`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, requiresDoctor }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      toast.success(requiresDoctor ? "Triage done — patient waiting for doctor" : "Visit completed at triage");
      onDone();
    },
    onError: () => toast.error("Failed to submit triage"),
  });

  return (
    <div className="space-y-3">
      {/* Mode selector */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("normal")}
          className={`flex-1 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
            mode === "normal" ? "border-yellow-500 bg-yellow-50 text-yellow-800" : "border-gray-200 text-gray-500 hover:border-gray-300"
          }`}
        >
          🩺 Standard Triage
        </button>
        <button
          type="button"
          onClick={() => setMode("minor")}
          className={`flex-1 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
            mode === "minor" ? "border-teal-500 bg-teal-50 text-teal-800" : "border-gray-200 text-gray-500 hover:border-gray-300"
          }`}
        >
          💊 Minor Case
        </button>
      </div>

      {mode === "minor" ? (
        <MinorCaseSection visitId={visitId} visit={visit} onDone={onDone} />
      ) : (
        <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-100">
          <p className="text-sm font-semibold text-yellow-800 mb-3 flex items-center gap-1.5">
            <Heart className="w-4 h-4" /> Triage Assessment
          </p>
          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Input label="Temperature (°C)" placeholder="36.6" {...register("temperature")} />
              <Input label="Blood Pressure" placeholder="120/80" {...register("bloodPressure")} />
              <Input label="Heart Rate (bpm)" placeholder="72" {...register("heartRate")} />
              <Input label="O₂ Saturation (%)" placeholder="98" {...register("oxygenSat")} />
              <Input label="Weight (kg)" placeholder="70" {...register("weight")} />
              <Input label="Height (cm)" placeholder="175" {...register("height")} />
            </div>
            <div>
              <label className="label">Triage Notes</label>
              <textarea className="input resize-none" rows={2} placeholder="Observations..." {...register("triageNotes")} />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setRequiresDoctor(false)}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                  !requiresDoctor ? "border-green-500 bg-green-50 text-green-700" : "border-gray-200 text-gray-500"
                }`}
              >
                ✓ Complete (no doctor)
              </button>
              <button
                type="button"
                onClick={() => setRequiresDoctor(true)}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                  requiresDoctor ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-500"
                }`}
              >
                → Send to Doctor
              </button>
            </div>
            <Button type="submit" className="w-full justify-center" loading={mutation.isPending}>
              {requiresDoctor ? "Complete Triage → Doctor Queue" : "Complete Visit"}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}

function AssignDoctorSection({ visitId, doctorOptions, onDone }: { visitId: string; doctorOptions: any[]; onDone: () => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<AssignDoctorInput>({ resolver: zodResolver(assignDoctorSchema) });
  const mutation = useMutation({
    mutationFn: async (data: AssignDoctorInput) => {
      const res = await fetch(`/api/visits/${visitId}/assign-doctor`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => { toast.success("Doctor assigned — visit in consultation"); onDone(); },
    onError: () => toast.error("Failed to assign doctor"),
  });

  return (
    <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
      <p className="text-sm font-semibold text-purple-800 mb-3 flex items-center gap-1.5">
        <Stethoscope className="w-4 h-4" /> Assign Doctor
      </p>
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="flex gap-2">
        <Select options={doctorOptions} placeholder="Select doctor" error={errors.doctorId?.message} className="flex-1" {...register("doctorId")} />
        <Button type="submit" size="sm" loading={mutation.isPending}>Assign</Button>
      </form>
    </div>
  );
}

function ConsultationSection({ visitId, visit, onDone }: { visitId: string; visit: any; onDone: () => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<ConsultationInput>({ resolver: zodResolver(consultationSchema) });

  const mutation = useMutation({
    mutationFn: async (data: ConsultationInput) => {
      const res = await fetch(`/api/visits/${visitId}/consult`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => { toast.success("Consultation complete — visit closed"); onDone(); },
    onError: () => toast.error("Failed to complete consultation"),
  });

  const pastHistory = visit.patient?.dischargeDocument;

  return (
    <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 space-y-4">
      <p className="text-sm font-semibold text-blue-800 flex items-center gap-1.5">
        <Stethoscope className="w-4 h-4" /> Doctor Consultation
      </p>

      {/* Past clinical history — always visible */}
      <div className="rounded-xl border border-amber-200 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 bg-amber-50 border-b border-amber-200">
          <p className="text-xs font-bold text-amber-800">📋 Past Clinical History</p>
          {pastHistory && (
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(pastHistory).then(() => toast.success("Copied!"))}
              className="text-xs font-semibold text-amber-700 hover:text-amber-900 bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded-lg transition-colors"
            >
              Copy
            </button>
          )}
        </div>
        <pre className="px-3 py-3 text-xs whitespace-pre-wrap font-mono bg-white leading-relaxed max-h-56 overflow-y-auto text-gray-700">
          {pastHistory || "Empty — no past clinical history on record for this patient."}
        </pre>
      </div>

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-3">
        <Input label="Diagnosis *" placeholder="Primary diagnosis" error={errors.diagnosis?.message} {...register("diagnosis")} />
        <div>
          <label className="label">Symptoms</label>
          <textarea className="input resize-none" rows={2} placeholder="Patient symptoms..." {...register("symptoms")} />
        </div>
        <div>
          <label className="label">Treatment Plan</label>
          <textarea className="input resize-none" rows={2} placeholder="Treatment prescribed..." {...register("treatment")} />
        </div>
        <div>
          <label className="label">Consultation Notes</label>
          <textarea className="input resize-none" rows={2} placeholder="Additional notes..." {...register("consultationNotes")} />
        </div>

        {/* Discharge section */}
        <div className="border-t border-blue-200 pt-3 space-y-3">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Discharge</p>
          <div>
            <label className="label">Discharge Notes / Instructions</label>
            <textarea
              className="input resize-none"
              rows={3}
              placeholder="Discharge instructions, follow-up advice, referral notes... (saved to patient's permanent record)"
              {...register("dischargeNotes")}
            />
          </div>
          <div>
            <label className="label">Follow-up Date</label>
            <input type="date" className="input" {...register("followUpDate")} />
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" className="w-4 h-4 rounded text-blue-600" {...register("admitPatient")} />
          <span className="text-sm font-medium text-gray-700">Admit patient to hospital</span>
        </label>
        <Button type="submit" className="w-full justify-center" loading={mutation.isPending}>
          Complete Consultation &amp; Close Visit
        </Button>
      </form>
    </div>
  );
}

function VitalsDisplay({ vitals }: { vitals: any }) {
  const items = [
    { label: "BP", value: vitals.bloodPressure },
    { label: "HR", value: vitals.heartRate ? `${vitals.heartRate} bpm` : null },
    { label: "Temp", value: vitals.temperature ? `${vitals.temperature}°C` : null },
    { label: "O₂", value: vitals.oxygenSat ? `${vitals.oxygenSat}%` : null },
    { label: "Weight", value: vitals.weight ? `${vitals.weight} kg` : null },
    { label: "Height", value: vitals.height ? `${vitals.height} cm` : null },
  ].filter((i) => i.value);

  if (!items.length) return null;

  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
        <Heart className="w-3.5 h-3.5" /> Vitals
      </p>
      <div className="grid grid-cols-3 gap-1.5">
        {items.map((item) => (
          <div key={item.label} className="bg-gray-50 rounded-lg p-2 text-center">
            <p className="text-xs text-gray-400">{item.label}</p>
            <p className="text-sm font-bold text-gray-800">{item.value}</p>
          </div>
        ))}
      </div>
      {vitals.notes && <p className="text-xs text-gray-500 mt-2 italic">{vitals.notes}</p>}
    </div>
  );
}

function MedicalRecordDisplay({ record }: { record: any }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
        <Stethoscope className="w-3.5 h-3.5" /> Diagnosis
      </p>
      <div className="p-3 bg-gray-50 rounded-xl space-y-1.5">
        <p className="text-sm font-bold text-gray-900">{record.diagnosis}</p>
        {record.symptoms && <p className="text-xs text-gray-600">Symptoms: {record.symptoms}</p>}
        {record.treatment && <p className="text-xs text-gray-600">Treatment: {record.treatment}</p>}
        {record.admitPatient && (
          <span className="inline-block text-xs font-semibold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Admitted</span>
        )}
      </div>
    </div>
  );
}

function PastClinicalHistory({ doc }: { doc: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(doc).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Split into individual entries by the separator
  const entries = doc.split(/\n---\n/).map(e => e.trim()).filter(Boolean).reverse(); // newest first

  return (
    <div className="rounded-xl border border-amber-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-amber-50 border-b border-amber-200">
        <p className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
          <span>📋</span> Past Clinical History
          <span className="ml-1 bg-amber-200 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            {entries.length} {entries.length === 1 ? "entry" : "entries"}
          </span>
        </p>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-900 bg-amber-100 hover:bg-amber-200 px-2 py-1 rounded-lg transition-colors"
        >
          {copied ? "✓ Copied!" : "Copy All"}
        </button>
      </div>

      {/* Entries */}
      <div className="divide-y divide-amber-100 max-h-72 overflow-y-auto bg-white">
        {entries.map((entry, i) => {
          // Extract first line as title
          const lines = entry.split("\n");
          const title = lines[0].replace(/^=+\s*/, "").replace(/\s*=+$/, "").trim();
          const rest = lines.slice(1).join("\n").trim();

          return (
            <details key={i} className="group">
              <summary className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-amber-50 transition-colors list-none">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                    {entries.length - i}
                  </span>
                  <span className="text-xs font-semibold text-gray-800 truncate">{title || `Entry ${entries.length - i}`}</span>
                </div>
                <span className="text-gray-400 text-xs ml-2 flex-shrink-0 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div className="px-3 pb-3">
                <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono bg-gray-50 rounded-lg p-3 leading-relaxed border border-gray-100 max-h-48 overflow-y-auto">
                  {rest}
                </pre>
                <button
                  onClick={() => navigator.clipboard.writeText(entry)}
                  className="mt-1.5 text-[10px] text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Copy this entry
                </button>
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
