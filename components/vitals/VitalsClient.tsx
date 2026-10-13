"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plus, Heart } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { vitalsSchema, VitalsInput } from "@/lib/validations";
import { formatDateTime } from "@/lib/utils";
import toast from "react-hot-toast";

export function VitalsClient() {
  const [modal, setModal] = useState(false);
  const qc = useQueryClient();

  const { data: patientData } = useQuery({ queryKey: ["patients-list"], queryFn: async () => { const res = await fetch("/api/patients?limit=100"); return res.json(); } });
  const { data, isLoading } = useQuery({ queryKey: ["vitals"], queryFn: async () => { const res = await fetch("/api/vitals"); return res.json(); } });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<VitalsInput>({ resolver: zodResolver(vitalsSchema) });

  const mutation = useMutation({
    mutationFn: async (data: VitalsInput) => {
      const res = await fetch("/api/vitals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => { toast.success("Vitals recorded"); qc.invalidateQueries({ queryKey: ["vitals"] }); setModal(false); reset(); },
    onError: () => toast.error("Failed"),
  });

  const patientOptions = patientData?.patients?.map((p: any) => ({ value: p.id, label: `${p.name} (${p.status})` })) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => setModal(true)}>Record Vitals</Button>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-xl shadow-card border border-gray-100 overflow-hidden">
        {isLoading ? <div className="p-6"><TableSkeleton rows={8} cols={7} /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="table-header">Patient</th>
                  <th className="table-header">Blood Pressure</th>
                  <th className="table-header">Heart Rate</th>
                  <th className="table-header">Temperature</th>
                  <th className="table-header">O₂ Sat</th>
                  <th className="table-header">Weight</th>
                  <th className="table-header">Recorded By</th>
                  <th className="table-header">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data?.vitals?.length === 0 && (
                  <tr><td colSpan={8} className="table-cell text-center text-gray-400 py-12">
                    <div className="flex flex-col items-center gap-2"><Heart className="w-8 h-8 text-gray-200" />No vitals recorded</div>
                  </td></tr>
                )}
                {data?.vitals?.map((v: any) => (
                  <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                    <td className="table-cell font-medium">{v.patient?.name}</td>
                    <td className="table-cell">{v.bloodPressure || "—"}</td>
                    <td className="table-cell">{v.heartRate ? `${v.heartRate} bpm` : "—"}</td>
                    <td className="table-cell">{v.temperature ? `${v.temperature}°C` : "—"}</td>
                    <td className="table-cell">{v.oxygenSat ? `${v.oxygenSat}%` : "—"}</td>
                    <td className="table-cell">{v.weight ? `${v.weight} kg` : "—"}</td>
                    <td className="table-cell text-gray-500">{v.nurse?.user?.name}</td>
                    <td className="table-cell text-gray-500">{formatDateTime(v.recordedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      <Modal open={modal} onClose={() => { setModal(false); reset(); }} title="Record Patient Vitals" size="lg">
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <Select label="Patient" options={patientOptions} placeholder="Select patient" error={errors.patientId?.message} {...register("patientId")} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Blood Pressure" placeholder="e.g. 120/80 mmHg" {...register("bloodPressure")} />
            <Input label="Heart Rate" placeholder="e.g. 72 bpm" {...register("heartRate")} />
            <Input label="Temperature (°C)" placeholder="e.g. 36.6" {...register("temperature")} />
            <Input label="O₂ Saturation (%)" placeholder="e.g. 98" {...register("oxygenSat")} />
            <Input label="Weight (kg)" placeholder="e.g. 70" {...register("weight")} />
            <Input label="Height (cm)" placeholder="e.g. 175" {...register("height")} />
          </div>
          <div><label className="label">Notes</label><textarea className="input resize-none" rows={2} {...register("notes")} /></div>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" type="button" onClick={() => { setModal(false); reset(); }}>Cancel</Button>
            <Button className="flex-1" type="submit" loading={mutation.isPending}>Record Vitals</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
