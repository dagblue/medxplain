"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, UserPlus, Plus, X, CheckCircle, Clock,
  Stethoscope, User, Hash, AlertTriangle, RefreshCw,
  UserCheck, Activity, Printer,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/Badge";
import { PatientModal } from "@/components/patients/PatientModal";
import { QueueTicketModal, printTicket, type TicketData } from "@/components/reception/QueueTicket";
import { cn, formatDateTime } from "@/lib/utils";
import toast from "react-hot-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Patient {
  id: string;
  name: string;
  phone: string;
  gender: string;
  bloodGroup?: string;
  allergies?: string;
  status: string;
}

interface Doctor {
  id: string;
  specialization: string;
  availability?: string;
  busy: boolean;
  user: { name: string };
  department: { id: string; name: string };
}

interface Nurse {
  id: string;
  ward?: string;
  busy: boolean;
  activeVisits: number;
  user: { name: string };
  department?: { id: string; name: string } | null;
}

interface Visit {
  id: string;
  queueNumber?: number;
  status: string;
  visitType: string;
  chiefComplaint?: string;
  createdAt: string;
  patient: { id: string; name: string; phone: string; gender: string };
  nurse?: { user: { name: string } };
  doctor?: { user: { name: string }; department: { name: string } };
  department?: { name: string };
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function searchPatients(q: string): Promise<{ patients: Patient[] }> {
  const res = await fetch(`/api/patients?search=${encodeURIComponent(q)}&limit=8`);
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

async function fetchDoctors(): Promise<{ doctors: Doctor[] }> {
  const res = await fetch("/api/doctors?limit=100");
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

async function fetchNurses(): Promise<{ nurses: Nurse[] }> {
  const res = await fetch("/api/nurses");
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

async function fetchActiveQueue(): Promise<{ visits: Visit[]; total: number }> {
  const res = await fetch("/api/visits?limit=50");
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

// ─── Patient Search Panel ─────────────────────────────────────────────────────

function PatientSearchPanel({
  onSelect,
}: {
  onSelect: (p: Patient) => void;
}) {
  const [query, setQuery] = useState("");
  const [registerOpen, setRegisterOpen] = useState(false);
  const qc = useQueryClient();

  const { data, isFetching } = useQuery({
    queryKey: ["patient-search", query],
    queryFn: () => searchPatients(query),
    enabled: query.trim().length >= 2,
    staleTime: 10_000,
  });

  const patients = data?.patients ?? [];

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <Search className="w-4 h-4 text-primary-600" />
          Patient Search
        </h2>
        <Button
          size="sm"
          variant="secondary"
          icon={<UserPlus className="w-3.5 h-3.5" />}
          onClick={() => setRegisterOpen(true)}
        >
          Register New
        </Button>
      </div>

      <Input
        placeholder="Search by name, phone, or ID…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        icon={<Search className="w-4 h-4" />}
      />

      {/* Results */}
      <AnimatePresence>
        {query.trim().length >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-1"
          >
            {isFetching && (
              <p className="text-xs text-gray-400 text-center py-2">Searching…</p>
            )}
            {!isFetching && patients.length === 0 && (
              <div className="text-center py-4 space-y-2">
                <p className="text-sm text-gray-500">No patient found for "{query}"</p>
                <Button
                  size="sm"
                  icon={<UserPlus className="w-3.5 h-3.5" />}
                  onClick={() => setRegisterOpen(true)}
                >
                  Register as New Patient
                </Button>
              </div>
            )}
            {patients.map((p) => (
              <button
                key={p.id}
                onClick={() => { onSelect(p); setQuery(""); }}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-primary-50 border border-transparent hover:border-primary-100 transition-all text-left"
              >
                <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                  {p.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                  <p className="text-xs text-gray-500">{p.phone} · {p.gender}{p.bloodGroup ? ` · ${p.bloodGroup}` : ""}</p>
                </div>
                <StatusBadge status={p.status} />
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <PatientModal
        open={registerOpen}
        onClose={() => { setRegisterOpen(false); qc.invalidateQueries({ queryKey: ["patient-search"] }); }}
        onCreated={(p) => { setRegisterOpen(false); onSelect(p); }}
      />
    </div>
  );
}

// ─── Create Visit Modal ───────────────────────────────────────────────────────

function CreateVisitModal({
  open,
  patient,
  onClose,
  onCreated,
}: {
  open: boolean;
  patient: Patient | null;
  onClose: () => void;
  onCreated: (visit: Visit) => void;
}) {
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [visitType, setVisitType] = useState<"WALK_IN" | "ONLINE">("WALK_IN");

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: patient!.id,
          chiefComplaint: chiefComplaint.trim() || undefined,
          visitType,
        }),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error ?? "Failed to create visit");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(`Visit #${data.visit.queueNumber ?? "—"} created`);
      setChiefComplaint("");
      onCreated(data.visit);
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  useEffect(() => {
    if (!open) { setChiefComplaint(""); setVisitType("WALK_IN"); }
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title="Create Visit" size="md">
      {patient && (
        <div className="space-y-4">
          {/* Patient summary */}
          <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
            <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
              {patient.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">{patient.name}</p>
              <p className="text-xs text-gray-500">{patient.phone} · {patient.gender}</p>
              {patient.allergies && (
                <p className="text-xs text-red-600 flex items-center gap-1 mt-0.5">
                  <AlertTriangle className="w-3 h-3" /> {patient.allergies}
                </p>
              )}
            </div>
          </div>

          <Select
            label="Visit Type"
            value={visitType}
            onChange={(e) => setVisitType(e.target.value as any)}
            options={[
              { value: "WALK_IN", label: "Walk-in" },
              { value: "ONLINE", label: "Online Booking" },
            ]}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Chief Complaint <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none bg-white"
              rows={3}
              placeholder="Main reason for visit…"
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
            />
          </div>

          <div className="flex gap-3 pt-1">
            <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button
              className="flex-1"
              loading={mutation.isPending}
              onClick={() => mutation.mutate()}
              icon={<Plus className="w-4 h-4" />}
            >
              Create Visit
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── Staff picker card ────────────────────────────────────────────────────────

function StaffCard({
  name,
  sub,
  busy,
  selected,
  onClick,
  avatarColor,
}: {
  name: string;
  sub: string;
  busy: boolean;
  selected: boolean;
  onClick: () => void;
  avatarColor: string;
}) {
  const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all",
        selected
          ? "border-primary-500 bg-primary-50"
          : busy
          ? "border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed"
          : "border-gray-100 bg-white hover:border-primary-300 hover:bg-primary-50/40 cursor-pointer"
      )}
    >
      <div className={cn("w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0", avatarColor)}>
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
        <p className="text-xs text-gray-500 truncate">{sub}</p>
      </div>
      <span className={cn(
        "text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0",
        busy ? "bg-red-100 text-red-600" : "bg-green-100 text-green-700"
      )}>
        {busy ? "Busy" : "Free"}
      </span>
      {selected && <CheckCircle className="w-4 h-4 text-primary-600 flex-shrink-0" />}
    </button>
  );
}

// ─── Assign Staff Modal ───────────────────────────────────────────────────────

// ─── Nurse Assignment Overlay (full-screen, ward filter, no doctor) ───────────

interface NurseWithWard {
  id: string;
  ward?: string;
  busy: boolean;
  activeVisits: number;
  isAvailable?: boolean;
  user: { name: string };
  department?: { id: string; name: string } | null;
}

function NurseAssignOverlay({
  open,
  visit,
  onClose,
  onTicket,
}: {
  open: boolean;
  visit: Visit | null;
  onClose: () => void;
  onTicket: (t: TicketData) => void;
}) {
  const qc = useQueryClient();
  const [wardFilter, setWardFilter] = useState("ALL");
  const [assigningId, setAssigningId] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["nurses-overlay"],
    queryFn: fetchNurses,
    enabled: open,
    staleTime: 15_000,
    refetchInterval: open ? 20_000 : false,
  });

  const nurses: NurseWithWard[] = data?.nurses ?? [];

  // Build ward list from nurses
  const wards = [
    "ALL",
    ...Array.from(new Set(nurses.map(n => n.ward).filter(Boolean) as string[])).sort(),
  ];

  const filtered = wardFilter === "ALL"
    ? nurses
    : nurses.filter(n => n.ward === wardFilter);

  const availableCount = filtered.filter(n => !n.busy).length;

  const assignMutation = useMutation({
    mutationFn: async (nurseId: string) => {
      const res = await fetch(`/api/visits/${visit!.id}/assign-nurse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nurseId }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Failed"); }
      return res.json();
    },
    onSuccess: (data, nurseId) => {
      const nurse = nurses.find(n => n.id === nurseId);
      const qNum = data?.visit?.queueNumber;
      toast.success(
        `Queue #${qNum ?? "—"} — ${nurse?.user.name ?? "Nurse"} assigned · Patient is now IN TRIAGE`,
        { duration: 5000 }
      );
      qc.invalidateQueries({ queryKey: ["active-queue"] });
      qc.invalidateQueries({ queryKey: ["nurses-overlay"] });
      qc.invalidateQueries({ queryKey: ["visits-appointments"] });
      setAssigningId("");
      // Show ticket first, then close overlay
      if (visit) {
        onTicket({
          queueNumber: qNum ?? 0,
          patientName: visit.patient.name,
          patientPhone: visit.patient.phone,
          patientGender: visit.patient.gender,
          chiefComplaint: visit.chiefComplaint,
          nurseName: nurse?.user.name ?? "—",
          departmentName: nurse?.department?.name,
          ward: nurse?.ward,
          visitType: visit.visitType,
          createdAt: new Date().toISOString(),
        });
      }
      onClose();
    },
    onError: (e: any) => { toast.error(e.message); setAssigningId(""); },
  });

  // Reset on close
  useEffect(() => {
    if (!open) { setWardFilter("ALL"); setAssigningId(""); }
  }, [open]);

  if (!open || !visit) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex flex-col"
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="flex-1 bg-gray-50 flex flex-col overflow-hidden mt-16 rounded-t-3xl"
          >
            {/* ── Top bar ── */}
            <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-4">
                <button
                  onClick={onClose}
                  className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors px-3 py-1.5 rounded-xl hover:bg-gray-100"
                >
                  <X className="w-4 h-4" /> Close
                </button>
                <div className="h-5 w-px bg-gray-200" />
                <h2 className="text-lg font-bold text-gray-900">Assign Nurse</h2>
              </div>

              {/* Ward filter pills */}
              <div className="flex items-center gap-2 flex-wrap">
                {wards.map(w => (
                  <button
                    key={w}
                    onClick={() => setWardFilter(w)}
                    className={cn(
                      "text-xs font-semibold px-3 py-1.5 rounded-full border transition-all",
                      wardFilter === w
                        ? "bg-green-600 text-white border-green-600"
                        : "bg-white text-gray-600 border-gray-200 hover:border-green-300 hover:text-green-700"
                    )}
                  >
                    {w === "ALL" ? "All Wards" : `Ward: ${w}`}
                  </button>
                ))}
                <button
                  onClick={() => refetch()}
                  className="p-1.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-400 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* ── Patient summary strip ── */}
            <div className="bg-blue-50 border-b border-blue-100 px-6 py-3 flex items-center gap-4 flex-shrink-0">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-sm flex-shrink-0">
                {visit.patient.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-gray-900">{visit.patient.name}</p>
                  <StatusBadge status={visit.status} />
                  <span className="text-xs text-gray-500">Queue #{visit.queueNumber ?? "—"}</span>
                  {visit.visitType === "ONLINE" && (
                    <span className="text-xs font-semibold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">Online</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {visit.patient.phone} · {visit.patient.gender}
                  {visit.chiefComplaint ? ` · ${visit.chiefComplaint}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs font-semibold text-green-700 bg-green-100 px-2.5 py-1 rounded-full">
                  {availableCount} available
                </span>
                <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                  {filtered.length} total
                </span>
              </div>
            </div>

            {/* ── Nurse grid ── */}
            <div className="flex-1 overflow-y-auto p-6">
              {isLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {[1,2,3,4,5,6,7,8].map(i => (
                    <div key={i} className="h-44 bg-gray-200 rounded-2xl animate-pulse" />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                  <User className="w-12 h-12 mb-3 text-gray-200" />
                  <p className="font-medium">No nurses in this ward</p>
                  <button onClick={() => setWardFilter("ALL")} className="mt-2 text-sm text-green-600 hover:underline">
                    Show all wards
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {filtered.map(nurse => {
                    const isBusy = nurse.busy;
                    const isAssigning = assigningId === nurse.id && assignMutation.isPending;
                    const initials = nurse.user.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

                    return (
                      <motion.div
                        key={nurse.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={cn(
                          "bg-white rounded-2xl border-2 shadow-sm overflow-hidden transition-all duration-200",
                          isBusy
                            ? "border-gray-100 opacity-55"
                            : "border-gray-100 hover:border-green-300 hover:shadow-md"
                        )}
                      >
                        {/* Status bar */}
                        <div className={cn("h-1.5", isBusy ? "bg-red-400" : "bg-green-400")} />

                        <div className="p-4 space-y-3">
                          {/* Avatar */}
                          <div className="flex flex-col items-center gap-2 pt-1">
                            <div className={cn(
                              "w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl",
                              isBusy ? "bg-red-100 text-red-600" : "bg-green-100 text-green-700"
                            )}>
                              {initials}
                            </div>
                            <div className="text-center">
                              <p className="font-bold text-gray-900 text-sm leading-tight">{nurse.user.name}</p>
                              {nurse.ward && (
                                <p className="text-xs text-gray-500 mt-0.5">Ward {nurse.ward}</p>
                              )}
                              {nurse.department && (
                                <p className="text-xs text-gray-400">{nurse.department.name}</p>
                              )}
                            </div>
                          </div>

                          {/* Status badge */}
                          <div className="flex justify-center">
                            <span className={cn(
                              "inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full",
                              isBusy ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                            )}>
                              <span className={cn("w-1.5 h-1.5 rounded-full", isBusy ? "bg-red-500" : "bg-green-500 animate-pulse")} />
                              {isBusy ? "In Triage" : "Available"}
                            </span>
                          </div>

                          {/* Assign button */}
                          {!isBusy ? (
                            <Button
                              size="sm"
                              className="w-full justify-center"
                              loading={isAssigning}
                              disabled={assignMutation.isPending}
                              onClick={() => {
                                setAssigningId(nurse.id);
                                assignMutation.mutate(nurse.id);
                              }}
                              icon={<UserCheck className="w-3.5 h-3.5" />}
                            >
                              Assign
                            </Button>
                          ) : (
                            <div className="flex items-center justify-center gap-1 text-xs text-red-400 bg-red-50 rounded-xl py-2">
                              <Clock className="w-3.5 h-3.5" /> Busy
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Staff Availability Panel ─────────────────────────────────────────────────

function StaffPanel() {
  const { data: doctorData, isLoading: loadingDoctors } = useQuery({
    queryKey: ["doctors-all"],
    queryFn: fetchDoctors,
    staleTime: 30_000,
  });
  const { data: nurseData, isLoading: loadingNurses } = useQuery({
    queryKey: ["nurses"],
    queryFn: fetchNurses,
    staleTime: 30_000,
  });

  const doctors = doctorData?.doctors ?? [];
  const nurses = nurseData?.nurses ?? [];

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
      <h2 className="font-semibold text-gray-900 flex items-center gap-2">
        <Activity className="w-4 h-4 text-primary-600" />
        Available Staff
      </h2>

      {/* Doctors */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
          <Stethoscope className="w-3.5 h-3.5" /> Doctors ({doctors.length})
        </p>
        {loadingDoctors ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : doctors.length === 0 ? (
          <p className="text-xs text-gray-400 italic">No doctors registered</p>
        ) : (
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {doctors.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-2.5 p-2.5 rounded-lg bg-gray-50 border border-gray-100"
              >
                <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {d.user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-900 truncate">Dr. {d.user.name}</p>
                  <p className="text-xs text-gray-500 truncate">{d.specialization} · {d.department.name}</p>
                </div>
                <span className={cn(
                  "text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0",
                  d.busy
                    ? "bg-red-100 text-red-700"
                    : "bg-green-100 text-green-700"
                )}>
                  {d.busy ? "Busy" : "Available"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Nurses */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
          <User className="w-3.5 h-3.5" /> Nurses ({nurses.length})
        </p>
        {loadingNurses ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : nurses.length === 0 ? (
          <p className="text-xs text-gray-400 italic">No nurses registered</p>
        ) : (
          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            {nurses.map((n) => (
              <div
                key={n.id}
                className="flex items-center gap-2.5 p-2.5 rounded-lg bg-gray-50 border border-gray-100"
              >
                <div className="w-7 h-7 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {n.user.name.split(" ").map((x) => x[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-900 truncate">{n.user.name}</p>
                  {n.ward && <p className="text-xs text-gray-500 truncate">Ward: {n.ward}</p>}
                </div>
                <span className={cn(
                  "text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0",
                  n.busy
                    ? "bg-red-100 text-red-700"
                    : "bg-green-100 text-green-700"
                )}>
                  {n.busy ? "In Triage" : "Available"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Active Queue Panel ───────────────────────────────────────────────────────

const STATUS_ORDER = [
  "WAITING_TRIAGE",
  "IN_TRIAGE",
  "WAITING_DOCTOR",
  "IN_CONSULTATION",
  "COMPLETED",
  "CANCELLED",
];

function QueuePanel({
  onAssignNurse,
  onPrintTicket,
}: {
  onAssignNurse: (v: Visit) => void;
  onPrintTicket: (v: Visit) => void;
}) {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["active-queue", statusFilter],
    queryFn: () =>
      fetch(`/api/visits?limit=50${statusFilter ? `&status=${statusFilter}` : ""}`)
        .then((r) => r.json()),
    refetchInterval: 30_000,
  });

  const cancelVisit = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/visits/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      toast.success("Visit cancelled");
      qc.invalidateQueries({ queryKey: ["active-queue"] });
    },
    onError: () => toast.error("Failed to cancel"),
  });

  const visits: Visit[] = data?.visits ?? [];
  const total: number = data?.total ?? 0;

  const activeCount = visits.filter(
    (v) => !["COMPLETED", "CANCELLED"].includes(v.status)
  ).length;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <Hash className="w-4 h-4 text-primary-600" />
          Active Queue
          {activeCount > 0 && (
            <span className="text-xs font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
              {activeCount} active
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All statuses</option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
            ))}
          </select>
          <button
            onClick={() => refetch()}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            title="Refresh queue"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : visits.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <Clock className="w-8 h-8 mx-auto mb-2 text-gray-200" />
          <p className="text-sm">No visits in queue</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
          {visits.map((v) => (
            <motion.div
              key={v.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              className={cn(
                "rounded-xl border p-3 space-y-2 transition-colors",
                v.status === "WAITING_TRIAGE" && "border-orange-200 bg-orange-50/40",
                v.status === "IN_TRIAGE" && "border-yellow-200 bg-yellow-50/40",
                v.status === "WAITING_DOCTOR" && "border-purple-200 bg-purple-50/40",
                v.status === "IN_CONSULTATION" && "border-blue-200 bg-blue-50/40",
                v.status === "COMPLETED" && "border-green-200 bg-green-50/30",
                v.status === "CANCELLED" && "border-gray-200 bg-gray-50/30 opacity-60",
              )}
            >
              {/* Row 1: queue # + patient + status */}
              <div className="flex items-center gap-2">
                <span className="text-lg font-black text-gray-300 w-8 text-center flex-shrink-0">
                  #{v.queueNumber ?? "—"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{v.patient.name}</p>
                  <p className="text-xs text-gray-500">
                    {v.patient.phone} · {v.patient.gender}
                    {v.visitType === "ONLINE" && (
                      <span className="ml-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full">
                        Online
                      </span>
                    )}
                  </p>
                </div>
                <StatusBadge status={v.status} />
              </div>

              {/* Row 2: assigned staff + complaint */}
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500 pl-10">
                {v.chiefComplaint && (
                  <span className="truncate max-w-[180px]">📋 {v.chiefComplaint}</span>
                )}
                {v.nurse && (
                  <span className="text-green-700">👩‍⚕️ {v.nurse.user.name}</span>
                )}
                {v.doctor && (
                  <span className="text-blue-700">🩺 Dr. {v.doctor.user.name}</span>
                )}
                <span className="text-gray-400">{formatDateTime(v.createdAt)}</span>
              </div>

              {/* Row 3: actions */}
              {v.status === "WAITING_TRIAGE" && (
                <div className="flex gap-2 pl-10">
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<UserCheck className="w-3.5 h-3.5" />}
                    onClick={() => onAssignNurse(v)}
                  >
                    Assign Nurse
                  </Button>
                  <button
                    onClick={() => cancelVisit.mutate(v.id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                    title="Cancel visit"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              {!["COMPLETED", "CANCELLED", "WAITING_TRIAGE"].includes(v.status) && (
                <div className="flex gap-2 pl-10">
                  {v.queueNumber && (
                    <button
                      onClick={() => onPrintTicket(v)}
                      className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-orange-50 hover:border-orange-200 hover:text-orange-600 text-gray-500 transition-colors"
                      title="Print ticket"
                    >
                      <Printer className="w-3.5 h-3.5" /> Print Ticket
                    </button>
                  )}
                  <button
                    onClick={() => cancelVisit.mutate(v.id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                    title="Cancel visit"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {total > 0 && (
        <p className="text-xs text-gray-400 text-right">{total} total visits today</p>
      )}
    </div>
  );
}

// ─── Root Dashboard ───────────────────────────────────────────────────────────

export function ReceptionistDashboard() {
  const qc = useQueryClient();

  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [createVisitOpen, setCreateVisitOpen] = useState(false);
  const [assignVisit, setAssignVisit] = useState<Visit | null>(null);
  const [ticket, setTicket] = useState<TicketData | null>(null);

  const handlePatientSelect = (p: Patient) => {
    setSelectedPatient(p);
    setCreateVisitOpen(true);
  };

  const handleVisitCreated = () => {
    qc.invalidateQueries({ queryKey: ["active-queue"] });
    setSelectedPatient(null);
  };

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {selectedPatient && !createVisitOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl"
          >
            <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <p className="text-sm text-blue-800 font-medium flex-1">
              Patient selected: <strong>{selectedPatient.name}</strong>
            </p>
            <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setCreateVisitOpen(true)}>
              Create Visit
            </Button>
            <button onClick={() => setSelectedPatient(null)} className="p-1 rounded hover:bg-blue-100 text-blue-400">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-1 space-y-5">
          <PatientSearchPanel onSelect={handlePatientSelect} />
          <StaffPanel />
        </div>
        <div className="lg:col-span-2">
          <QueuePanel
            onAssignNurse={(v) => setAssignVisit(v)}
            onPrintTicket={(v) => {
              printTicket({
                queueNumber: v.queueNumber ?? 0,
                patientName: v.patient.name,
                patientPhone: v.patient.phone,
                patientGender: v.patient.gender,
                chiefComplaint: v.chiefComplaint,
                nurseName: v.nurse?.user.name ?? "—",
                departmentName: v.department?.name,
                visitType: v.visitType,
                createdAt: v.createdAt,
              });
            }}
          />
        </div>
      </div>

      <CreateVisitModal
        open={createVisitOpen}
        patient={selectedPatient}
        onClose={() => setCreateVisitOpen(false)}
        onCreated={handleVisitCreated}
      />

      <NurseAssignOverlay
        open={!!assignVisit}
        visit={assignVisit}
        onClose={() => setAssignVisit(null)}
        onTicket={(t) => setTicket(t)}
      />

      <QueueTicketModal ticket={ticket} onClose={() => setTicket(null)} />
    </div>
  );
}
