"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, RefreshCw, Activity } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/Badge";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { CreateVisitModal } from "./CreateVisitModal";
import { VisitDetailPanel } from "./VisitDetailPanel";
import { useSession } from "@/lib/auth-client";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "WAITING_TRIAGE", label: "Waiting Triage" },
  { value: "IN_TRIAGE", label: "In Triage" },
  { value: "WAITING_DOCTOR", label: "Waiting Doctor" },
  { value: "IN_CONSULTATION", label: "In Consultation" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

const STATUS_STEP: Record<string, number> = {
  WAITING_TRIAGE: 1,
  IN_TRIAGE: 2,
  WAITING_DOCTOR: 3,
  IN_CONSULTATION: 4,
  COMPLETED: 5,
  CANCELLED: 0,
};

const VISIT_TYPE_BADGE: Record<string, string> = {
  WALK_IN: "bg-cyan-100 text-cyan-700",
  ONLINE: "bg-indigo-100 text-indigo-700",
};

async function fetchVisits(search: string, status: string, page: number) {
  const params = new URLSearchParams({ search, page: String(page), limit: "20" });
  if (status) params.set("status", status);
  const res = await fetch(`/api/visits?${params}`);
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

export function VisitQueueClient() {
  const { data: session } = useSession();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedVisitId, setSelectedVisitId] = useState<string | null>(null);
  const qc = useQueryClient();

  const role = session?.user?.role as string;
  const canCreate = ["ADMIN", "RECEPTIONIST", "PATIENT"].includes(role);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["visits", search, status, page],
    queryFn: () => fetchVisits(search, status, page),
    refetchInterval: 15000, // auto-refresh every 15s
  });

  return (
    <div className="flex gap-6 h-full">
      {/* ── Left: Queue list ── */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex gap-3 w-full sm:w-auto">
            <SearchInput
              value={search}
              onChange={(v) => setSearch(v)}
              placeholder="Search patient..."
              className="w-full sm:w-56"
            />
            <Select
              options={STATUS_OPTIONS}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-44"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
              title="Refresh queue"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            {canCreate && (
              <Button icon={<Plus className="w-4 h-4" />} onClick={() => setCreateOpen(true)}>
                {role === "PATIENT" ? "Request Visit" : "New Visit"}
              </Button>
            )}
          </div>
        </div>

        {/* Stats bar */}
        {data && (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {[
              { label: "Waiting Triage", key: "WAITING_TRIAGE", color: "bg-orange-50 text-orange-700 border-orange-100" },
              { label: "In Triage", key: "IN_TRIAGE", color: "bg-yellow-50 text-yellow-700 border-yellow-100" },
              { label: "Waiting Doctor", key: "WAITING_DOCTOR", color: "bg-purple-50 text-purple-700 border-purple-100" },
              { label: "In Consultation", key: "IN_CONSULTATION", color: "bg-blue-50 text-blue-700 border-blue-100" },
              { label: "Completed", key: "COMPLETED", color: "bg-green-50 text-green-700 border-green-100" },
              { label: "Cancelled", key: "CANCELLED", color: "bg-gray-50 text-gray-600 border-gray-100" },
            ].map((s) => {
              const count = data.visits?.filter((v: any) => v.status === s.key).length ?? 0;
              return (
                <button
                  key={s.key}
                  onClick={() => setStatus(status === s.key ? "" : s.key)}
                  className={cn(
                    "rounded-xl border p-2 text-center transition-all cursor-pointer",
                    s.color,
                    status === s.key ? "ring-2 ring-offset-1 ring-current" : "hover:opacity-80"
                  )}
                >
                  <p className="text-lg font-bold">{count}</p>
                  <p className="text-xs font-medium leading-tight">{s.label}</p>
                </button>
              );
            })}
          </div>
        )}

        {/* Queue table */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-card border border-gray-100 overflow-hidden"
        >
          {isLoading ? (
            <div className="p-6"><TableSkeleton rows={8} cols={5} /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="table-header">Patient</th>
                    <th className="table-header">Type</th>
                    <th className="table-header">Chief Complaint</th>
                    <th className="table-header">Nurse</th>
                    <th className="table-header">Doctor</th>
                    <th className="table-header">Status</th>
                    <th className="table-header">Arrived</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data?.visits?.length === 0 && (
                    <tr>
                      <td colSpan={7} className="table-cell text-center py-16">
                        <div className="flex flex-col items-center gap-2 text-gray-400">
                          <Activity className="w-10 h-10 text-gray-200" />
                          <p>No visits in queue</p>
                        </div>
                      </td>
                    </tr>
                  )}
                  <AnimatePresence>
                    {data?.visits?.map((visit: any) => (
                      <motion.tr
                        key={visit.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSelectedVisitId(visit.id === selectedVisitId ? null : visit.id)}
                        className={cn(
                          "hover:bg-blue-50/40 transition-colors cursor-pointer",
                          selectedVisitId === visit.id && "bg-blue-50 border-l-2 border-l-blue-500"
                        )}
                      >
                        <td className="table-cell">
                          <div>
                            <p className="font-semibold text-gray-900">{visit.patient?.name}</p>
                            <p className="text-xs text-gray-400">{visit.patient?.phone}</p>
                            {visit.patient?.allergies && (
                              <p className="text-xs text-red-500 font-medium">⚠ {visit.patient.allergies}</p>
                            )}
                          </div>
                        </td>
                        <td className="table-cell">
                          <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", VISIT_TYPE_BADGE[visit.visitType])}>
                            {visit.visitType === "WALK_IN" ? "Walk-in" : "Online"}
                          </span>
                        </td>
                        <td className="table-cell text-gray-500 max-w-xs truncate">
                          {visit.chiefComplaint || "—"}
                        </td>
                        <td className="table-cell text-gray-500 text-sm">
                          {visit.nurse?.user?.name || <span className="text-gray-300">Unassigned</span>}
                        </td>
                        <td className="table-cell text-gray-500 text-sm">
                          {visit.doctor?.user?.name
                            ? `Dr. ${visit.doctor.user.name}`
                            : <span className="text-gray-300">Unassigned</span>}
                        </td>
                        <td className="table-cell">
                          <StatusBadge status={visit.status} />
                        </td>
                        <td className="table-cell text-gray-400 text-xs">
                          {formatDateTime(visit.createdAt)}
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </div>

      {/* ── Right: Visit detail panel ── */}
      <AnimatePresence>
        {selectedVisitId && (
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ duration: 0.25 }}
            className="w-[420px] flex-shrink-0"
          >
            <VisitDetailPanel
              visitId={selectedVisitId}
              onClose={() => setSelectedVisitId(null)}
              onUpdate={() => qc.invalidateQueries({ queryKey: ["visits"] })}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <CreateVisitModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(id) => {
          qc.invalidateQueries({ queryKey: ["visits"] });
          setSelectedVisitId(id);
        }}
      />
    </div>
  );
}
