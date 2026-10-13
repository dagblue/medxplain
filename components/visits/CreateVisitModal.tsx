"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/SearchInput";
import { createVisitSchema, CreateVisitInput } from "@/lib/validations";
import { useSession } from "@/lib/auth-client";
import { Search, UserPlus, UserCheck, Calendar } from "lucide-react";
import toast from "react-hot-toast";

interface CreateVisitModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (visitId: string) => void;
}

export function CreateVisitModal({ open, onClose, onCreated }: CreateVisitModalProps) {
  const { data: session } = useSession();
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [step, setStep] = useState<"search" | "form">("search");

  const isPatient = session?.user?.role === "PATIENT";

  // Fetch patient's own profile if they're a patient
  const { data: ownPatient } = useQuery({
    queryKey: ["own-patient"],
    queryFn: async () => {
      const res = await fetch("/api/patients");
      const d = await res.json();
      return d.patients?.[0] ?? null;
    },
    enabled: isPatient && open,
  });

  // Search patients (for receptionist/admin)
  const { data: searchResults, isLoading: searching } = useQuery({
    queryKey: ["patient-search", patientSearch],
    queryFn: async () => {
      if (!patientSearch.trim()) return { patients: [] };
      const res = await fetch(`/api/patients?search=${encodeURIComponent(patientSearch)}&limit=8`);
      return res.json();
    },
    enabled: !isPatient && patientSearch.length > 1,
  });

  const { data: deptData } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => { const res = await fetch("/api/departments"); return res.json(); },
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateVisitInput>({
    resolver: zodResolver(createVisitSchema),
    defaultValues: { visitType: isPatient ? "ONLINE" : "WALK_IN" },
  });

  const mutation = useMutation({
    mutationFn: async (data: CreateVisitInput) => {
      const res = await fetch("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Failed"); }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success("Visit created — patient added to queue");
      onCreated(data.visit.id);
      handleClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleClose = () => {
    setPatientSearch("");
    setSelectedPatient(null);
    setStep("search");
    reset();
    onClose();
  };

  const handleSelectPatient = (patient: any) => {
    setSelectedPatient(patient);
    setStep("form");
  };

  const deptOptions = deptData?.departments?.map((d: any) => ({ value: d.id, label: d.name })) ?? [];

  // Patient self-booking — skip search
  if (isPatient) {
    return (
      <Modal open={open} onClose={handleClose} title="Request a Visit" size="md">
        <div className="space-y-4">
          {ownPatient ? (
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl">
              <UserCheck className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-gray-900">{ownPatient.name}</p>
                <p className="text-xs text-gray-500">{ownPatient.phone}</p>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-amber-50 rounded-xl text-sm text-amber-700">
              You don't have a patient profile yet. Please contact reception to register.
            </div>
          )}

          {ownPatient && (
            <form onSubmit={handleSubmit((d) => mutation.mutate({ ...d, patientId: ownPatient.id, visitType: "ONLINE" }))} className="space-y-4">
              <Input label="Chief Complaint" placeholder="What brings you in today?" {...register("chiefComplaint")} />
              <Select label="Department (optional)" options={deptOptions} placeholder="Select department" {...register("departmentId")} />
              <Input label="Preferred Date/Time (optional)" type="datetime-local" {...register("scheduledAt")} />
              <div className="flex gap-3">
                <Button variant="secondary" className="flex-1" type="button" onClick={handleClose}>Cancel</Button>
                <Button className="flex-1" type="submit" loading={mutation.isPending}>Request Visit</Button>
              </div>
            </form>
          )}
        </div>
      </Modal>
    );
  }

  // Receptionist/Admin — Entry A: Walk-in
  return (
    <Modal open={open} onClose={handleClose} title="Create Visit" size="lg">
      {step === "search" ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">Search for an existing patient or register a new one.</p>

          <SearchInput
            value={patientSearch}
            onChange={setPatientSearch}
            placeholder="Search by name or phone..."
            className="w-full"
          />

          {/* Results */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {searching && <p className="text-sm text-gray-400 text-center py-4">Searching...</p>}
            {!searching && patientSearch.length > 1 && searchResults?.patients?.length === 0 && (
              <div className="text-center py-6">
                <p className="text-sm text-gray-400 mb-3">No patient found for "{patientSearch}"</p>
                <a href="/dashboard/patients" className="text-sm text-blue-600 hover:underline font-medium flex items-center justify-center gap-1">
                  <UserPlus className="w-4 h-4" /> Register new patient
                </a>
              </div>
            )}
            {searchResults?.patients?.map((p: any) => (
              <button
                key={p.id}
                onClick={() => handleSelectPatient(p)}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-blue-300 hover:bg-blue-50 transition-all text-left"
              >
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                  {p.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{p.name}</p>
                  <p className="text-xs text-gray-500">{p.phone} · {p.gender}</p>
                  {p.allergies && <p className="text-xs text-red-500">⚠ {p.allergies}</p>}
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  p.status === "WAITING" ? "bg-yellow-100 text-yellow-700" :
                  p.status === "IN_CONSULTATION" ? "bg-blue-100 text-blue-700" :
                  "bg-gray-100 text-gray-600"
                }`}>{p.status}</span>
              </button>
            ))}
          </div>

          <div className="pt-2 border-t border-gray-100">
            <a href="/dashboard/patients" className="text-sm text-blue-600 hover:underline font-medium flex items-center gap-1">
              <UserPlus className="w-4 h-4" /> Register new patient first
            </a>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Selected patient */}
          <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl">
            <UserCheck className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">{selectedPatient?.name}</p>
              <p className="text-xs text-gray-500">{selectedPatient?.phone} · {selectedPatient?.gender}</p>
            </div>
            <button onClick={() => setStep("search")} className="text-xs text-blue-600 hover:underline">Change</button>
          </div>

          <form onSubmit={handleSubmit((d) => mutation.mutate({ ...d, patientId: selectedPatient.id }))} className="space-y-4">
            <Input label="Chief Complaint" placeholder="Reason for visit" {...register("chiefComplaint")} />
            <Select label="Department (optional)" options={deptOptions} placeholder="Select department" {...register("departmentId")} />
            <Select
              label="Visit Type"
              options={[{ value: "WALK_IN", label: "Walk-in" }, { value: "ONLINE", label: "Online Booking" }]}
              {...register("visitType")}
            />
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" type="button" onClick={handleClose}>Cancel</Button>
              <Button className="flex-1" type="submit" loading={mutation.isPending}>Create Visit</Button>
            </div>
          </form>
        </div>
      )}
    </Modal>
  );
}
