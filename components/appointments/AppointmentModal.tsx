"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { appointmentSchema, AppointmentInput } from "@/lib/validations";
import { format } from "date-fns";
import toast from "react-hot-toast";

export function AppointmentModal({ open, onClose, appointment }: { open: boolean; onClose: () => void; appointment?: any }) {
  const qc = useQueryClient();
  const isEdit = !!appointment;

  const { data: patientData } = useQuery({ queryKey: ["patients-list"], queryFn: async () => { const res = await fetch("/api/patients?limit=100"); return res.json(); } });
  const { data: doctorData } = useQuery({ queryKey: ["doctors-list"], queryFn: async () => { const res = await fetch("/api/doctors?limit=100"); return res.json(); } });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<AppointmentInput>({ resolver: zodResolver(appointmentSchema) });

  useEffect(() => {
    if (appointment) reset({ patientId: appointment.patientId, doctorId: appointment.doctorId, scheduledAt: format(new Date(appointment.scheduledAt), "yyyy-MM-dd'T'HH:mm"), type: appointment.type, chiefComplaint: appointment.chiefComplaint || "", notes: appointment.notes || "" });
    else reset({ patientId: "", doctorId: "", scheduledAt: "", type: "General", chiefComplaint: "", notes: "" });
  }, [appointment, open, reset]);

  const mutation = useMutation({
    mutationFn: async (data: AppointmentInput) => {
      const url = isEdit ? `/api/appointments/${appointment.id}` : "/api/appointments";
      const res = await fetch(url, { method: isEdit ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => { toast.success(isEdit ? "Updated" : "Appointment booked"); qc.invalidateQueries({ queryKey: ["appointments"] }); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  const patientOptions = patientData?.patients?.map((p: any) => ({ value: p.id, label: `${p.name} (${p.phone})` })) ?? [];
  const doctorOptions = doctorData?.doctors?.map((d: any) => ({ value: d.id, label: `Dr. ${d.user?.name} — ${d.specialization}` })) ?? [];

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit Appointment" : "Book Appointment"} size="lg">
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        <Select label="Patient" options={patientOptions} placeholder="Select patient" error={errors.patientId?.message} {...register("patientId")} />
        <Select label="Doctor" options={doctorOptions} placeholder="Select doctor" error={errors.doctorId?.message} {...register("doctorId")} />
        <Input label="Date & Time" type="datetime-local" error={errors.scheduledAt?.message} {...register("scheduledAt")} />
        <Select label="Visit Type" options={["General","Follow-up","Emergency","Specialist","Routine Check-up"].map(t => ({ value: t, label: t }))} {...register("type")} />
        <Input label="Chief Complaint" placeholder="Main reason for visit" {...register("chiefComplaint")} />
        <div>
          <label className="label">Notes</label>
          <textarea className="input resize-none" rows={2} {...register("notes")} />
        </div>
        <div className="flex gap-3 pt-2">
          <Button variant="secondary" className="flex-1" type="button" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" type="submit" loading={mutation.isPending}>{isEdit ? "Update" : "Book"}</Button>
        </div>
      </form>
    </Modal>
  );
}
