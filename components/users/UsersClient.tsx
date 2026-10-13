"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plus, Trash2, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { Pagination } from "@/components/ui/Pagination";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { RoleBadge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { CreateStaffModal } from "./CreateStaffModal";
import { PromoteModal } from "./PromoteModal";
import { formatDate } from "@/lib/utils";
import toast from "react-hot-toast";

const ROLE_FILTER = [
  { value: "", label: "All Roles" },
  { value: "PATIENT", label: "Patients" },
  { value: "RECEPTIONIST", label: "Receptionists" },
  { value: "DOCTOR", label: "Doctors" },
  { value: "NURSE", label: "Nurses" },
  { value: "LAB_TECHNICIAN", label: "Lab Technicians" },
  { value: "PHARMACIST", label: "Pharmacists" },
  { value: "ACCOUNTANT", label: "Accountants" },
  { value: "ADMIN", label: "Admins" },
];

export function UsersClient() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);
  const [createModal, setCreateModal] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["users", search, roleFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({ search, page: String(page), limit: "15" });
      if (roleFilter) params.set("role", roleFilter);
      const res = await fetch(`/api/users?${params}`);
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => { toast.success("User deleted"); qc.invalidateQueries({ queryKey: ["users"] }); setDeleteId(null); },
    onError: () => toast.error("Failed to delete"),
  });

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-800">
        <span className="text-lg">🔐</span>
        <span>
          <strong>Patients</strong> register themselves via the public signup page.
          <strong className="ml-1">All staff accounts</strong> (doctors, nurses, receptionists, etc.) must be created here by an admin.
        </span>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-3 w-full sm:w-auto">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search users..." className="w-full sm:w-64" />
          <Select options={ROLE_FILTER} value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }} className="w-44" />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{data?.total ?? 0} users</span>
          <Button icon={<Plus className="w-4 h-4" />} onClick={() => setCreateModal(true)}>
            Create Staff Account
          </Button>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-xl shadow-card border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-6"><TableSkeleton rows={8} cols={6} /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="table-header">User</th>
                  <th className="table-header">Role</th>
                  <th className="table-header">Profile</th>
                  <th className="table-header">Phone</th>
                  <th className="table-header">Joined</th>
                  <th className="table-header">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data?.users?.length === 0 && (
                  <tr>
                    <td colSpan={6} className="table-cell text-center text-gray-400 py-12">No users found</td>
                  </tr>
                )}
                {data?.users?.map((user: any) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="table-cell">
                      <div>
                        <p className="font-medium text-gray-900">{user.name}</p>
                        <p className="text-xs text-gray-400">{user.email}</p>
                      </div>
                    </td>
                    <td className="table-cell">
                      <RoleBadge role={user.role} />
                    </td>
                    <td className="table-cell text-sm text-gray-500">
                      {user.doctorProfile
                        ? <span className="text-blue-600 font-medium">{user.doctorProfile.specialization}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="table-cell text-gray-500">{user.phone || "—"}</td>
                    <td className="table-cell text-gray-500">{formatDate(user.createdAt)}</td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1">
                        {/* Change role */}
                        <button
                          onClick={() => setEditUser(user)}
                          title="Change role"
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {/* Delete */}
                        <button
                          onClick={() => setDeleteId(user.id)}
                          title="Delete user"
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
            <Pagination page={page} total={data.total} limit={15} onPageChange={setPage} />
          </div>
        )}
      </motion.div>

      <CreateStaffModal open={createModal} onClose={() => setCreateModal(false)} />

      {editUser && (
        <PromoteModal open={!!editUser} onClose={() => setEditUser(null)} user={editUser} />
      )}

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        loading={deleteMutation.isPending}
        message="Delete this user account permanently? This cannot be undone."
      />
    </div>
  );
}
