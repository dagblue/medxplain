"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { patientSchema, PatientInput } from "@/lib/validations";
import {
  User, Phone, MapPin, Heart, Briefcase,
  Shield, Users, X, CheckCircle, AlertTriangle, FileText, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const MARITAL = ["Single", "Married", "Divorced", "Widowed"];
const RELATIONS = ["Spouse", "Parent", "Child", "Sibling", "Friend", "Other"];

function SectionHead({ icon: Icon, title, bg, text }: { icon: any; title: string; bg: string; text: string }) {
  return (
    <div className="flex items-center gap-2.5 pb-3 border-b border-gray-100">
      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0", bg)}>
        <Icon className={cn("w-4 h-4", text)} />
      </div>
      <h3 className="font-bold text-gray-900 text-base">{title}</h3>
    </div>
  );
}

export function PatientModal({
  open,
  onClose,
  patient,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  patient?: any;
  onCreated?: (patient: any) => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!patient;

  const {
    register, handleSubmit, reset,
    formState: { errors },
  } = useForm<PatientInput>({
    resolver: zodResolver(patientSchema),
    defaultValues: { gender: "Male", country: "Ethiopia" },
  });

  useEffect(() => {
    if (!open) return;
    if (patient) {
      reset({
        name:               patient.name ?? "",
        nationalId:         patient.id ?? "",   // id IS the national ID
        dateOfBirth:        patient.dateOfBirth ? patient.dateOfBirth.split("T")[0] : "",
        gender:             patient.gender ?? "Male",
        nationality:        patient.nationality ?? "",
        maritalStatus:      patient.maritalStatus ?? "",
        phone:              patient.phone ?? "",
        email:              patient.email ?? "",
        address:            patient.address ?? "",
        city:               patient.city ?? "",
        region:             patient.region ?? "",
        country:            patient.country ?? "Ethiopia",
        bloodGroup:         patient.bloodGroup ?? "",
        allergies:          patient.allergies ?? "",
        chronicConditions:  patient.chronicConditions ?? "",
        currentMedications: patient.currentMedications ?? "",
        dischargeDocument:  patient.dischargeDocument ?? "",
        occupation:         patient.occupation ?? "",
        employer:           patient.employer ?? "",
        insuranceProvider:  patient.insuranceProvider ?? "",
        insurancePolicyNo:  patient.insurancePolicyNo ?? "",
        emergencyContact:   patient.emergencyContact ?? "",
        nextOfKinName:      patient.nextOfKinName ?? "",
        nextOfKinPhone:     patient.nextOfKinPhone ?? "",
        nextOfKinRelation:  patient.nextOfKinRelation ?? "",
      });
    } else {
      reset({ gender: "Male", country: "Ethiopia" });
    }
  }, [patient, open, reset]);

  const mutation = useMutation({
    mutationFn: async (data: PatientInput) => {
      const url = isEdit ? `/api/patients/${patient.id}` : "/api/patients";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Failed"); }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(isEdit ? "Patient record updated" : "Patient registered successfully");
      qc.invalidateQueries({ queryKey: ["patients"] });
      qc.invalidateQueries({ queryKey: ["patient-search"] });
      qc.invalidateQueries({ queryKey: ["appt-patient-search"] });
      if (!isEdit && onCreated) onCreated(data.patient);
      onClose();
    },
    onError: (e: any) => toast.error(e.message ?? "Something went wrong"),
  });

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            className="relative ml-auto w-full max-w-2xl h-full bg-white shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white flex-shrink-0">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {isEdit ? "Edit Patient Record" : "Register New Patient"}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Fields marked <span className="text-red-500 font-semibold">*</span> are required
                </p>
              </div>
              <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="flex-1 overflow-y-auto">
              <div className="px-6 py-6 space-y-8">

                {/* ── 0. Past Clinical Data ── */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2.5 pb-3 border-b border-purple-100">
                    <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-base">Past Clinical Data</h3>
                      <p className="text-xs text-gray-400">Discharge summary or referral letter from a previous hospital</p>
                    </div>
                  </div>
                  {!isEdit && (
                    <div className="p-3 bg-purple-50 border border-purple-100 rounded-xl flex items-start gap-2.5">
                      <Sparkles className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-purple-700">
                        Paste or type the discharge summary / referral letter text below.
                        <span className="font-semibold"> OCR auto-fill coming soon</span> — once enabled, uploading a photo will fill this automatically.
                      </p>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Past Clinical Data
                      <span className="ml-1 text-xs text-gray-400 font-normal">(optional)</span>
                    </label>
                    <textarea
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none bg-white font-mono"
                      rows={5}
                      placeholder={"Paste the discharge summary or referral letter text here…\n\nExample:\nPatient: John Doe, M/45\nDiagnosis: Type 2 Diabetes, Hypertension\nMedications: Metformin 500mg BID, Amlodipine 5mg OD\nDischarge date: 2024-01-15\nFollow-up: 2 weeks"}
                      {...register("dischargeDocument")}
                    />
                  </div>
                </div>

                {/* ── 1. Personal Identity ── */}
                <div className="space-y-4">
                  <SectionHead icon={User} title="Personal Identity" bg="bg-blue-50" text="text-blue-600" />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Input
                        label="Full Name *"
                        placeholder="e.g. Abebe Kebede Tadesse"
                        error={errors.name?.message}
                        {...register("name")}
                      />
                    </div>
                    <Input
                      label="FAN / National ID *"
                      placeholder="e.g. ETH-123456789"
                      error={errors.nationalId?.message}
                      disabled={isEdit}
                      className={isEdit ? "opacity-60 cursor-not-allowed bg-gray-50" : ""}
                      {...register("nationalId")}
                    />
                    <Input
                      label="Date of Birth *"
                      type="date"
                      {...register("dateOfBirth")}
                    />
                    <Select
                      label="Gender *"
                      options={[
                        { value: "Male", label: "Male" },
                        { value: "Female", label: "Female" },
                        { value: "Other", label: "Other" },
                      ]}
                      error={errors.gender?.message}
                      {...register("gender")}
                    />
                    <Select
                      label="Marital Status"
                      options={MARITAL.map(m => ({ value: m, label: m }))}
                      placeholder="Select status"
                      {...register("maritalStatus")}
                    />
                    <Input
                      label="Nationality *"
                      placeholder="e.g. Ethiopian"
                      {...register("nationality")}
                    />
                  </div>
                </div>

                {/* ── 2. Contact Information ── */}
                <div className="space-y-4">
                  <SectionHead icon={Phone} title="Contact Information" bg="bg-green-50" text="text-green-600" />
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Phone Number *"
                      placeholder="+251 91 234 5678"
                      error={errors.phone?.message}
                      {...register("phone")}
                    />
                    <Input
                      label="Email Address"
                      type="email"
                      placeholder="patient@email.com"
                      {...register("email")}
                    />
                    <div className="col-span-2">
                      <Input
                        label="Street Address *"
                        placeholder="House No., Street Name, Kebele"
                        icon={<MapPin className="w-4 h-4" />}
                        {...register("address")}
                      />
                    </div>
                    <Input
                      label="City / Town *"
                      placeholder="e.g. Addis Ababa"
                      {...register("city")}
                    />
                    <Input label="Region / State" placeholder="e.g. Oromia" {...register("region")} />
                    <Input label="Country" placeholder="Ethiopia" {...register("country")} />
                  </div>
                </div>

                {/* ── 3. Medical Background ── */}
                <div className="space-y-4">
                  <SectionHead icon={Heart} title="Medical Background" bg="bg-red-50" text="text-red-600" />
                  <div className="grid grid-cols-2 gap-4">
                    <Select
                      label="Blood Group"
                      options={BLOOD_GROUPS.map(b => ({ value: b, label: b }))}
                      placeholder="Select blood group"
                      {...register("bloodGroup")}
                    />
                    <div />
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Known Allergies{" "}
                        <span className="text-xs text-red-500 font-normal">
                          <AlertTriangle className="w-3 h-3 inline" /> Important for prescriptions
                        </span>
                      </label>
                      <textarea
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none bg-white"
                        rows={2}
                        placeholder="e.g. Penicillin, Peanuts, Latex, Aspirin…"
                        {...register("allergies")}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Chronic Conditions</label>
                      <textarea
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none bg-white"
                        rows={2}
                        placeholder="e.g. Diabetes Type 2, Hypertension, Asthma, HIV…"
                        {...register("chronicConditions")}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Current Medications</label>
                      <textarea
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none bg-white"
                        rows={2}
                        placeholder="e.g. Metformin 500mg daily, Amlodipine 5mg…"
                        {...register("currentMedications")}
                      />
                    </div>
                  </div>
                </div>

                {/* ── 4. Occupation & Insurance ── */}
                <div className="space-y-4">
                  <SectionHead icon={Briefcase} title="Occupation & Insurance" bg="bg-purple-50" text="text-purple-600" />
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="Occupation" placeholder="e.g. Teacher, Farmer, Engineer" {...register("occupation")} />
                    <Input label="Employer / Organization" placeholder="e.g. Ministry of Health" {...register("employer")} />
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5" /> Insurance Details
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <Input label="Insurance Provider" placeholder="e.g. Ethiopian Insurance Corp." {...register("insuranceProvider")} />
                      <Input label="Policy / Member Number" placeholder="e.g. EIC-2024-00123" {...register("insurancePolicyNo")} />
                    </div>
                  </div>
                </div>

                {/* ── 5. Emergency Contact & Next of Kin ── */}
                <div className="space-y-4">
                  <SectionHead icon={Users} title="Emergency Contact & Next of Kin" bg="bg-orange-50" text="text-orange-600" />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Input label="Emergency Contact" placeholder="Full name and phone number" {...register("emergencyContact")} />
                    </div>
                    <Input label="Next of Kin — Full Name" placeholder="e.g. Sara Kebede" {...register("nextOfKinName")} />
                    <Input label="Next of Kin — Phone" placeholder="+251 91 234 5678" {...register("nextOfKinPhone")} />
                    <Select
                      label="Relationship to Patient"
                      options={RELATIONS.map(r => ({ value: r, label: r }))}
                      placeholder="Select relationship"
                      {...register("nextOfKinRelation")}
                    />
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex items-center justify-between gap-3 flex-shrink-0">
                <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
                <Button type="submit" loading={mutation.isPending} icon={<CheckCircle className="w-4 h-4" />}>
                  {isEdit ? "Save Changes" : "Register Patient"}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
