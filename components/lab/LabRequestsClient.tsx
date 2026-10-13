"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plus, Upload, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Pagination } from "@/components/ui/Pagination";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { labRequestSchema, labResultSchema, LabRequestInput, LabResultInput } from "@/lib/validations";
import { formatDateTime } from "@/lib/utils";
import { useSession } from "@/lib/auth-client";
import toast from "react-hot-toast";

const STATUS_OPTIONS = [{ value: "", label: "All" }, { value: "PENDING", label: "Pending" }, { value: "IN_PROGRESS", label: "In Progress" }, { value: "COMPLETED", label: "Completed" }];

export function LabRequestsClient() {
  const { data: session } = useSession();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [requestModal, setRequestModal] = useState(false);
  const [resultModal, setResultModal] = useState<string | null>(null);
  const qc = useQueryClient();

  const role = session?.user?.role as string;
  const isDoctor = ["ADMIN", "DOCTOR"].includes(role);
  const isLabTech = ["ADMIN", "LAB_TECHNICIAN"].includes(role);

  const { data, isLoading } = useQuery({
    queryKey: ["lab-requests", status, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "15" });
      if (status) params.set("status", status);
      const res = await fetch(`/api/lab-requests?${params}`);
      return res.json();
    },
  });

  const { data: patientData } = useQuery({ queryKey: ["patients-list"], queryFn: async () => { const res = await fetch("/api/patients?limit=100"); return res.json(); }, enabled: isDoctor });

  const requestForm = useForm<LabRequestInput>({ resolver: zodResolver(labRequestSchema) });
  const resultForm = useForm<LabResultInput>({ resolver: zodResolver(labResultSchema) });

  const requestMutation = useMutation({
    mutationFn: async (data: LabRequestInput) => {
      const res = await fetch("/api/lab-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => { toast.success("Lab request created"); qc.invalidateQueries({ queryKey: ["lab-requests"] }); setRequestModal(false); requestForm.reset(); },
    onError: () => toast.error("Failed"),
  });

  const resultMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: LabResultInput }) => {
      const res = await fetch(`/api/lab-requests/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => { toast.success("Result uploaded"); qc.invalidateQueries({ queryKey: ["lab-requests"] }); setResultModal(null); resultForm.reset(); },
    onError: () => toast.error("Failed"),
  });

  const patientOptions = patientData?.patients?.map((p: any) => ({ value: p.id, label: p.name })) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Select options={STATUS_OPTIONS} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-40" />
        {isDoctor && <Button icon={<Plus className="w-4 h-4" />} onClick={() => setRequestModal(true)}>Request Lab Test</Button>}
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-xl shadow-card border border-gray-100 overflow-hidden">
        {isLoading ? <div className="p-6"><TableSkeleton rows={8} cols={5} /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="table-header">Test</th>
                  <th className="table-header">Patient</th>
                  <th className="table-header">Requested By</th>
                  <th className="table-header">Urgency</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Result</th>
                  <th className="table-header">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data?.requests?.length === 0 && (
                  <tr><td colSpan={7} className="table-cell text-center text-gray-400 py-12">
                    <div className="flex flex-col items-center gap-2"><FlaskConical className="w-8 h-8 text-gray-200" />No lab requests</div>
                  </td></tr>
                )}
                {data?.requests?.map((r: any) => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="table-cell"><p className="font-medium">{r.testName}</p><p className="text-xs text-gray-400">{r.testType}</p></td>
                    <td className="table-cell">{r.patient?.name}</td>
                    <td className="table-cell text-gray-500">Dr. {r.doctor?.user?.name}</td>
                    <td className="table-cell">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.urgency === "STAT" ? "bg-red-100 text-red-700" : r.urgency === "URGENT" ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-600"}`}>{r.urgency}</span>
                    </td>
                    <td className="table-cell"><StatusBadge status={r.status} /></td>
                    <td className="table-cell text-gray-500 max-w-xs truncate">{r.labResult?.result || "—"}</td>
                    <td className="table-cell">
                      {isLabTech && r.status !== "COMPLETED" && (
                        <button onClick={() => setResultModal(r.id)} className="flex items-center gap-1 text-xs text-blue-600 hover:underline font-medium">
                          <Upload className="w-3.5 h-3.5" />Upload Result
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

      {/* Request Modal */}
      <Modal open={requestModal} onClose={() => setRequestModal(false)} title="Request Lab Test" size="md">
        <form onSubmit={requestForm.handleSubmit((d) => requestMutation.mutate(d))} className="space-y-4">
          <Select label="Patient" options={patientOptions} placeholder="Select patient" error={requestForm.formState.errors.patientId?.message} {...requestForm.register("patientId")} />
          <Input label="Test Name" placeholder="e.g. Complete Blood Count" error={requestForm.formState.errors.testName?.message} {...requestForm.register("testName")} />
          <Input label="Test Type" placeholder="e.g. Hematology, Biochemistry" error={requestForm.formState.errors.testType?.message} {...requestForm.register("testType")} />
          <Select label="Urgency" options={[{ value: "ROUTINE", label: "Routine" }, { value: "URGENT", label: "Urgent" }, { value: "STAT", label: "STAT (Immediate)" }]} {...requestForm.register("urgency")} />
          <div><label className="label">Notes</label><textarea className="input resize-none" rows={2} {...requestForm.register("notes")} /></div>
          <div className="flex gap-3"><Button variant="secondary" className="flex-1" type="button" onClick={() => setRequestModal(false)}>Cancel</Button><Button className="flex-1" type="submit" loading={requestMutation.isPending}>Request</Button></div>
        </form>
      </Modal>

      {/* Result Modal */}
      <Modal open={!!resultModal} onClose={() => setResultModal(null)} title="Upload Lab Result" size="md">
        <form onSubmit={resultForm.handleSubmit((d) => resultMutation.mutate({ id: resultModal!, data: d }))} className="space-y-4">
          <div><label className="label">Result</label><textarea className="input resize-none" rows={4} placeholder="Test results and findings..." {...resultForm.register("result")} />{resultForm.formState.errors.result && <p className="text-xs text-red-500 mt-1">{resultForm.formState.errors.result.message}</p>}</div>
          <Input label="Normal Range" placeholder="e.g. 4.5–11.0 × 10⁹/L" {...resultForm.register("normalRange")} />
          <div><label className="label">Interpretation</label><textarea className="input resize-none" rows={2} placeholder="Clinical interpretation..." {...resultForm.register("interpretation")} /></div>
          <Input label="File URL (optional)" placeholder="https://..." {...resultForm.register("fileUrl")} />
          <div className="flex gap-3"><Button variant="secondary" className="flex-1" type="button" onClick={() => setResultModal(null)}>Cancel</Button><Button className="flex-1" type="submit" loading={resultMutation.isPending}>Upload Result</Button></div>
        </form>
      </Modal>
    </div>
  );
}
