"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { promoteSchema, PromoteInput } from "@/lib/validations";
import { ROLES, ROLE_LABELS } from "@/lib/utils";
import toast from "react-hot-toast";
import { useWatch } from "react-hook-form";

export function PromoteModal({ open, onClose, user }: { open: boolean; onClose: () => void; user: any }) {
  const qc = useQueryClient();

  const { data: deptData } = useQuery({ queryKey: ["departments"], queryFn: async () => { const res = await fetch("/api/departments"); return res.json(); } });

  const { register, handleSubmit, control, formState: { errors } } = useForm<PromoteInput>({
    resolver: zodResolver(promoteSchema),
    defaultValues: { role: user.role, specialization: "", departmentId: "", availability: "", bio: "", ward: "" },
  });

  const selectedRole = useWatch({ control, name: "role" });

  const mutation = useMutation({
    mutationFn: async (data: PromoteInput) => {
      const res = await fetch(`/api/users/${user.id}/promote`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => { toast.success(`${user.name} is now ${selectedRole}`); qc.invalidateQueries({ queryKey: ["users"] }); onClose(); },
    onError: () => toast.error("Failed"),
  });

  const roleOptions = ROLES.map(r => ({ value: r, label: ROLE_LABELS[r] }));
  const deptOptions = deptData?.departments?.map((d: any) => ({ value: d.id, label: d.name })) ?? [];

  return (
    <Modal open={open} onClose={onClose} title={`Change Role — ${user.name}`} size="md">
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        <Select label="New Role" options={roleOptions} error={errors.role?.message} {...register("role")} />

        {selectedRole === "DOCTOR" && (
          <>
            <Input label="Specialization" placeholder="e.g. Cardiologist" error={errors.specialization?.message} {...register("specialization")} />
            <Select label="Department" options={deptOptions} placeholder="Select department" error={errors.departmentId?.message} {...register("departmentId")} />
            <Input label="Availability" placeholder="e.g. Mon–Fri 9am–5pm" {...register("availability")} />
            <div><label className="label">Bio</label><textarea className="input resize-none" rows={2} {...register("bio")} /></div>
          </>
        )}

        {selectedRole === "NURSE" && (
          <Input label="Ward" placeholder="e.g. ICU, Pediatrics" {...register("ward")} />
        )}

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" className="flex-1" type="button" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" type="submit" loading={mutation.isPending}>Update Role</Button>
        </div>
      </form>
    </Modal>
  );
}
