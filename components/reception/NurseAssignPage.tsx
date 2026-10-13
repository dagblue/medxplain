"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, UserCheck, CheckCircle, Clock,
  AlertTriangle, RefreshCw, Building2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { cn, formatDateTime } from "@/lib/utils";
import toast from "react-hot-toast";

interface Nurse {
  id: string;
  ward?: string;
  isAvailable: boolean;
  busy: boolean;
  activeVisits: number;
  department?: { id: string; name: string } | null;
  user: { name: string };
}

interface Visit {
  id: string;
  queueNumber?: number;
  status: string;
  visitType: string;
  chiefComplaint?: string;
  createdAt: string;
  patient: { id: string; name: string; phone: string; gender: string; bloodGroup?: string; allergies?: string };
  nurse?: { user: { name: string } };
}

interface Props {
  visit: Visit;
  onBack: () => void;
  onAssigned: () => void;
}

export function NurseAssignPage({ visit, onBack, onAssigned }: Props) {
  const qc = useQueryClient();
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [selectedNurseId, setSelectedNurseId] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["nurses-assign"],
    queryFn: () => fetch("/api/nurses").then(r => r.json()),
    staleTime: 15_000,
    refetchInterval: 20_000,
  });

  const nurses: Nurse[] = data?.nurses ?? [];

  // Build department list from nurses
  const departments = [
    { id: "ALL", name: "All Departments" },
    ...Array.from(
      new Map(
        nurses
          .filter(n => n.department)
          .map(n => [n.department!.id, n.department!])
      ).values()
    ).sort((a, b) => a.name.localeCompare(b.name)),
    // nurses with no department
    ...(nurses.some(n => !n.department) ? [{ id: "NONE", name: "No Department" }] : []),
  ];

  const filtered = nurses.filter(n => {
    if (deptFilter === "ALL") return true;
    if (deptFilter === "NONE") return !n.department;
    return n.department?.id === deptFilter;
  });

  const availableCount = filtered.filter(n => !n.busy).length;
  const busyCount = filtered.filter(n => n.busy).length;

  const assignMutation = useMutation({
    mutationFn: async (nurseId: string) => {
      const res = await fetch(`/api/visits/${visit.id}/assign-nurse`, {
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
      qc.invalidateQueries({ queryKey: ["nurses-assign"] });
      qc.invalidateQueries({ queryKey: ["visits-appointments"] });
      onAssigned();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors px-3 py-2 rounded-xl hover:bg-gray-100"
        >
          <ArrowLeft className="w-4 h-4" /> Back to queue
        </button>
        <div className="h-5 w-px bg-gray-200" />
        <h1 className="text-lg font-bold text-gray-900">Assign Nurse</h1>
      </div>

      {/* ── Patient summary card ── */}
      <div className="bg-white rounded-2xl border border-blue-100 shadow-sm p-5">
        <div className="flex items-start gap-4">
          {/* Queue number badge */}
          <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-orange-100 flex flex-col items-center justify-center">
            <span className="text-xs font-semibold text-orange-500 leading-none">Queue</span>
            <span className="text-2xl font-black text-orange-700 leading-none">{visit.queueNumber ?? "—"}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-lg font-bold text-gray-900">{visit.patient.name}</h2>
              <StatusBadge status={visit.status} />
              {visit.visitType === "ONLINE" && (
                <span className="text-xs font-semibold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">Online</span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {visit.patient.phone} · {visit.patient.gender}
              {visit.patient.bloodGroup ? ` · ${visit.patient.bloodGroup}` : ""}
            </p>
            {visit.patient.allergies && (
              <p className="text-sm text-red-600 flex items-center gap-1 mt-1">
                <AlertTriangle className="w-4 h-4" /> Allergies: {visit.patient.allergies}
              </p>
            )}
            {visit.chiefComplaint && (
              <p className="text-sm text-gray-600 mt-1">📋 {visit.chiefComplaint}</p>
            )}
          </div>
          <p className="text-xs text-gray-400 flex-shrink-0">{formatDateTime(visit.createdAt)}</p>
        </div>
      </div>

      {/* ── Toolbar: stats + dept filter + refresh ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Stats pills */}
          <span className="flex items-center gap-1.5 text-sm font-semibold text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            {availableCount} Available
          </span>
          <span className="flex items-center gap-1.5 text-sm font-semibold text-red-600 bg-red-50 border border-red-200 px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            {busyCount} Busy
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Department filter */}
          <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-3 py-2">
            <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <select
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}
              className="text-sm bg-transparent focus:outline-none text-gray-700 pr-1"
            >
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => refetch()}
            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-400 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Nurse grid ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="h-44 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <UserCheck className="w-12 h-12 mx-auto mb-3 text-gray-200" />
          <p className="text-base font-medium">No nurses in this department</p>
          <button onClick={() => setDeptFilter("ALL")} className="mt-2 text-sm text-primary-600 hover:underline">
            Show all departments
          </button>
        </div>
      ) : (
        <motion.div
          layout
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
        >
          <AnimatePresence mode="popLayout">
            {filtered.map(nurse => {
              const isSelected = selectedNurseId === nurse.id;
              const isBusy = nurse.busy;
              const initials = nurse.user.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

              return (
                <motion.div
                  key={nurse.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={cn(
                    "relative bg-white rounded-2xl border-2 shadow-sm transition-all duration-200 overflow-hidden",
                    isSelected
                      ? "border-primary-500 shadow-primary-100 shadow-lg"
                      : isBusy
                      ? "border-gray-100 opacity-60"
                      : "border-gray-100 hover:border-primary-200 hover:shadow-md cursor-pointer"
                  )}
                  onClick={() => !isBusy && setSelectedNurseId(isSelected ? "" : nurse.id)}
                >
                  {/* Top accent bar */}
                  <div className={cn(
                    "h-1.5 w-full",
                    isSelected ? "bg-primary-500" : isBusy ? "bg-red-400" : "bg-green-400"
                  )} />

                  <div className="p-5 space-y-4">
                    {/* Avatar + name */}
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg flex-shrink-0",
                        isSelected ? "bg-primary-100 text-primary-700"
                          : isBusy ? "bg-red-100 text-red-600"
                          : "bg-green-100 text-green-700"
                      )}>
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 truncate">{nurse.user.name}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {nurse.department?.name ?? "General"}
                          {nurse.ward ? ` · ${nurse.ward}` : ""}
                        </p>
                      </div>
                    </div>

                    {/* Status badge */}
                    <div className="flex items-center justify-between">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full",
                        isBusy
                          ? "bg-red-100 text-red-700"
                          : "bg-green-100 text-green-700"
                      )}>
                        <span className={cn("w-1.5 h-1.5 rounded-full", isBusy ? "bg-red-500" : "bg-green-500 animate-pulse")} />
                        {isBusy ? "In Triage" : "Available"}
                      </span>
                      {nurse.activeVisits > 0 && (
                        <span className="text-xs text-gray-400">{nurse.activeVisits} active</span>
                      )}
                    </div>

                    {/* Assign button */}
                    {!isBusy && (
                      <Button
                        size="sm"
                        className="w-full justify-center"
                        variant={isSelected ? "primary" : "secondary"}
                        loading={assignMutation.isPending && selectedNurseId === nurse.id}
                        disabled={assignMutation.isPending}
                        onClick={e => {
                          e.stopPropagation();
                          setSelectedNurseId(nurse.id);
                          assignMutation.mutate(nurse.id);
                        }}
                        icon={isSelected && !assignMutation.isPending ? <CheckCircle className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                      >
                        {assignMutation.isPending && selectedNurseId === nurse.id ? "Assigning…" : "Assign Nurse"}
                      </Button>
                    )}

                    {isBusy && (
                      <div className="flex items-center gap-1.5 text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">
                        <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                        Currently in triage
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
