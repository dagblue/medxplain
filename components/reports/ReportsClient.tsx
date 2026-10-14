"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plus, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/SearchInput";
import { Pagination } from "@/components/ui/Pagination";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { reportSchema, ReportInput } from "@/lib/validations";
import { formatDate } from "@/lib/utils";
import toast from "react-hot-toast";

async function fetchReports(search: string, page: number) {
  const res = await fetch(`/api/reports?search=${encodeURIComponent(search)}&page=${page}&limit=10`);
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

async function fetchPatients() {
  const res = await fetch("/api/patients?limit=100");
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

async function fetchDoctors() {
  const res = await fetch("/api/doctors?limit=100");
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

export function ReportsClient() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);

  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["reports", search, page],
    queryFn: () => fetchReports(search, page),
  });

  const { data: patientData } = useQuery({ queryKey: ["patients-list"], queryFn: fetchPatients });
  const { data: doctorData } = useQuery({ queryKey: ["doctors-list"], queryFn: fetchDoctors });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ReportInput>({ resolver: zodResolver(reportSchema) });

  const mutation = useMutation({
    mutationFn: async (data: ReportInput) => {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Lab report uploaded");
      qc.invalidateQueries({ queryKey: ["reports"] });
      setModalOpen(false);
      reset();
    },
    onError: () => toast.error("Failed to upload report"),
  });

  const patientOptions = patientData?.patients?.map((p: any) => ({ value: p.id, label: p.name })) || [];
  const doctorOptions = doctorData?.doctors?.map((d: any) => ({ value: d.id, label: `Dr. ${d.user?.name}` })) || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <SearchInput
          value={search}
          onChange={(v) => { setSearch(v); setPage(1); }}
          placeholder="Search reports..."
          className="w-full sm:w-72"
        />
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => setModalOpen(true)}>
          Upload Report
        </Button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl shadow-card border border-gray-100 overflow-hidden"
      >
        {isLoading ? (
          <div className="p-6"><TableSkeleton rows={6} cols={4} /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="table-header">Title</th>
                  <th className="table-header">Patient</th>
                  <th className="table-header">Doctor</th>
                  <th className="table-header">Result</th>
                  <th className="table-header">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data?.reports?.length === 0 && (
                  <tr>
                    <td colSpan={5} className="table-cell text-center text-gray-400 py-12">
                      <div className="flex flex-col items-center gap-2">
                        <FlaskConical className="w-8 h-8 text-gray-300" />
                        No lab reports found
                      </div>
                    </td>
                  </tr>
                )}
                {data?.reports?.map((report: any) => (
                  <tr key={report.id} className="hover:bg-gray-50 transition-colors">
                    <td className="table-cell font-medium">{report.title}</td>
                    <td className="table-cell">{report.patient?.name}</td>
                    <td className="table-cell text-gray-500">
                      {report.doctor ? `Dr. ${report.doctor?.user?.name}` : "—"}
                    </td>
                    <td className="table-cell text-gray-600 max-w-xs truncate">{report.result}</td>
                    <td className="table-cell text-gray-500">{formatDate(report.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && (
          <div className="px-6 py-4 border-t border-gray-100">
            <Pagination page={page} total={data.total} limit={10} onPageChange={setPage} />
          </div>
        )}
      </motion.div>

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); reset(); }} title="Upload Lab Report" size="lg">
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <Select
            label="Patient"
            options={patientOptions}
            placeholder="Select patient"
            error={errors.patientId?.message}
            {...register("patientId")}
          />
          <Select
            label="Doctor (optional)"
            options={doctorOptions}
            placeholder="Assign to doctor (optional)"
            {...register("doctorId")}
          />
          <Input label="Report Title" placeholder="e.g. Blood Count Test" error={errors.title?.message} {...register("title")} />
          <div>
            <label className="label">Result</label>
            <textarea
              className="input resize-none"
              rows={4}
              placeholder="Test results and findings..."
              {...register("result")}
            />
            {errors.result && <p className="mt-1 text-xs text-red-500">{errors.result.message}</p>}
          </div>
          <Input label="File URL (optional)" placeholder="https://..." {...register("fileUrl")} />

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" type="button" onClick={() => { setModalOpen(false); reset(); }}>
              Cancel
            </Button>
            <Button className="flex-1" type="submit" loading={mutation.isPending}>Upload</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
