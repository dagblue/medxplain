"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { doctorSchema, DoctorInput } from "@/lib/validations";
import toast from "react-hot-toast";

interface DoctorModalProps {
  open: boolean;
  onClose: () => void;
  doctor?: any;
}

async function fetchDepartments() {
  const res = await fetch("/api/departments");
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

async function fetchUsers() {
  const res = await fetch("/api/users?limit=100");
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

export function DoctorModal({ open, onClose, doctor }: DoctorModalProps) {
  const qc = useQueryClient();
  const isEdit = !!doctor;

  const { data: deptData } = useQuery({ queryKey: ["departments"], queryFn: fetchDepartments });
  const { data: userData } = useQuery({ queryKey: ["users-list"], queryFn: fetchUsers });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DoctorInput>({
    resolver: zodResolver(doctorSchema),
  });

  useEffect(() => {
    if (doctor) {
      reset({
        userId: doctor.userId,
        specialization: doctor.specialization,
        departmentId: doctor.departmentId,
        availability: doctor.availability || "",
      });
    } else {
      reset({ userId: "", specialization: "", departmentId: "", availability: "" });
    }
  }, [doctor, reset, open]);

  const mutation = useMutation({
    mutationFn: async (data: DoctorInput) => {
      const url = isEdit ? `/api/doctors/${doctor.id}` : "/api/doctors";
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
      toast.success(isEdit ? "Doctor updated" : "Doctor added");
      qc.invalidateQueries({ queryKey: ["doctors"] });
      onClose();
    },
    onError: (err: any) => toast.error(err.message || "Something went wrong"),
  });

  const deptOptions = deptData?.departments?.map((d: any) => ({ value: d.id, label: d.name })) || [];
  const userOptions = userData?.users?.map((u: any) => ({ value: u.id, label: `${u.name} (${u.email})` })) || [];

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit Doctor" : "Add Doctor"} size="lg">
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        {!isEdit && (
          <Select
            label="Select User"
            options={userOptions}
            placeholder="Choose a user account"
            error={errors.userId?.message}
            {...register("userId")}
          />
        )}
        <Input
          label="Specialization"
          placeholder="e.g. Cardiologist"
          error={errors.specialization?.message}
          {...register("specialization")}
        />
        <Select
          label="Department"
          options={deptOptions}
          placeholder="Select department"
          error={errors.departmentId?.message}
          {...register("departmentId")}
        />
        <Input
          label="Availability"
          placeholder="e.g. Mon-Fri 9am-5pm"
          error={errors.availability?.message}
          {...register("availability")}
        />

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" className="flex-1" type="button" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" type="submit" loading={mutation.isPending}>
            {isEdit ? "Update" : "Add Doctor"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
