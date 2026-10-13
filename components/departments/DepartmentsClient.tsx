"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plus, Edit, Trash2, Building2, Users, UserRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { departmentSchema, DepartmentInput } from "@/lib/validations";
import toast from "react-hot-toast";

async function fetchDepartments() {
  const res = await fetch("/api/departments");
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

const DEPT_ICONS: Record<string, string> = {
  Cardiology: "❤️",
  Neurology: "🧠",
  Emergency: "🚨",
  Radiology: "🔬",
  Laboratory: "🧪",
};

export function DepartmentsClient() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editDept, setEditDept] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const qc = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ["departments"], queryFn: fetchDepartments });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DepartmentInput>({ resolver: zodResolver(departmentSchema) });

  const mutation = useMutation({
    mutationFn: async (formData: DepartmentInput) => {
      const url = editDept ? `/api/departments/${editDept.id}` : "/api/departments";
      const method = editDept ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      toast.success(editDept ? "Department updated" : "Department created");
      qc.invalidateQueries({ queryKey: ["departments"] });
      handleClose();
    },
    onError: () => toast.error("Something went wrong"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/departments/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      toast.success("Department deleted");
      qc.invalidateQueries({ queryKey: ["departments"] });
      setDeleteId(null);
    },
    onError: () => toast.error("Failed to delete"),
  });

  const handleEdit = (dept: any) => {
    setEditDept(dept);
    reset({ name: dept.name, description: dept.description || "" });
    setModalOpen(true);
  };

  const handleClose = () => {
    setModalOpen(false);
    setEditDept(null);
    reset({ name: "", description: "" });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => setModalOpen(true)}>
          Add Department
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {data?.departments?.map((dept: any, i: number) => (
            <motion.div
              key={dept.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ y: -2 }}
              className="bg-white rounded-xl shadow-card border border-gray-100 p-6"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center text-2xl">
                    {DEPT_ICONS[dept.name] || "🏥"}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{dept.name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{dept.description || "No description"}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEdit(dept)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteId(dept.id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex gap-4 mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center gap-1.5 text-sm text-gray-500">
                  <Users className="w-4 h-4 text-blue-400" />
                  <span>{dept._count?.doctors ?? 0} doctors</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-gray-500">
                  <UserRound className="w-4 h-4 text-green-400" />
                  <span>{dept._count?.patients ?? 0} patients</span>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Modal */}
      <Modal open={modalOpen} onClose={handleClose} title={editDept ? "Edit Department" : "Add Department"} size="sm">
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <Input label="Department Name" placeholder="e.g. Cardiology" error={errors.name?.message} {...register("name")} />
          <div>
            <label className="label">Description</label>
            <textarea className="input resize-none" rows={3} placeholder="Brief description..." {...register("description")} />
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" type="button" onClick={handleClose}>Cancel</Button>
            <Button className="flex-1" type="submit" loading={mutation.isPending}>
              {editDept ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
