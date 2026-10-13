"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { ROLE_LABELS } from "@/lib/utils";
import toast from "react-hot-toast";

const schema = z.object({
  name: z.string().min(2, "Name required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Min 6 characters"),
  role: z.enum(["RECEPTIONIST", "DOCTOR", "NURSE", "LAB_TECHNICIAN", "PHARMACIST", "ACCOUNTANT", "ADMIN"]),
  phone: z.string().optional(),
  specialization: z.string().optional(),
  departmentId: z.string().optional(),
  availability: z.string().optional(),
  bio: z.string().optional(),
  ward: z.string().optional(),
});

type FormInput = z.infer<typeof schema>;

const STAFF_ROLES = [
  "RECEPTIONIST", "DOCTOR", "NURSE", "LAB_TECHNICIAN", "PHARMACIST", "ACCOUNTANT", "ADMIN",
] as const;

export function CreateStaffModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);

  const { data: deptData } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => { const res = await fetch("/api/departments"); return res.json(); },
  });

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<FormInput>({
    resolver: zodResolver(schema),
    defaultValues: { role: "RECEPTIONIST" },
  });

  const selectedRole = watch("role");

  const mutation = useMutation({
    mutationFn: async (data: FormInput) => {
      const res = await fetch("/api/admin/create-staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create staff");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(`${data.user.name} created as ${ROLE_LABELS[data.user.role as keyof typeof ROLE_LABELS]}`);
      qc.invalidateQueries({ queryKey: ["users"] });
      reset();
      onClose();
    },
    onError: (err: any) => toast.error(err.message || "Something went wrong"),
  });

  const deptOptions = deptData?.departments?.map((d: any) => ({ value: d.id, label: d.name })) ?? [];
  const roleOptions = STAFF_ROLES.map(r => ({ value: r, label: ROLE_LABELS[r as keyof typeof ROLE_LABELS] }));

  const handleClose = () => { reset(); onClose(); };

  return (
    <Modal open={open} onClose={handleClose} title="Create Staff Account" size="lg">
      {/* Info banner */}
      <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-xl mb-5">
        <ShieldCheck className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-700">
          Staff accounts are created by admins only. The new staff member can log in immediately with the credentials you set.
        </p>
      </div>

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Input label="Full Name" placeholder="Jane Smith" error={errors.name?.message} {...register("name")} />
            </div>
            <div className="col-span-2">
              <Input label="Email Address" type="email" placeholder="jane@hospital.com" error={errors.email?.message} {...register("email")} />
            </div>

            {/* Password */}
            <div className="col-span-2 relative">
              <Input
                label="Password"
                type={showPassword ? "text" : "password"}
                placeholder="Min 6 characters"
                error={errors.password?.message}
                {...register("password")}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-8 text-gray-400 hover:text-gray-600">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <Select
              label="Role"
              options={roleOptions}
              error={errors.role?.message}
              {...register("role")}
            />
            <Input label="Phone (optional)" placeholder="+1 234 567 8900" {...register("phone")} />
          </div>

          {/* Doctor-specific fields */}
          {selectedRole === "DOCTOR" && (
            <div className="space-y-3 p-4 bg-blue-50 rounded-xl border border-blue-100">
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Doctor Profile</p>
              <Input label="Specialization" placeholder="e.g. Cardiologist" error={errors.specialization?.message} {...register("specialization")} />
              <Select label="Department" options={deptOptions} placeholder="Select department" error={errors.departmentId?.message} {...register("departmentId")} />
              <Input label="Availability" placeholder="e.g. Mon–Fri 9am–5pm" {...register("availability")} />
              <div>
                <label className="label">Bio (optional)</label>
                <textarea className="input resize-none" rows={2} placeholder="Short bio..." {...register("bio")} />
              </div>
            </div>
          )}

          {/* Nurse-specific fields */}
          {selectedRole === "NURSE" && (
            <div className="p-4 bg-green-50 rounded-xl border border-green-100">
              <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-3">Nurse Profile</p>
              <Input label="Ward (optional)" placeholder="e.g. ICU, Pediatrics Ward" {...register("ward")} />
            </div>
          )}
        </div>

        {/* Sticky action buttons — always visible regardless of scroll position */}
        <div className="flex gap-3 pt-4 mt-4 border-t border-gray-100 bg-white sticky bottom-0">
          <Button variant="secondary" className="flex-1" type="button" onClick={handleClose}>Cancel</Button>
          <Button className="flex-1" type="submit" loading={mutation.isPending}>Create Staff Account</Button>
        </div>
      </form>
    </Modal>
  );
}
