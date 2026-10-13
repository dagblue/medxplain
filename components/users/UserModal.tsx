"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { userSchema, UserInput } from "@/lib/validations";
import { DEPARTMENTS, ROLE_LABELS, ROLES } from "@/lib/utils";
import toast from "react-hot-toast";

interface UserModalProps {
  open: boolean;
  onClose: () => void;
  user?: any;
}

export function UserModal({ open, onClose, user }: UserModalProps) {
  const qc = useQueryClient();
  const isEdit = !!user;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UserInput>({
    resolver: zodResolver(userSchema),
  });

  useEffect(() => {
    if (user) {
      reset({
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department || "",
        phone: user.phone || "",
      });
    } else {
      reset({ name: "", email: "", password: "", role: "RECEPTIONIST", department: "", phone: "" });
    }
  }, [user, reset, open]);

  const mutation = useMutation({
    mutationFn: async (data: UserInput) => {
      const url = isEdit ? `/api/users/${user.id}` : "/api/users";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || "Failed");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success(isEdit ? "User updated" : "User created");
      qc.invalidateQueries({ queryKey: ["users"] });
      onClose();
    },
    onError: (err: any) => toast.error(err.message || "Something went wrong"),
  });

  const roleOptions = ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }));
  const deptOptions = DEPARTMENTS.map((d) => ({ value: d, label: d }));

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit User" : "Create User"} size="lg">
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Input label="Full Name" placeholder="Jane Smith" error={errors.name?.message} {...register("name")} />
          </div>
          <div className="col-span-2">
            <Input label="Email" type="email" placeholder="jane@hospital.com" error={errors.email?.message} {...register("email")} />
          </div>
          {!isEdit && (
            <div className="col-span-2">
              <Input
                label="Password"
                type="password"
                placeholder="Min 6 characters"
                error={errors.password?.message}
                {...register("password")}
              />
            </div>
          )}
          <Select
            label="Role"
            options={roleOptions}
            error={errors.role?.message}
            {...register("role")}
          />
          <Select
            label="Department"
            options={deptOptions}
            placeholder="Select department"
            {...register("department")}
          />
          <div className="col-span-2">
            <Input label="Phone" placeholder="+1 234 567 8900" {...register("phone")} />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" className="flex-1" type="button" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" type="submit" loading={mutation.isPending}>
            {isEdit ? "Update" : "Create"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
