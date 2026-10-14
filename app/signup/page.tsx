"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Activity, Mail, Lock, Eye, EyeOff, User, ShieldCheck, Phone, Stethoscope, Clipboard, MapPin } from "lucide-react";
import toast from "react-hot-toast";

const createStaffSchema = z.object({
  name: z.string().min(2, "Full name required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Min 6 characters"),
  confirm: z.string().min(6, "Confirm password"),
  role: z.enum(["RECEPTIONIST", "DOCTOR", "NURSE", "LAB_TECHNICIAN", "PHARMACIST", "ACCOUNTANT", "ADMIN"]),
  phone: z.string().optional(),
  specialization: z.string().optional(),
  departmentId: z.string().optional(),
  availability: z.string().optional(),
  bio: z.string().optional(),
  ward: z.string().optional(),
}).refine(d => d.password === d.confirm, { message: "Passwords don't match", path: ["confirm"] });

type FormData = z.infer<typeof createStaffSchema>;

export default function SignupPage() {
  const router = useRouter();
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);

  const { register, handleSubmit, formState: { errors }, control } = useForm<FormData>({
    resolver: zodResolver(createStaffSchema),
    defaultValues: { role: "ADMIN" },
  });

  const selectedRole = useWatch({ control, name: "role" });

  // Only allow access if no users exist yet (first-time setup)
  useEffect(() => {
    fetch("/api/admin/create-staff", { method: "GET" })
      .then(res => res.json())
      .then(data => {
        if (!data.bootstrap) {
          router.replace("/login");
        } else {
          setChecking(false);
        }
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  const fetchDepartments = async () => {
    try {
      const res = await fetch("/api/departments");
      const data = await res.json();
      setDepartments(data);
    } catch {
      console.warn("Could not load departments");
    }
  };

  if (selectedRole === "DOCTOR" && departments.length === 0) fetchDepartments();

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/create-staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          password: data.password,
          role: data.role,
          phone: data.phone,
          specialization: data.specialization,
          departmentId: data.departmentId,
          availability: data.availability,
          bio: data.bio,
          ward: data.ward,
        }),
      });

      const text = await res.text();
      let result: any = {};
      try { result = JSON.parse(text); } catch { result = { error: text || "Server error" }; }
      if (!res.ok) throw new Error(result.error || "Creation failed");

      toast.success("Admin account created — please sign in");
      router.push("/login");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-gray-900">MedXplain</span>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-black text-gray-900 mb-1">First-time setup</h1>
          <p className="text-gray-500 mb-6">Create the initial administrator account to get started.</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Full Name" placeholder="Admin User" icon={<User className="w-4 h-4" />} error={errors.name?.message} {...register("name")} />
              <Input label="Email" type="email" placeholder="admin@hospital.com" icon={<Mail className="w-4 h-4" />} error={errors.email?.message} {...register("email")} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <Input label="Password" type={showPw ? "text" : "password"} icon={<Lock className="w-4 h-4" />} error={errors.password?.message} {...register("password")} />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-8 text-gray-400 hover:text-gray-600">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Input label="Confirm Password" type={showPw ? "text" : "password"} icon={<Lock className="w-4 h-4" />} error={errors.confirm?.message} {...register("confirm")} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <div className="relative">
                  <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <select {...register("role")} className="w-full pl-9 pr-3 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500">
                    <option value="ADMIN">Administrator</option>
                    <option value="RECEPTIONIST">Receptionist</option>
                    <option value="DOCTOR">Doctor</option>
                    <option value="NURSE">Nurse</option>
                    <option value="LAB_TECHNICIAN">Lab Technician</option>
                    <option value="PHARMACIST">Pharmacist</option>
                    <option value="ACCOUNTANT">Accountant</option>
                  </select>
                </div>
              </div>
              <Input label="Phone (optional)" placeholder="+251 912 345678" icon={<Phone className="w-4 h-4" />} {...register("phone")} />
            </div>

            {selectedRole === "DOCTOR" && (
              <div className="border-t pt-4 space-y-4">
                <h3 className="font-semibold">Doctor Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Specialization" placeholder="Cardiology" icon={<Stethoscope className="w-4 h-4" />} {...register("specialization")} />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                    <select {...register("departmentId")} className="w-full border rounded-lg p-2">
                      <option value="">Select department</option>
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <Input label="Availability" placeholder="Mon-Fri 9-5" icon={<Clipboard className="w-4 h-4" />} {...register("availability")} />
                  <textarea placeholder="Bio" {...register("bio")} className="border rounded-lg p-2" rows={2} />
                </div>
              </div>
            )}

            {selectedRole === "NURSE" && (
              <div className="border-t pt-4">
                <Input label="Ward" placeholder="Emergency, ICU" icon={<MapPin className="w-4 h-4" />} {...register("ward")} />
              </div>
            )}

            <Button type="submit" className="w-full justify-center mt-4" size="lg" loading={loading}>
              Create Account
            </Button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
