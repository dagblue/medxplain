"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, X, RefreshCw, Plus, UserCheck,
  Globe, MapPin, Eye, Calendar, Clock,
  AlertTriangle, UserPlus, CheckCircle, Hash,
  Phone, Droplets, Building2, Stethoscope,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { PatientModal } from "@/components/patients/PatientModal";
import { VisitDetailModal } from "@/components/appointments/VisitDetailModal";
import { AssignStaffInline } from "@/components/appointments/AssignStaffInline";
import { cn, formatDateTime, formatDate } from "@/lib/utils";
import { useSession } from "@/lib/auth-client";
import toast from "react-hot-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Patient {
  id: string; name: string; phone: string; gender: string;
  bloodGroup?: string; allergies?: string; status: string;
  nationalId?: string; dateOfBirth?: string; email?: string;
  address?: string; city?: string; region?: string;
  nationality?: string; maritalStatus?: string;
  chronicConditions?: string; currentMedications?: string;
  occupation?: string; insuranceProvider?: string;
  emergencyContact?: string; nextOfKinName?: string; nextOfKinPhone?: string;
}

interface Nurse {
  id: string; ward?: string; busy: boolean; isAvailable: boolean;
  activeVisits: number;
  department?: { id: string; name: string } | null;
  user: { name: string };
}

interface Visit {
  id: string; queueNumber?: number; status: string; visitType: string;
  chiefComplaint?: string; createdAt: string;
  patient: { id: string; name: string; phone: string; gender: string; bloodGroup?: string; allergies?: string };
  nurse?: { user: { name: string } };
  doctor?: { user: { name: string }; department?: { name: string } };
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; dot: string; ring: string; bg: string }> = {
  WAITING_TRIAGE:  { label: "Waiting Triage",  dot: "bg-orange-400", ring: "ring-orange-200", bg: "bg-orange-50" },
  IN_TRIAGE:       { label: "In Triage",        dot: "bg-yellow-400", ring: "ring-yellow-200", bg: "bg-yellow-50" },
  IN_LAB_PROCESS:  { label: "In Lab",           dot: "bg-cyan-400",   ring: "ring-cyan-200",   bg: "bg-cyan-50" },
  WAITING_DOCTOR:  { label: "Waiting Doctor",   dot: "bg-purple-400", ring: "ring-purple-200", bg: "bg-purple-50" },
  IN_CONSULTATION: { label: "In Consultation",  dot: "bg-blue-400",   ring: "ring-blue-200",   bg: "bg-blue-50" },
  WAITING_PHARMACY:{ label: "At Pharmacy",      dot: "bg-orange-400", ring: "ring-orange-200", bg: "bg-orange-50" },
  COMPLETED:       { label: "Completed",        dot: "bg-green-400",  ring: "ring-green-200",  bg: "bg-green-50" },
  CANCELLED:       { label: "Cancelled",        dot: "bg-red-400",    ring: "ring-red-200",    bg: "bg-red-50" },
};
const ALL_STATUSES = Object.keys(STATUS_META);

// ─── Highlight helper ─────────────────────────────────────────────────────────

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim() || !text) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 text-yellow-900 rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

// ─── Patient full detail card ─────────────────────────────────────────────────

function PatientDetailCard({ patient, query, onSelect, selected }: {
  patient: Patient; query: string; onSelect: () => void; selected: boolean;
}) {
  const initials = patient.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-2xl border-2 p-4 cursor-pointer transition-all",
        selected
          ? "border-primary-500 bg-primary-50 shadow-md"
          : "border-gray-100 bg-white hover:border-primary-200 hover:shadow-sm"
      )}
      onClick={onSelect}
    >
      {/* Header row */}
      <div className="flex items-start gap-3 mb-3">
        <div className={cn(
          "w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg flex-shrink-0",
          selected ? "bg-primary-600 text-white" : "bg-primary-100 text-primary-700"
        )}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-gray-900"><Highlight text={patient.name} query={query} /></p>
            <StatusBadge status={patient.status} />
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-gray-500">
            <span className="flex items-center gap-1"><Phone className="w-3 h-3" /><Highlight text={patient.phone} query={query} /></span>
            <span>{patient.gender}</span>
            {patient.bloodGroup && <span className="flex items-center gap-1"><Droplets className="w-3 h-3 text-red-400" />{patient.bloodGroup}</span>}
            {patient.nationalId && <span>ID: <Highlight text={patient.nationalId} query={query} /></span>}
          </div>
        </div>
        {selected && <CheckCircle className="w-5 h-5 text-primary-600 flex-shrink-0 mt-1" />}
      </div>

      {/* Detail grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs border-t border-gray-100 pt-3">
        {patient.dateOfBirth && <span className="text-gray-500">DOB: <span className="text-gray-700">{formatDate(patient.dateOfBirth)}</span></span>}
        {patient.nationality && <span className="text-gray-500">Nationality: <span className="text-gray-700">{patient.nationality}</span></span>}
        {patient.email && <span className="text-gray-500 col-span-2 truncate">Email: <span className="text-gray-700">{patient.email}</span></span>}
        {patient.city && <span className="text-gray-500">City: <span className="text-gray-700">{patient.city}</span></span>}
        {patient.occupation && <span className="text-gray-500">Occupation: <span className="text-gray-700">{patient.occupation}</span></span>}
        {patient.insuranceProvider && <span className="text-gray-500 col-span-2">Insurance: <span className="text-gray-700">{patient.insuranceProvider}</span></span>}
        {patient.chronicConditions && (
          <span className="text-gray-500 col-span-2">Conditions: <span className="text-orange-700 font-medium">{patient.chronicConditions}</span></span>
        )}
        {patient.emergencyContact && <span className="text-gray-500 col-span-2">Emergency: <span className="text-gray-700">{patient.emergencyContact}</span></span>}
      </div>

      {patient.allergies && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-red-700 bg-red-50 rounded-lg px-2.5 py-1.5 border border-red-100">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="font-semibold">Allergies:</span> {patient.allergies}
        </div>
      )}
    </motion.div>
  );
}

// ─── Nurse list grouped by ward ───────────────────────────────────────────────

function NurseList({ selectedId, onSelect }: { selectedId: string; onSelect: (id: string) => void }) {
  const [wardFilter, setWardFilter] = useState("ALL");

  const { data, isLoading } = useQuery({
    queryKey: ["nurses-new-visit"],
    queryFn: () => fetch("/api/nurses").then(r => r.json()),
    staleTime: 20_000,
  });

  const nurses: Nurse[] = data?.nurses ?? [];

  // Build ward list
  const wards = [
    "ALL",
    ...Array.from(new Set(nurses.map(n => n.ward ?? "General"))).sort(),
  ];

  const filtered = nurses.filter(n =>
    wardFilter === "ALL" || (n.ward ?? "General") === wardFilter
  );

  const freeCount = filtered.filter(n => !n.busy).length;

  if (isLoading) return (
    <div className="grid grid-cols-2 gap-3">
      {[1,2,3,4].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Ward filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {wards.map(w => (
          <button key={w} onClick={() => setWardFilter(w)}
            className={cn(
              "text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors",
              wardFilter === w
                ? "bg-green-600 text-white border-green-600"
                : "bg-white text-gray-600 border-gray-200 hover:border-green-300"
            )}>
            {w === "ALL" ? `All Wards (${nurses.length})` : `${w} (${nurses.filter(n => (n.ward ?? "General") === w).length})`}
          </button>
        ))}
      </div>

      {freeCount === 0 && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          No available nurses in this ward. You can still create the visit and assign later.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-1">
        {filtered.map(n => {
          const isSelected = selectedId === n.id;
          const isBusy = n.busy;
          const initials = n.user.name.split(" ").map(x => x[0]).join("").slice(0, 2).toUpperCase();
          return (
            <button key={n.id} disabled={isBusy} onClick={() => onSelect(isSelected ? "" : n.id)}
              className={cn(
                "flex items-center gap-2.5 p-3 rounded-xl border-2 text-left transition-all",
                isSelected ? "border-green-500 bg-green-50"
                  : isBusy ? "border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed"
                  : "border-gray-100 bg-white hover:border-green-300 hover:bg-green-50/40"
              )}>
              <div className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0",
                isSelected ? "bg-green-600 text-white" : isBusy ? "bg-red-100 text-red-600" : "bg-green-100 text-green-700"
              )}>
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-900 truncate">{n.user.name}</p>
                <p className="text-xs text-gray-500 truncate">{n.ward ?? "General"}</p>
              </div>
              <span className={cn(
                "text-xs font-bold px-1.5 py-0.5 rounded-full flex-shrink-0",
                isBusy ? "bg-red-100 text-red-600" : "bg-green-100 text-green-700"
              )}>
                {isBusy ? "Busy" : "Free"}
              </span>
              {isSelected && <CheckCircle className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── New Visit Slide Panel ────────────────────────────────────────────────────

function NewVisitPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Patient | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [visitType, setVisitType] = useState<"WALK_IN" | "ONLINE">("WALK_IN");
  const [nurseId, setNurseId] = useState("");

  const { data: searchData, isFetching } = useQuery({
    queryKey: ["appt-patient-search", query],
    queryFn: () => fetch(`/api/patients?search=${encodeURIComponent(query)}&limit=6`).then(r => r.json()),
    enabled: query.trim().length >= 2,
    staleTime: 10_000,
  });

  const patients: Patient[] = searchData?.patients ?? [];

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Select a patient first");
      const res = await fetch("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: selected.id, chiefComplaint: chiefComplaint.trim() || undefined, visitType }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Failed"); }
      const { visit } = await res.json();

      if (nurseId) {
        await fetch(`/api/visits/${visit.id}/assign-nurse`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nurseId }),
        });
      }
      return visit;
    },
    onSuccess: (visit) => {
      const parts = [`Visit #${visit.queueNumber ?? "—"} created`];
      if (nurseId) parts.push("nurse assigned");
      toast.success(parts.join(" · "), { duration: 5000 });
      qc.invalidateQueries({ queryKey: ["visits-appointments"] });
      qc.invalidateQueries({ queryKey: ["nurses-new-visit"] });
      handleClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleClose = () => {
    setQuery(""); setSelected(null); setChiefComplaint("");
    setVisitType("WALK_IN"); setNurseId("");
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />

          <motion.div
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            className="relative ml-auto w-full max-w-2xl h-full bg-white shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <div>
                <h2 className="text-lg font-bold text-gray-900">New Visit</h2>
                <p className="text-xs text-gray-500 mt-0.5">Search patient → fill details → assign nurse → create</p>
              </div>
              <button onClick={handleClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-7">

              {/* ── 1. Patient Search ── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-primary-600 text-white text-xs font-black flex items-center justify-center">1</span>
                    Select Patient
                  </h3>
                  <Button size="sm" variant="secondary" icon={<UserPlus className="w-3.5 h-3.5" />}
                    onClick={() => setRegisterOpen(true)}>
                    Register New
                  </Button>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text" value={query} onChange={e => setQuery(e.target.value)}
                    placeholder="Search by name, phone, national ID…"
                    className="w-full pl-9 pr-8 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                    autoFocus
                  />
                  {query && <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X className="w-4 h-4" /></button>}
                </div>

                {/* Search results — full patient cards */}
                {query.trim().length >= 2 && (
                  <div className="space-y-2">
                    {isFetching && <p className="text-xs text-gray-400 text-center py-3">Searching…</p>}
                    {!isFetching && patients.length === 0 && (
                      <div className="text-center py-5 space-y-2">
                        <p className="text-sm text-gray-500">No patient found for "{query}"</p>
                        <Button size="sm" icon={<UserPlus className="w-3.5 h-3.5" />} onClick={() => setRegisterOpen(true)}>
                          Register as New Patient
                        </Button>
                      </div>
                    )}
                    {patients.map(p => (
                      <PatientDetailCard
                        key={p.id} patient={p} query={query}
                        selected={selected?.id === p.id}
                        onSelect={() => setSelected(selected?.id === p.id ? null : p)}
                      />
                    ))}
                  </div>
                )}

                {/* Selected patient summary */}
                {selected && query.trim().length < 2 && (
                  <PatientDetailCard patient={selected} query="" selected onSelect={() => setSelected(null)} />
                )}
              </div>

              {/* ── 2. Visit Details ── */}
              <div className="space-y-3">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary-600 text-white text-xs font-black flex items-center justify-center">2</span>
                  Visit Details
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <Select
                    label="Visit Type"
                    value={visitType}
                    onChange={e => setVisitType(e.target.value as any)}
                    options={[{ value: "WALK_IN", label: "Walk-in" }, { value: "ONLINE", label: "Online Booking" }]}
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Chief Complaint <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <input
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                      placeholder="Main reason for visit…"
                      value={chiefComplaint}
                      onChange={e => setChiefComplaint(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* ── 3. Assign Nurse ── */}
              <div className="space-y-3">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-green-600 text-white text-xs font-black flex items-center justify-center">3</span>
                  Assign Nurse
                  <span className="text-xs text-gray-400 font-normal">(optional — can assign later)</span>
                </h3>
                <NurseList selectedId={nurseId} onSelect={setNurseId} />
              </div>

            </div>

            {/* Sticky footer */}
            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex items-center justify-between gap-3 flex-shrink-0">
              <Button variant="secondary" onClick={handleClose}>Cancel</Button>
              <Button
                loading={createMutation.isPending}
                disabled={!selected}
                onClick={() => createMutation.mutate()}
                icon={<Plus className="w-4 h-4" />}
              >
                Create Visit{nurseId ? " & Assign Nurse" : ""}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ─── Visit Card ───────────────────────────────────────────────────────────────

function VisitCard({ visit, query, canAssign, onViewDetail, onCancel }: {
  visit: Visit; query: string; canAssign: boolean;
  onViewDetail: (v: Visit) => void; onCancel: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = STATUS_META[visit.status] ?? STATUS_META.WAITING_TRIAGE;
  const isActive = !["COMPLETED", "CANCELLED"].includes(visit.status);

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
      className={cn("bg-white rounded-2xl border shadow-sm overflow-hidden hover:shadow-md transition-shadow",
        visit.status === "CANCELLED" && "opacity-60")}>
      <div className={cn("h-1 w-full", meta.dot)} />
      <div className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-black text-gray-400">{visit.queueNumber ? `#${visit.queueNumber}` : "—"}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold text-gray-900"><Highlight text={visit.patient.name} query={query} /></p>
              {visit.patient.allergies && (
                <span className="text-xs text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                  <AlertTriangle className="w-3 h-3" /><Highlight text={visit.patient.allergies} query={query} />
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              <Highlight text={visit.patient.phone} query={query} /> · {visit.patient.gender}
              {visit.patient.bloodGroup ? ` · ${visit.patient.bloodGroup}` : ""}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <span className={cn("inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full",
              visit.visitType === "ONLINE" ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-600")}>
              {visit.visitType === "ONLINE" ? <><Globe className="w-3 h-3" /> Online</> : <><MapPin className="w-3 h-3" /> Walk-in</>}
            </span>
            <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ring-1", meta.bg, meta.ring)}>
              <span className={cn("w-1.5 h-1.5 rounded-full", meta.dot)} />{meta.label}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 pl-13">
          {visit.chiefComplaint && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /><Highlight text={visit.chiefComplaint} query={query} /></span>}
          {visit.nurse && <span className="flex items-center gap-1 text-green-700"><UserCheck className="w-3 h-3" />{visit.nurse.user.name}</span>}
          {visit.doctor && <span className="flex items-center gap-1 text-blue-700"><Stethoscope className="w-3 h-3" />Dr. {visit.doctor.user.name}</span>}
          <span className="flex items-center gap-1 text-gray-400"><Clock className="w-3 h-3" />{formatDateTime(visit.createdAt)}</span>
        </div>

        <div className="flex items-center gap-2 pt-1 border-t border-gray-50">
          <button onClick={() => onViewDetail(visit)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 transition-colors px-2 py-1 rounded-lg hover:bg-blue-50">
            <Eye className="w-3.5 h-3.5" /> Details
          </button>
          {canAssign && isActive && visit.status === "WAITING_TRIAGE" && (
            <button onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-green-600 transition-colors px-2 py-1 rounded-lg hover:bg-green-50">
              <UserCheck className="w-3.5 h-3.5" /> Assign Nurse
            </button>
          )}
          {canAssign && isActive && (
            <button onClick={() => onCancel(visit.id)}
              className="ml-auto flex items-center gap-1 text-xs text-gray-400 hover:text-red-600 transition-colors px-2 py-1 rounded-lg hover:bg-red-50">
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
          )}
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
              <AssignStaffInline visit={visit} onDone={() => setExpanded(false)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── Main client ──────────────────────────────────────────────────────────────

export function AppointmentsClient() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const role = session?.user?.role as string;
  const canAssign = ["ADMIN", "RECEPTIONIST"].includes(role);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [detailVisit, setDetailVisit] = useState<Visit | null>(null);
  const [newVisitOpen, setNewVisitOpen] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["visits-appointments", statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "100" });
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/visits?${params}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/visits/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => { toast.success("Visit cancelled"); qc.invalidateQueries({ queryKey: ["visits-appointments"] }); },
    onError: () => toast.error("Failed to cancel"),
  });

  const allVisits: Visit[] = data?.visits ?? [];

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return allVisits.filter(v => {
      const matchSearch = !q || [v.patient.name, v.patient.phone, v.patient.id, v.chiefComplaint ?? ""].some(s => s.toLowerCase().includes(q));
      const matchType = !typeFilter || v.visitType === typeFilter;
      return matchSearch && matchType;
    });
  }, [allVisits, search, typeFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    allVisits.forEach(v => { c[v.status] = (c[v.status] ?? 0) + 1; });
    return c;
  }, [allVisits]);

  return (
    <div className="space-y-5">
      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {ALL_STATUSES.map(s => {
          const meta = STATUS_META[s];
          const count = counts[s] ?? 0;
          return (
            <button key={s} onClick={() => setStatusFilter(statusFilter === s ? "" : s)}
              className={cn("flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition-all text-center",
                statusFilter === s ? cn(meta.bg, meta.ring, "border-current") : "bg-white border-gray-100 hover:border-gray-200")}>
              <span className={cn("w-2 h-2 rounded-full", meta.dot)} />
              <span className="text-lg font-black text-gray-800">{count}</span>
              <span className="text-xs text-gray-500 leading-tight">{meta.label}</span>
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search patient, phone, complaint…"
            className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white" />
          {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X className="w-4 h-4" /></button>}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-gray-200 overflow-hidden text-xs font-semibold">
            {[["", "All"], ["WALK_IN", "Walk-in"], ["ONLINE", "Online"]].map(([val, label]) => (
              <button key={val} onClick={() => setTypeFilter(val)}
                className={cn("px-3 py-2 transition-colors", typeFilter === val ? "bg-primary-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50")}>
                {label}
              </button>
            ))}
          </div>
          <button onClick={() => refetch()} className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-400 transition-colors" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
          {canAssign && (
            <Button icon={<Plus className="w-4 h-4" />} onClick={() => setNewVisitOpen(true)}>New Visit</Button>
          )}
        </div>
      </div>

      {search && <p className="text-sm text-gray-500">{filtered.length} result{filtered.length !== 1 ? "s" : ""} for "{search}"</p>}

      {/* Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-36 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Calendar className="w-10 h-10 mx-auto mb-3 text-gray-200" />
          <p className="text-sm font-medium">{search ? `No visits match "${search}"` : "No visits found"}</p>
          {statusFilter && <button onClick={() => setStatusFilter("")} className="mt-2 text-xs text-primary-600 hover:underline">Clear filter</button>}
        </div>
      ) : (
        <motion.div layout className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AnimatePresence mode="popLayout">
            {filtered.map(v => (
              <VisitCard key={v.id} visit={v} query={search} canAssign={canAssign}
                onViewDetail={setDetailVisit} onCancel={id => cancelMutation.mutate(id)} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <VisitDetailModal visit={detailVisit} open={!!detailVisit} onClose={() => setDetailVisit(null)} />
      <NewVisitPanel open={newVisitOpen} onClose={() => setNewVisitOpen(false)} />
    </div>
  );
}
