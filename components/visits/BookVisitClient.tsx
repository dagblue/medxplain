"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { createVisitSchema, CreateVisitInput } from "@/lib/validations";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { formatDateTime } from "@/lib/utils";
import {
  Calendar, Clock, CheckCircle, Activity,
  AlertTriangle, ArrowRight, Stethoscope,
} from "lucide-react";
import toast from "react-hot-toast";

async function fetchOwnPatient() {
  const res = await fetch("/api/patients");
  const d = await res.json();
  return d.patients?.[0] ?? null;
}

async function fetchDepartments() {
  const res = await fetch("/api/departments");
  return res.json();
}

async function fetchMyVisits() {
  const res = await fetch("/api/visits?limit=5");
  return res.json();
}

export function BookVisitClient() {
  const router = useRouter();
  const [submitted, setSubmitted] = useState(false);
  const [newVisitId, setNewVisitId] = useState<string | null>(null);

  const { data: patient, isLoading: patientLoading } = useQuery({ queryKey: ["own-patient"], queryFn: fetchOwnPatient });
  const { data: deptData } = useQuery({ queryKey: ["departments"], queryFn: fetchDepartments });
  const { data: visitsData } = useQuery({ queryKey: ["my-visits"], queryFn: fetchMyVisits });

  const { register, handleSubmit, formState: { errors } } = useForm<CreateVisitInput>({
    resolver: zodResolver(createVisitSchema),
    defaultValues: { visitType: "ONLINE" },
  });

  const mutation = useMutation({
    mutationFn: async (data: CreateVisitInput) => {
      const res = await fetch("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, patientId: patient.id, visitType: "ONLINE" }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Failed"); }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success("Visit requested! You're in the queue.");
      setNewVisitId(data.visit.id);
      setSubmitted(true);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deptOptions = deptData?.departments?.map((d: any) => ({ value: d.id, label: d.name })) ?? [];

  if (patientLoading) {
    return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!patient) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-8 h-8 text-amber-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">No patient profile found</h2>
        <p className="text-gray-500 mb-6">You need a patient profile to book a visit. Please visit reception to register.</p>
        <Button onClick={() => router.push("/dashboard")}>Back to Dashboard</Button>
      </div>
    );
  }

  if (submitted) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-lg mx-auto text-center py-12">
        <div className="w-20 h-20 bg-green-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-green-500" />
        </div>
        <h2 className="text-2xl font-black text-gray-900 mb-2">You're in the queue!</h2>
        <p className="text-gray-500 mb-8">A nurse will be assigned to you shortly. Please wait at the hospital or check back here for updates.</p>
        <div className="flex gap-3 justify-center">
          <Button variant="secondary" onClick={() => { setSubmitted(false); setNewVisitId(null); }}>Book Another</Button>
          <Button onClick={() => router.push("/dashboard")}>Back to Dashboard</Button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Patient card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl border border-gray-100 shadow-card p-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-700 font-black text-xl flex-shrink-0">
            {patient.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h2 className="font-bold text-gray-900 text-lg">{patient.name}</h2>
            <p className="text-sm text-gray-500">{patient.gender} · {patient.phone}</p>
            {patient.allergies && (
              <p className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5">
                <AlertTriangle className="w-3 h-3" /> {patient.allergies}
              </p>
            )}
          </div>
          <div className="ml-auto">
            <StatusBadge status={patient.status} />
          </div>
        </div>
      </motion.div>

      {/* Booking form */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-white rounded-2xl border border-gray-100 shadow-card p-6">
        <div className="flex items-center gap-2 mb-5">
          <Calendar className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-gray-900">Book a Visit</h3>
        </div>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div>
            <label className="label">Chief Complaint</label>
            <textarea
              className="input resize-none"
              rows={3}
              placeholder="Describe your symptoms or reason for visit..."
              {...register("chiefComplaint")}
            />
          </div>
          <Select label="Department (optional)" options={deptOptions} placeholder="Select department" {...register("departmentId")} />
          <Input label="Preferred Date & Time (optional)" type="datetime-local" {...register("scheduledAt")} />

          <div className="p-3 bg-blue-50 rounded-xl flex items-start gap-2">
            <Clock className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">
              Your visit will be added to the hospital queue. A nurse will be assigned for triage, followed by a doctor if needed.
            </p>
          </div>

          <Button type="submit" className="w-full justify-center" size="lg" loading={mutation.isPending} icon={<ArrowRight className="w-4 h-4" />}>
            Request Visit
          </Button>
        </form>
      </motion.div>

      {/* Recent visits */}
      {visitsData?.visits?.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <Activity className="w-4 h-4 text-gray-400" />
            <h3 className="font-semibold text-gray-900 text-sm">Recent Visits</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {visitsData.visits.map((v: any) => (
              <div key={v.id} className="px-6 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{v.chiefComplaint || "General visit"}</p>
                  <p className="text-xs text-gray-400">{formatDateTime(v.createdAt)}</p>
                </div>
                <StatusBadge status={v.status} />
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
