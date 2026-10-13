"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plus, Edit, Trash2, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/SearchInput";
import { Pagination } from "@/components/ui/Pagination";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DoctorModal } from "./DoctorModal";
import toast from "react-hot-toast";

async function fetchDoctors(search: string, page: number) {
  const res = await fetch(`/api/doctors?search=${encodeURIComponent(search)}&page=${page}&limit=10`);
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

async function deleteDoctor(id: string) {
  const res = await fetch(`/api/doctors/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed");
}

export function DoctorsClient() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editDoctor, setEditDoctor] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["doctors", search, page],
    queryFn: () => fetchDoctors(search, page),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDoctor,
    onSuccess: () => {
      toast.success("Doctor removed");
      qc.invalidateQueries({ queryKey: ["doctors"] });
      setDeleteId(null);
    },
    onError: () => toast.error("Failed to delete"),
  });

  const handleEdit = (doctor: any) => {
    setEditDoctor(doctor);
    setModalOpen(true);
  };

  const handleClose = () => {
    setModalOpen(false);
    setEditDoctor(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <SearchInput
          value={search}
          onChange={(v) => { setSearch(v); setPage(1); }}
          placeholder="Search doctors..."
          className="w-full sm:w-72"
        />
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => setModalOpen(true)}>
          Add Doctor
        </Button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl shadow-card border border-gray-100 overflow-hidden"
      >
        {isLoading ? (
          <div className="p-6"><TableSkeleton rows={6} cols={5} /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="table-header">Doctor</th>
                  <th className="table-header">Specialization</th>
                  <th className="table-header">Department</th>
                  <th className="table-header">Availability</th>
                  <th className="table-header">Contact</th>
                  <th className="table-header">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data?.doctors?.length === 0 && (
                  <tr>
                    <td colSpan={6} className="table-cell text-center text-gray-400 py-12">
                      <div className="flex flex-col items-center gap-2">
                        <Stethoscope className="w-8 h-8 text-gray-300" />
                        No doctors found
                      </div>
                    </td>
                  </tr>
                )}
                {data?.doctors?.map((doctor: any) => (
                  <tr key={doctor.id} className="hover:bg-gray-50 transition-colors">
                    <td className="table-cell">
                      <div>
                        <p className="font-medium text-gray-900">Dr. {doctor.user?.name}</p>
                        <p className="text-xs text-gray-400">{doctor.user?.email}</p>
                      </div>
                    </td>
                    <td className="table-cell">{doctor.specialization}</td>
                    <td className="table-cell">{doctor.department?.name}</td>
                    <td className="table-cell text-gray-500">{doctor.availability || "—"}</td>
                    <td className="table-cell text-gray-500">{doctor.user?.phone || "—"}</td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEdit(doctor)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteId(doctor.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && (
          <div className="px-6 py-4 border-t border-gray-100">
            <Pagination page={page} total={data.total} limit={10} onPageChange={setPage} />
          </div>
        )}
      </motion.div>

      <DoctorModal open={modalOpen} onClose={handleClose} doctor={editDoctor} />

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        loading={deleteMutation.isPending}
        message="Remove this doctor from the system?"
      />
    </div>
  );
}
