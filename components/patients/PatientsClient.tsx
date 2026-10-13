"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plus, Eye, Edit, Trash2, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { Pagination } from "@/components/ui/Pagination";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PatientModal } from "./PatientModal";
import { PatientDetailModal } from "./PatientDetailModal";
import { formatDate } from "@/lib/utils";
import { useSession } from "@/lib/auth-client";
import toast from "react-hot-toast";

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "REGISTERED", label: "Registered" },
  { value: "WAITING", label: "Waiting" },
  { value: "IN_CONSULTATION", label: "In Consultation" },
  { value: "ADMITTED", label: "Admitted" },
  { value: "DISCHARGED", label: "Discharged" },
];

export function PatientsClient() {
  const { data: session } = useSession();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editPatient, setEditPatient] = useState<any>(null);
  const [viewPatient, setViewPatient] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const qc = useQueryClient();

  const canCreate = ["ADMIN", "RECEPTIONIST"].includes(session?.user?.role as string);
  const canDelete = session?.user?.role === "ADMIN";

  const { data, isLoading } = useQuery({
    queryKey: ["patients", search, status, page],
    queryFn: async () => {
      const params = new URLSearchParams({ search, page: String(page), limit: "15" });
      if (status) params.set("status", status);
      const res = await fetch(`/api/patients?${params}`);
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/patients/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => { toast.success("Patient deleted"); qc.invalidateQueries({ queryKey: ["patients"] }); setDeleteId(null); },
    onError: () => toast.error("Failed to delete"),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-3 w-full sm:w-auto">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search patients..." className="w-full sm:w-64" />
          <Select options={STATUS_OPTIONS} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-44" />
        </div>
        {canCreate && (
          <Button icon={<Plus className="w-4 h-4" />} onClick={() => setModalOpen(true)}>Register Patient</Button>
        )}
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-xl shadow-card border border-gray-100 overflow-hidden">
        {isLoading ? <div className="p-6"><TableSkeleton rows={8} cols={6} /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="table-header">Patient</th>
                  <th className="table-header">FAN / National ID</th>
                  <th className="table-header">Gender</th>
                  <th className="table-header">Phone</th>
                  <th className="table-header">Blood Group</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Registered</th>
                  <th className="table-header">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data?.patients?.length === 0 && (
                  <tr><td colSpan={8} className="table-cell text-center text-gray-400 py-12">
                    <div className="flex flex-col items-center gap-2"><UserCheck className="w-8 h-8 text-gray-200" />No patients found</div>
                  </td></tr>
                )}
                {data?.patients?.map((p: any) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="table-cell">
                      <div>
                        <p className="font-medium text-gray-900">{p.name}</p>
                        {p.allergies && <p className="text-xs text-red-500">⚠ {p.allergies}</p>}
                      </div>
                    </td>
                    <td className="table-cell">
                      <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{p.id}</span>
                    </td>
                    <td className="table-cell text-gray-500">{p.gender}</td>
                    <td className="table-cell text-gray-500">{p.phone}</td>
                    <td className="table-cell text-gray-500">{p.bloodGroup || "—"}</td>
                    <td className="table-cell"><StatusBadge status={p.status} /></td>
                    <td className="table-cell text-gray-500">{formatDate(p.createdAt)}</td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setViewPatient(p)} className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"><Eye className="w-4 h-4" /></button>
                        {canCreate && <button onClick={() => { setEditPatient(p); setModalOpen(true); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"><Edit className="w-4 h-4" /></button>}
                        {canDelete && <button onClick={() => setDeleteId(p.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <div className="px-6 py-4 border-t border-gray-100"><Pagination page={page} total={data.total} limit={15} onPageChange={setPage} /></div>}
      </motion.div>

      <PatientModal open={modalOpen} onClose={() => { setModalOpen(false); setEditPatient(null); }} patient={editPatient} />
      {viewPatient && <PatientDetailModal open={!!viewPatient} onClose={() => setViewPatient(null)} patientId={viewPatient.id} />}
      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => deleteId && deleteMutation.mutate(deleteId)} loading={deleteMutation.isPending} />
    </div>
  );
}
