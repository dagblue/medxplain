"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plus, CheckCircle, Pill } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Pagination } from "@/components/ui/Pagination";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { prescriptionSchema, PrescriptionInput } from "@/lib/validations";
import { formatDate } from "@/lib/utils";
import { useSession } from "@/lib/auth-client";
import toast from "react-hot-toast";

const STATUS_OPTIONS = [{ value: "", label: "All" }, { value: "PENDING", label: "Pending" }, { value: "DISPENSED", label: "Dispensed" }];

export function PrescriptionsClient() {
  const { data: session } = useSession();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [createModal, setCreateModal] = useState(false);
  const [dispenseId, setDispenseId] = useState<string | null>(null);
  const qc = useQueryClient();

  const role = session?.user?.role as string;
  const isDoctor = ["ADMIN", "DOCTOR", "NURSE"].includes(role);
  const isPharmacist = ["ADMIN", "PHARMACIST"].includes(role);

  const { data, isLoading } = useQuery({
    queryKey: ["prescriptions", status, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "15" });
      if (status) params.set("status", status);
      const res = await fetch(`/api/prescriptions?${params}`);
      return res.json();
    },
  });

  const { data: patientData } = useQuery({ queryKey: ["patients-list"], queryFn: async () => { const res = await fetch("/api/patients?limit=100"); return res.json(); }, enabled: isDoctor });

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<PrescriptionInput>({
    resolver: zodResolver(prescriptionSchema),
    defaultValues: { patientId: "", notes: "", medicines: [{ name: "", dosage: "", frequency: "", duration: "", instructions: "" }] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "medicines" });

  const createMutation = useMutation({
    mutationFn: async (data: PrescriptionInput) => {
      const res = await fetch("/api/prescriptions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => { toast.success("Prescription created"); qc.invalidateQueries({ queryKey: ["prescriptions"] }); setCreateModal(false); reset(); },
    onError: () => toast.error("Failed"),
  });

  const dispenseMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/prescriptions/${id}/dispense`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => { toast.success("Prescription dispensed ✓"); qc.invalidateQueries({ queryKey: ["prescriptions"] }); setDispenseId(null); },
    onError: () => toast.error("Failed"),
  });

  const patientOptions = patientData?.patients?.map((p: any) => ({ value: p.id, label: p.name })) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Select options={STATUS_OPTIONS} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-40" />
        {isDoctor && <Button icon={<Plus className="w-4 h-4" />} onClick={() => setCreateModal(true)}>Write Prescription</Button>}
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-xl shadow-card border border-gray-100 overflow-hidden">
        {isLoading ? <div className="p-6"><TableSkeleton rows={8} cols={5} /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="table-header">Patient</th>
                  <th className="table-header">Doctor</th>
                  <th className="table-header">Medicines</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Dispensed By</th>
                  <th className="table-header">Date</th>
                  <th className="table-header">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data?.prescriptions?.length === 0 && (
                  <tr><td colSpan={7} className="table-cell text-center text-gray-400 py-12">
                    <div className="flex flex-col items-center gap-2"><Pill className="w-8 h-8 text-gray-200" />No prescriptions</div>
                  </td></tr>
                )}
                {data?.prescriptions?.map((rx: any) => (
                  <tr key={rx.id} className="hover:bg-gray-50 transition-colors">
                    <td className="table-cell font-medium">{rx.patient?.name}</td>
                    <td className="table-cell text-gray-600">Dr. {rx.doctor?.user?.name}</td>
                    <td className="table-cell">
                      <div className="space-y-0.5">
                        {rx.medicines?.slice(0, 2).map((m: any) => (
                          <p key={m.id} className="text-xs text-gray-600">{m.name} — {m.dosage} × {m.frequency}</p>
                        ))}
                        {rx.medicines?.length > 2 && <p className="text-xs text-gray-400">+{rx.medicines.length - 2} more</p>}
                      </div>
                    </td>
                    <td className="table-cell"><StatusBadge status={rx.status} /></td>
                    <td className="table-cell text-gray-500">{rx.dispensation?.pharmacist?.user?.name || "—"}</td>
                    <td className="table-cell text-gray-500">{formatDate(rx.createdAt)}</td>
                    <td className="table-cell">
                      {isPharmacist && rx.status === "PENDING" && (
                        <button onClick={() => setDispenseId(rx.id)} className="flex items-center gap-1 text-xs text-green-600 hover:underline font-medium">
                          <CheckCircle className="w-3.5 h-3.5" />Dispense
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <div className="px-6 py-4 border-t border-gray-100"><Pagination page={page} total={data.total} limit={15} onPageChange={setPage} /></div>}
      </motion.div>

      {/* Create Prescription Modal */}
      <Modal open={createModal} onClose={() => { setCreateModal(false); reset(); }} title="Write Prescription" size="xl">
        <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <Select label="Patient" options={patientOptions} placeholder="Select patient" error={errors.patientId?.message} {...register("patientId")} />
          <div><label className="label">Notes</label><textarea className="input resize-none" rows={2} placeholder="Clinical notes..." {...register("notes")} /></div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Medicines</label>
              <button type="button" onClick={() => append({ name: "", dosage: "", frequency: "", duration: "", instructions: "" })} className="text-xs text-blue-600 hover:underline font-medium">+ Add Medicine</button>
            </div>
            <div className="space-y-3">
              {fields.map((field, i) => (
                <div key={field.id} className="p-3 bg-gray-50 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-600">Medicine {i + 1}</span>
                    {fields.length > 1 && <button type="button" onClick={() => remove(i)} className="text-xs text-red-500 hover:underline">Remove</button>}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Medicine name" {...register(`medicines.${i}.name`)} />
                    <Input placeholder="Dosage (e.g. 500mg)" {...register(`medicines.${i}.dosage`)} />
                    <Input placeholder="Frequency (e.g. 3x daily)" {...register(`medicines.${i}.frequency`)} />
                    <Input placeholder="Duration (e.g. 7 days)" {...register(`medicines.${i}.duration`)} />
                    <div className="col-span-2"><Input placeholder="Instructions (optional)" {...register(`medicines.${i}.instructions`)} /></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" type="button" onClick={() => { setCreateModal(false); reset(); }}>Cancel</Button>
            <Button className="flex-1" type="submit" loading={createMutation.isPending}>Create Prescription</Button>
          </div>
        </form>
      </Modal>

      {/* Dispense confirm */}
      <Modal open={!!dispenseId} onClose={() => setDispenseId(null)} title="Confirm Dispensation" size="sm">
        <div className="text-center space-y-4">
          <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mx-auto"><CheckCircle className="w-7 h-7 text-green-600" /></div>
          <p className="text-gray-600 text-sm">Confirm that all medicines have been dispensed to the patient?</p>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setDispenseId(null)}>Cancel</Button>
            <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => dispenseId && dispenseMutation.mutate(dispenseId)} loading={dispenseMutation.isPending}>Confirm Dispensed</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
