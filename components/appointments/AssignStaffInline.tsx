"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserCheck, Stethoscope, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

interface Visit {
  id: string;
  status: string;
  nurse?: { user: { name: string } };
  doctor?: { user: { name: string } };
}

function StaffCard({
  name, sub, busy, selected, onClick, color,
}: {
  name: string; sub: string; busy: boolean; selected: boolean; onClick: () => void; color: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={cn(
        "w-full flex items-center gap-2.5 p-2.5 rounded-xl border-2 text-left transition-all",
        selected ? "border-primary-500 bg-primary-50"
          : busy ? "border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed"
          : "border-gray-100 bg-white hover:border-primary-300 hover:bg-primary-50/40"
      )}
    >
      <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0", color)}>
        {name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-900 truncate">{name}</p>
        <p className="text-xs text-gray-500 truncate">{sub}</p>
      </div>
      <span className={cn("text-xs font-bold px-1.5 py-0.5 rounded-full flex-shrink-0",
        busy ? "bg-red-100 text-red-600" : "bg-green-100 text-green-700")}>
        {busy ? "Busy" : "Free"}
      </span>
      {selected && <CheckCircle className="w-3.5 h-3.5 text-primary-600 flex-shrink-0" />}
    </button>
  );
}

export function AssignStaffInline({ visit, onDone }: { visit: Visit; onDone: () => void }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"nurse" | "doctor">("nurse");
  const [nurseId, setNurseId] = useState("");
  const [doctorId, setDoctorId] = useState("");

  const { data: nurseData } = useQuery({
    queryKey: ["nurses"],
    queryFn: () => fetch("/api/nurses").then((r) => r.json()),
  });
  const { data: doctorData } = useQuery({
    queryKey: ["doctors-all"],
    queryFn: () => fetch("/api/doctors?limit=100").then((r) => r.json()),
  });

  const nurses = nurseData?.nurses ?? [];
  const doctors = doctorData?.doctors ?? [];

  const canAssignNurse = visit.status === "WAITING_TRIAGE";
  const canAssignDoctor = ["WAITING_TRIAGE", "IN_TRIAGE", "WAITING_DOCTOR"].includes(visit.status);

  const assignNurse = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/visits/${visit.id}/assign-nurse`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nurseId }),
      });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: (data) => {
      const qNum = data?.visit?.queueNumber;
      toast.success(
        `Queue #${qNum ?? "—"} — Nurse assigned · Patient is now IN TRIAGE`,
        { duration: 5000 }
      );
      qc.invalidateQueries({ queryKey: ["visits-appointments"] });
      qc.invalidateQueries({ queryKey: ["nurses"] });
      onDone();
    },
    onError: () => toast.error("Failed to assign nurse"),
  });

  const assignDoctor = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/visits/${visit.id}/assign-doctor`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doctorId }),
      });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      toast.success("Doctor assigned");
      qc.invalidateQueries({ queryKey: ["visits-appointments"] });
      qc.invalidateQueries({ queryKey: ["doctors-all"] });
      onDone();
    },
    onError: () => toast.error("Failed to assign doctor"),
  });

  return (
    <div className="border border-gray-100 rounded-xl p-3 bg-gray-50 space-y-3 mt-2">
      {/* Already assigned */}
      {(visit.nurse || visit.doctor) && (
        <div className="flex gap-2 flex-wrap">
          {visit.nurse && (
            <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">
              ✓ Nurse: {visit.nurse.user.name}
            </span>
          )}
          {visit.doctor && (
            <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
              ✓ Dr. {visit.doctor.user.name}
            </span>
          )}
        </div>
      )}

      {/* Tab */}
      <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold">
        <button onClick={() => setTab("nurse")}
          className={cn("flex-1 py-1.5 flex items-center justify-center gap-1 transition-colors",
            tab === "nurse" ? "bg-green-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50")}>
          <UserCheck className="w-3.5 h-3.5" /> Nurse
        </button>
        <button onClick={() => setTab("doctor")}
          className={cn("flex-1 py-1.5 flex items-center justify-center gap-1 transition-colors",
            tab === "doctor" ? "bg-blue-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50")}>
          <Stethoscope className="w-3.5 h-3.5" /> Doctor
        </button>
      </div>

      {/* Nurse picker */}
      {tab === "nurse" && (
        <div className="space-y-2">
          {!canAssignNurse ? (
            <p className="text-xs text-gray-400 italic">Nurse assignment only available at WAITING TRIAGE.</p>
          ) : nurses.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No nurses registered.</p>
          ) : (
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {nurses.map((n: any) => (
                <StaffCard key={n.id} name={n.user.name} sub={n.ward ? `Ward: ${n.ward}` : "General"}
                  busy={n.busy} selected={nurseId === n.id}
                  onClick={() => setNurseId(nurseId === n.id ? "" : n.id)}
                  color="bg-green-100 text-green-700" />
              ))}
            </div>
          )}
          {canAssignNurse && (
            <Button size="sm" className="w-full" disabled={!nurseId} loading={assignNurse.isPending}
              onClick={() => assignNurse.mutate()}>
              Assign Nurse
            </Button>
          )}
        </div>
      )}

      {/* Doctor picker */}
      {tab === "doctor" && (
        <div className="space-y-2">
          {!canAssignDoctor ? (
            <p className="text-xs text-gray-400 italic">Doctor assignment not available at this stage.</p>
          ) : doctors.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No doctors registered.</p>
          ) : (
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {doctors.map((d: any) => (
                <StaffCard key={d.id} name={`Dr. ${d.user.name}`}
                  sub={`${d.specialization} · ${d.department?.name ?? ""}`}
                  busy={d.busy} selected={doctorId === d.id}
                  onClick={() => setDoctorId(doctorId === d.id ? "" : d.id)}
                  color="bg-blue-100 text-blue-700" />
              ))}
            </div>
          )}
          {canAssignDoctor && (
            <Button size="sm" className="w-full" disabled={!doctorId} loading={assignDoctor.isPending}
              onClick={() => assignDoctor.mutate()}>
              Assign Doctor
            </Button>
          )}
        </div>
      )}

      <Button size="sm" variant="secondary" className="w-full" onClick={onDone}>Close</Button>
    </div>
  );
}
