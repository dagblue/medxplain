"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart, ChevronDown, ChevronUp, CheckCircle, Stethoscope,
  RefreshCw, Clock, UserCheck, Plus, Trash2, Send, AlertTriangle,
} from "lucide-react";
import toast from "react-hot-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Doctor {
  id: string;
  doctorId: string;
  specialization: string;
  busy: boolean;
  isAvailable: boolean;
  user: { name: string };
  department: { name: string };
}

interface Medicine {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

interface Visit {
  id: string;
  queueNumber?: number;
  status: string;
  visitType: string;
  chiefComplaint?: string;
  triageNotes?: string;
  createdAt: string;
  patient: {
    id: string;
    name: string;
    phone: string;
    gender: string;
    bloodGroup?: string;
    allergies?: string;
  };
  vitals?: {
    temperature?: string;
    bloodPressure?: string;
    heartRate?: string;
    oxygenSat?: string;
    weight?: string;
    height?: string;
  };
}

// ─── Helper: map chief complaint to department ───────────────────────────────
function getSuggestedDepartment(chiefComplaint?: string): string | null {
  if (!chiefComplaint) return null;
  const complaint = chiefComplaint.toLowerCase();
  if (complaint.includes("heart") || complaint.includes("chest") || complaint.includes("cardio")) return "Cardiology";
  if (complaint.includes("head") || complaint.includes("brain") || complaint.includes("neuro")) return "Neurology";
  if (complaint.includes("bone") || complaint.includes("joint") || complaint.includes("ortho")) return "Orthopedics";
  if (complaint.includes("child") || complaint.includes("pediatric")) return "Pediatrics";
  if (complaint.includes("eye") || complaint.includes("vision")) return "Ophthalmology";
  if (complaint.includes("skin") || complaint.includes("rash")) return "Dermatology";
  if (complaint.includes("stomach") || complaint.includes("abdomen") || complaint.includes("gi")) return "Gastroenterology";
  if (complaint.includes("lung") || complaint.includes("breath") || complaint.includes("respiratory")) return "Pulmonology";
  return null;
}

// ─── Staff card (reusable) – uses native button ─────────────────────────────
function StaffCard({
  name,
  sub,
  busy,
  selected,
  onClick,
  color,
  badge,
}: {
  name: string;
  sub: string;
  busy: boolean;
  selected: boolean;
  onClick: () => void;
  color: string;
  badge?: string;
}) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`w-full flex items-center gap-2.5 p-3 rounded-xl border-2 text-left transition-all ${
        selected
          ? "border-blue-500 bg-blue-50"
          : busy
          ? "border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed"
          : "border-gray-100 bg-white hover:border-blue-300 hover:bg-blue-50/40"
      }`}
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 ${color}`}>
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
          {badge && (
            <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 truncate">{sub}</p>
      </div>
      <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
        busy ? "bg-red-100 text-red-600" : "bg-green-100 text-green-700"
      }`}>
        {busy ? "Busy" : "Free"}
      </span>
      {selected && <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />}
    </button>
  );
}

// ─── Helper Button component using native button ────────────────────────────
function CustomButton({
  children,
  onClick,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  icon,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary";
  size?: "sm" | "md";
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  className?: string;
}) {
  const baseStyles = "inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
  const sizeStyles = size === "sm" ? "px-3 py-1.5 text-sm" : "px-4 py-2 text-sm";
  const variantStyles = variant === "primary"
    ? "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500"
    : "bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-400";
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseStyles} ${sizeStyles} ${variantStyles} ${className}`}
    >
      {loading ? (
        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
      ) : (
        icon
      )}
      {children}
    </button>
  );
}

// ─── Helper Input component using native input ──────────────────────────────
function CustomInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
    </div>
  );
}

// ─── Helper Textarea component ──────────────────────────────────────────────
function CustomTextarea({
  label,
  value,
  onChange,
  placeholder,
  rows = 2,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-gray-700">{label}</label>
      <textarea
        rows={rows}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
    </div>
  );
}

// ─── Helper StatusBadge component (simplified) ──────────────────────────────
function CustomStatusBadge({ status }: { status: string }) {
  const getColor = () => {
    switch (status) {
      case "WAITING_TRIAGE":
        return "bg-yellow-100 text-yellow-700";
      case "IN_TRIAGE":
        return "bg-blue-100 text-blue-700";
      case "IN_CONSULTATION":
        return "bg-purple-100 text-purple-700";
      case "COMPLETED":
        return "bg-green-100 text-green-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };
  return (
    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${getColor()}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

// ─── POST-TRIAGE: Minor Case → Prescription + Discharge Instructions ──────────
function MinorCaseFlow({
  visit,
  vitals,
  triageNotes,
  onDone,
}: {
  visit: Visit;
  vitals: any;
  triageNotes: string;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const EMPTY: Medicine = {
    name: "",
    dosage: "",
    frequency: "",
    duration: "",
    instructions: "",
  };
  const [medicines, setMedicines] = useState<Medicine[]>([{ ...EMPTY }]);
  const [pharmacyNotes, setPharmacyNotes] = useState("");
  const [dischargeNotes, setDischargeNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const setMed = (i: number, k: keyof Medicine, v: string) =>
    setMedicines((ms) => ms.map((m, idx) => (idx === i ? { ...m, [k]: v } : m)));

  const handleComplete = async () => {
    const valid = medicines.filter(
      (m) =>
        m.name.trim() &&
        m.dosage.trim() &&
        m.frequency.trim() &&
        m.duration.trim()
    );
    if (valid.length === 0) {
      toast.error("Add at least one complete medicine");
      return;
    }
    setIsSaving(true);
    try {
      const triageRes = await fetch(`/api/visits/${visit.id}/triage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...vitals,
          triageNotes,
          requiresDoctor: false,
          needsLab: false,
          dischargeNotes,
        }),
      });
      if (!triageRes.ok) throw new Error("Failed to save triage");

      const prescriptionRes = await fetch("/api/prescriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: visit.patient.id,
          visitId: visit.id,
          notes: pharmacyNotes,
          medicines: valid,
        }),
      });
      if (!prescriptionRes.ok) {
        const e = await prescriptionRes.json();
        throw new Error(e.error ?? "Failed to create prescription");
      }
      const data = await prescriptionRes.json();
      toast.success(
        `Prescription ${data.prescription?.code ?? "—"} sent to pharmacy · Visit completed`
      );
      qc.invalidateQueries({ queryKey: ["nurse-queue"] });
      onDone();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4 p-4 bg-green-50 rounded-xl border border-green-100">
      <div className="flex items-center gap-2">
        <CheckCircle className="w-4 h-4 text-green-600" />
        <p className="text-sm font-bold text-green-800">
          Minor Case — Prescription & Discharge Summary
        </p>
      </div>
      <p className="text-xs text-green-700">
        Prescription sent to pharmacy. Discharge instructions added to patient record.
      </p>

      {medicines.map((m, i) => (
        <div key={i} className="bg-white rounded-xl border border-green-100 p-3 space-y-2">
          <div className="flex justify-between">
            <p className="text-xs font-semibold text-gray-600">Medicine {i + 1}</p>
            {medicines.length > 1 && (
              <button
                onClick={() => setMedicines((ms) => ms.filter((_, idx) => idx !== i))}
                className="text-red-400 hover:text-red-600"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <CustomInput label="Name" value={m.name} onChange={(e) => setMed(i, "name", e.target.value)} placeholder="e.g. Paracetamol" required />
            <CustomInput label="Dosage" value={m.dosage} onChange={(e) => setMed(i, "dosage", e.target.value)} placeholder="e.g. 500mg" required />
            <CustomInput label="Frequency" value={m.frequency} onChange={(e) => setMed(i, "frequency", e.target.value)} placeholder="e.g. TID" required />
            <CustomInput label="Duration" value={m.duration} onChange={(e) => setMed(i, "duration", e.target.value)} placeholder="e.g. 5 days" required />
            <div className="col-span-2">
              <CustomInput label="Instructions" value={m.instructions} onChange={(e) => setMed(i, "instructions", e.target.value)} placeholder="e.g. After meals" />
            </div>
          </div>
        </div>
      ))}

      <button
        onClick={() => setMedicines((ms) => [...ms, { ...EMPTY }])}
        className="flex items-center gap-1 text-xs text-green-700 hover:text-green-800"
      >
        <Plus className="w-3.5 h-3.5" /> Add medicine
      </button>

      <CustomTextarea label="Notes for pharmacist" value={pharmacyNotes} onChange={(e) => setPharmacyNotes(e.target.value)} rows={2} />

      <div className="border-t border-green-200 pt-2">
        <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
          <UserCheck className="w-3.5 h-3.5 text-green-600" />
          Discharge Instructions / Summary for Patient
        </label>
        <textarea
          rows={3}
          className="w-full border border-green-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-green-400"
          value={dischargeNotes}
          onChange={(e) => setDischargeNotes(e.target.value)}
          placeholder="Rest, hydration, follow-up, activity restrictions..."
        />
        <p className="text-xs text-gray-400 mt-1">These notes will be added to the patient's record.</p>
      </div>

      <div className="flex gap-2">
        <CustomButton variant="secondary" onClick={onDone}>Cancel</CustomButton>
        <CustomButton loading={isSaving} onClick={handleComplete} icon={<Send className="w-3.5 h-3.5" />}>
          Complete Visit & Discharge
        </CustomButton>
      </div>
    </div>
  );
}

// ─── POST-TRIAGE: Needs Doctor – using /api/doctors ──────────────────────────
function DoctorAssignFlow({
  visit,
  vitals,
  triageNotes,
  onDone,
}: {
  visit: Visit;
  vitals: any;
  triageNotes: string;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [doctorId, setDoctorId] = useState("");
  const [deptFilter, setDeptFilter] = useState<string>("ALL");
  const [isAssigning, setIsAssigning] = useState(false);

  const { data: doctorData, isLoading, isError, refetch } = useQuery({
    queryKey: ["doctors-for-nurse-assign"],
    queryFn: async () => {
      const res = await fetch("/api/doctors/available");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      return res.json();
    },
    staleTime: 0,
    refetchOnMount: true,
    refetchInterval: 30_000,
  });

  const allDoctors: Doctor[] = (doctorData?.doctors ?? []).map((d: any) => ({
    id: d.id,
    doctorId: d.id,
    specialization: d.specialization || "General",
    busy: d.busy === true,
    isAvailable: d.isAvailable !== false,
    user: { name: d.user?.name ?? "Unknown" },
    department: { name: d.department?.name ?? "General" },
  }));

  const suggestedDept = getSuggestedDepartment(visit.chiefComplaint);

  const handleAssign = async () => {
    if (!doctorId) return;
    setIsAssigning(true);
    try {
      const triageRes = await fetch(`/api/visits/${visit.id}/triage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...vitals, triageNotes, requiresDoctor: true, needsLab: false }),
      });
      if (!triageRes.ok) throw new Error("Failed to save triage");

      const assignRes = await fetch(`/api/visits/${visit.id}/assign-doctor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doctorId }),
      });
      if (!assignRes.ok) {
        const e = await assignRes.json();
        throw new Error(e.error ?? "Failed to assign doctor");
      }
      const doc = allDoctors.find((d) => d.doctorId === doctorId);
      toast.success(`Dr. ${doc?.user.name ?? "Doctor"} assigned — patient is IN CONSULTATION`);
      qc.invalidateQueries({ queryKey: ["nurse-queue"] });
      onDone();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsAssigning(false);
    }
  };

  // All doctors for the grid (available + busy), filtered by dept
  const allDeptOptions = [
    { name: "All Departments" },
    ...Array.from(
      new Map(
        allDoctors.map((d) => [d.department.name, d.department])
      ).values()
    ).sort((a, b) => a.name.localeCompare(b.name)),
  ];

  const displayDoctors = allDoctors.filter((d) => {
    if (deptFilter === "ALL") return true;
    return d.department.name === deptFilter;
  });

  const availableCount = displayDoctors.filter((d) => !d.busy).length;
  const busyCount = displayDoctors.filter((d) => d.busy).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onDone}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          ← Back
        </button>
        <div className="h-4 w-px bg-gray-200" />
        <p className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
          <Stethoscope className="w-4 h-4 text-blue-600" /> Assign Doctor
        </p>
      </div>

      {/* Patient complaint hint */}
      {visit.chiefComplaint && suggestedDept && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
          💡 Based on <strong>{visit.chiefComplaint}</strong>, suggested department: <strong>{suggestedDept}</strong>
        </div>
      )}

      {/* Stats + dept filter */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            {availableCount} Available
          </span>
          <span className="flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            {busyCount} Busy
          </span>
        </div>
        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="text-xs bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-700"
        >
          {allDeptOptions.map((d) => (
            <option key={d.name} value={d.name === "All Departments" ? "ALL" : d.name}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      {/* Doctor card grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <div className="text-center py-10 text-red-400">
          <Stethoscope className="w-10 h-10 mx-auto mb-2 text-red-200" />
          <p className="text-sm font-medium">Failed to load doctors</p>
          <button onClick={() => refetch()} className="mt-2 text-xs text-blue-600 hover:underline">
            Try again
          </button>
        </div>
      ) : displayDoctors.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <Stethoscope className="w-10 h-10 mx-auto mb-2 text-gray-200" />
          <p className="text-sm">No doctors in this department</p>
          <button onClick={() => setDeptFilter("ALL")} className="mt-1 text-xs text-blue-600 hover:underline">
            Show all
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
          {displayDoctors.map((d) => {
            const isBusy = d.busy;
            const isSelected = doctorId === d.doctorId;
            const initials = d.user.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
            const isRecommended = suggestedDept === d.department.name;

            return (
              <button
                key={d.doctorId}
                disabled={isBusy}
                onClick={() => !isBusy && setDoctorId(isSelected ? "" : d.doctorId)}
                className={`relative text-left rounded-2xl border-2 overflow-hidden transition-all ${
                  isSelected
                    ? "border-blue-500 bg-blue-50 shadow-md"
                    : isBusy
                    ? "border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed"
                    : "border-gray-100 bg-white hover:border-blue-300 hover:shadow-sm cursor-pointer"
                }`}
              >
                {/* top accent bar */}
                <div className={`h-1.5 w-full ${isSelected ? "bg-blue-500" : isBusy ? "bg-red-400" : "bg-green-400"}`} />
                <div className="p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      isSelected ? "bg-blue-100 text-blue-700" : isBusy ? "bg-red-100 text-red-600" : "bg-green-100 text-green-700"
                    }`}>
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-900 truncate">Dr. {d.user.name}</p>
                      <p className="text-[10px] text-gray-500 truncate">{d.specialization}</p>
                      <p className="text-[10px] text-gray-400 truncate">{d.department.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isBusy ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                    }`}>
                      {isBusy ? "In Consult" : "Available"}
                    </span>
                    {isRecommended && !isBusy && (
                      <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">⭐ Rec</span>
                    )}
                    {isSelected && <CheckCircle className="w-3.5 h-3.5 text-blue-600" />}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 pt-1">
        <CustomButton variant="secondary" onClick={onDone} className="flex-1">Back</CustomButton>
        <CustomButton
          disabled={!doctorId}
          loading={isAssigning}
          onClick={handleAssign}
          icon={<UserCheck className="w-3.5 h-3.5" />}
          className="flex-1"
        >
          Assign Doctor
        </CustomButton>
      </div>
    </div>
  );
}

// ─── TriageForm – only two options ───────────────────────────────────────────
function TriageForm({ visit, onDone }: { visit: Visit; onDone: () => void }) {
  const [vitals, setVitals] = useState({
    temperature: visit.vitals?.temperature ?? "",
    bloodPressure: visit.vitals?.bloodPressure ?? "",
    heartRate: visit.vitals?.heartRate ?? "",
    oxygenSat: visit.vitals?.oxygenSat ?? "",
    weight: visit.vitals?.weight ?? "",
    height: visit.vitals?.height ?? "",
  });
  const [triageNotes, setTriageNotes] = useState(visit.triageNotes ?? "");
  const [activeFlow, setActiveFlow] = useState<"doctor" | "complete" | null>(null);

  if (activeFlow === "doctor") {
    return <DoctorAssignFlow visit={visit} vitals={vitals} triageNotes={triageNotes} onDone={onDone} />;
  }
  if (activeFlow === "complete") {
    return <MinorCaseFlow visit={visit} vitals={vitals} triageNotes={triageNotes} onDone={onDone} />;
  }

  return (
    <div className="border-t border-gray-100 pt-4 mt-2 space-y-4">
      <p className="text-xs font-semibold text-gray-500 uppercase">Vitals</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { key: "temperature", label: "Temperature", placeholder: "37.2°C" },
          { key: "bloodPressure", label: "Blood Pressure", placeholder: "120/80" },
          { key: "heartRate", label: "Heart Rate", placeholder: "72 bpm" },
          { key: "oxygenSat", label: "O₂ Saturation", placeholder: "98%" },
          { key: "weight", label: "Weight", placeholder: "70 kg" },
          { key: "height", label: "Height", placeholder: "175 cm" },
        ].map(({ key, label, placeholder }) => (
          <CustomInput
            key={key}
            label={label}
            value={(vitals as any)[key]}
            onChange={(e) => setVitals({ ...vitals, [key]: e.target.value })}
            placeholder={placeholder}
          />
        ))}
      </div>
      <CustomTextarea label="Triage Notes" value={triageNotes} onChange={(e) => setTriageNotes(e.target.value)} placeholder="Observations, symptoms, initial assessment…" rows={2} />
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Triage Decision (click to proceed)</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setActiveFlow("complete")}
            className="flex flex-col items-center gap-1 p-3 rounded-xl border-2 border-green-300 bg-green-50 text-green-700 hover:ring-2 hover:ring-green-400"
          >
            <CheckCircle className="w-5 h-5" />
            <span className="text-xs font-bold">Minor Case</span>
            <span className="text-xs">Prescribe & discharge</span>
          </button>
          <button
            onClick={() => setActiveFlow("doctor")}
            className="flex flex-col items-center gap-1 p-3 rounded-xl border-2 border-blue-300 bg-blue-50 text-blue-700 hover:ring-2 hover:ring-blue-400"
          >
            <Stethoscope className="w-5 h-5" />
            <span className="text-xs font-bold">Needs Doctor</span>
            <span className="text-xs">Assign to doctor</span>
          </button>
        </div>
      </div>
      <div className="flex pt-1">
        <CustomButton variant="secondary" className="w-full" onClick={onDone}>Cancel</CustomButton>
      </div>
    </div>
  );
}

// ─── Nurse Workflow (main component) ─────────────────────────────────────────
export function NurseWorkflow() {
  const [openId, setOpenId] = useState<string | null>(null);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["nurse-queue"],
    queryFn: async () => {
      const res = await fetch("/api/visits?limit=50");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 20000,
  });
  const visits: Visit[] = (data?.visits ?? []).filter((v: Visit) =>
    ["WAITING_TRIAGE", "IN_TRIAGE"].includes(v.status)
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <Heart className="w-4 h-4 text-red-500" />
          Triage Queue
          {visits.length > 0 && (
            <span className="text-xs font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
              {visits.length} waiting
            </span>
          )}
        </h2>
        <button onClick={() => refetch()} className="p-1.5 rounded-lg hover:bg-gray-100">
          <RefreshCw className="w-4 h-4 text-gray-400" />
        </button>
      </div>
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : visits.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Clock className="w-8 h-8 mx-auto mb-2" />
          <p>No patients waiting for triage</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visits.map((v) => {
            const isOpen = openId === v.id;
            return (
              <motion.div key={v.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <button
                  onClick={() => setOpenId(isOpen ? null : v.id)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50"
                >
                  <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-orange-100 flex flex-col items-center justify-center">
                    <span className="text-xs font-semibold text-orange-500">Q</span>
                    <span className="text-lg font-black text-orange-700">{v.queueNumber ?? "—"}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900">{v.patient.name}</p>
                      {v.patient.allergies && (
                        <span className="text-xs text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                          <AlertTriangle className="w-3 h-3" /> {v.patient.allergies}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {v.patient.gender}{v.patient.bloodGroup ? ` · ${v.patient.bloodGroup}` : ""}
                      {v.chiefComplaint ? ` · ${v.chiefComplaint}` : ""}
                    </p>
                  </div>
                  <CustomStatusBadge status={v.status} />
                  {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden px-4 pb-4"
                    >
                      <TriageForm visit={v} onDone={() => setOpenId(null)} />
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