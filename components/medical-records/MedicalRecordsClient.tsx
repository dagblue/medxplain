"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plus, FileText } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { medicalRecordSchema, MedicalRecordInput } from "@/lib/validations";
import { formatDate } from "@/lib/utils";
import { useSession } from "@/lib/auth-client";
import toast from "react-hot-toast";

export function MedicalRecordsClient() {
  const { data: session } = useSession();
  const [modal, setModal] = useState(false);
  const qc = useQueryClient();

  const isDoctor = ["ADMIN", "DOCTOR"].includes(session?.user?.role as string);

  const { data: patientData } = useQuery({ queryKey: ["patients-list"], queryFn: async () => { const res = await fetch("/api/patients?limit=100"); return res.json(); }, enabled: isDoctor });
  const { data: apptData } = useQuery({ queryKey: ["appointments-list"], queryFn: async () => { const res = await fetch("/api/appointments?status=IN_PROGRESS&limit=50"); return res.json(); }, enabled: isDoctor });
  const { data, isLoading } = useQuery({ queryKey: ["medical-records"], queryFn: async () => { const res = await fetch("/api/medical-records"); return res.json(); } });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<MedicalRecordInput>({ resolver: zodResolver(medicalRecordSchema) });

  const mutation = useMutation({
    mutationFn: async (data: MedicalRecordInput) => {
      const res = await fetch("/api/medical-records", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => { toast.success("Medical record saved"); qc.invalidateQueries({ queryKey: ["medical-records"] }); qc.invalidateQueries({ queryKey: ["appointments"] }); setModal(false); reset(); },
    onError: () => toast.error("Failed"),
  });

  const patientOptions = patientData?.patients?.map((p: any) => ({ value: p.id, label: p.name })) ?? [];
  const apptOptions = [{ value: "", label: "No appointment" }, ...(apptData?.appointments?.map((a: any) => ({ value: a.id, label: `${a.patient?.name} — ${new Date(a.scheduledAt).toLocaleDateString()}` })) ?? [])];

  return (
    <div className="space-y-4">
      {isDoctor && (
        <div className="flex justify-end">
          <Button icon={<Plus className="w-4 h-4" />} onClick={() => setModal(true)}>Add Diagnosis</Button>
        </div>
      )}

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-xl shadow-card border border-gray-100 overflow-hidden">
        {isLoading ? <div className="p-6"><TableSkeleton rows={8} cols={5} /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="table-header">Patient</th>
                  <th className="table-header">Doctor</th>
                  <th className="table-header">Diagnosis</th>
                  <th className="table-header">Treatment</th>
                  <th className="table-header">Admitted</th>
                  <th className="table-header">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data?.records?.length === 0 && (
                  <tr><td colSpan={6} className="table-cell text-center text-gray-400 py-12">
                    <div className="flex flex-col items-center gap-2"><FileText className="w-8 h-8 text-gray-200" />No medical records</div>
                  </td></tr>
                )}
                {data?.records?.map((r: any) => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="table-cell font-medium">{r.patient?.name}</td>
                    <td className="table-cell text-gray-600">Dr. {r.doctor?.user?.name}</td>
                    <td className="table-cell"><p className="font-medium text-gray-900">{r.diagnosis}</p>{r.symptoms && <p className="text-xs text-gray-500 mt-0.5">{r.symptoms}</p>}</td>
                    <td className="table-cell text-gray-500 max-w-xs truncate">{r.treatment || "—"}</td>
                    <td className="table-cell">{r.admitPatient ? <span className="text-xs font-semibold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">Yes</span> : <span className="text-gray-400 text-xs">No</span>}</td>
                    <td className="table-cell text-gray-500">{formatDate(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      <Modal open={modal} onClose={() => { setModal(false); reset(); }} title="Add Diagnosis / Medical Record" size="xl">
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select label="Patient" options={patientOptions} placeholder="Select patient" error={errors.patientId?.message} {...register("patientId")} />
            <Select label="Appointment (optional)" options={apptOptions} {...register("appointmentId")} />
          </div>
          <Input label="Diagnosis" placeholder="Primary diagnosis" error={errors.diagnosis?.message} {...register("diagnosis")} />
          <div><label className="label">Symptoms</label><textarea className="input resize-none" rows={2} placeholder="Patient-reported symptoms..." {...register("symptoms")} /></div>
          <div><label className="label">Treatment Plan</label><textarea className="input resize-none" rows={2} placeholder="Prescribed treatment..." {...register("treatment")} /></div>
          <div><label className="label">Notes</label><textarea className="input resize-none" rows={2} placeholder="Additional notes..." {...register("notes")} /></div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 rounded text-blue-600" {...register("admitPatient")} />
            <span className="text-sm font-medium text-gray-700">Admit patient to hospital</span>
          </label>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" type="button" onClick={() => { setModal(false); reset(); }}>Cancel</Button>
            <Button className="flex-1" type="submit" loading={mutation.isPending}>Save Record</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
