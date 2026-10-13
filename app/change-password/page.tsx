"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSession } from "@/lib/auth-client";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Activity, Lock, Eye, EyeOff, ShieldCheck, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(6, "New password must be at least 6 characters"),
    confirmPassword: z.string().min(6, "Please confirm your new password"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    message: "New password must be different from current password",
    path: ["newPassword"],
  });

type FormInput = z.infer<typeof schema>;

export default function ChangePasswordPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormInput>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormInput) => {
    setLoading(true);
    try {
      const res = await fetch("/api/profile/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        toast.error(result.error || "Failed to change password");
        return;
      }

      toast.success("Password changed successfully! Welcome to MedXplain 🎉");
      router.push("/dashboard");
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl shadow-lg shadow-blue-200 mb-4">
            <Activity className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">MedXplain</h1>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden"
        >
          {/* Warning banner */}
          <div className="bg-amber-50 border-b border-amber-100 px-6 py-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Password change required</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Your account was created by an administrator. You must set your own password before continuing.
              </p>
            </div>
          </div>

          <div className="p-8">
            {/* User info */}
            {session?.user && (
              <div className="flex items-center gap-3 mb-6 p-3 bg-gray-50 rounded-xl">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                  {session.user.name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{session.user.name}</p>
                  <p className="text-xs text-gray-500">{session.user.email}</p>
                </div>
                <div className="ml-auto">
                  <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                    {(session.user as any).role?.replace("_", " ")}
                  </span>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 mb-6">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-bold text-gray-900">Set your new password</h2>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Current (admin-set) password */}
              <div className="relative">
                <Input
                  label="Current Password (set by admin)"
                  type={showCurrent ? "text" : "password"}
                  placeholder="Enter the password given to you"
                  icon={<Lock className="w-4 h-4" />}
                  error={errors.currentPassword?.message}
                  {...register("currentPassword")}
                />
                <button type="button" onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-8 text-gray-400 hover:text-gray-600">
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* New password */}
              <div className="relative">
                <Input
                  label="New Password"
                  type={showNew ? "text" : "password"}
                  placeholder="Min 6 characters"
                  icon={<Lock className="w-4 h-4" />}
                  error={errors.newPassword?.message}
                  {...register("newPassword")}
                />
                <button type="button" onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-8 text-gray-400 hover:text-gray-600">
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Confirm new password */}
              <div className="relative">
                <Input
                  label="Confirm New Password"
                  type={showConfirm ? "text" : "password"}
                  placeholder="Repeat your new password"
                  icon={<Lock className="w-4 h-4" />}
                  error={errors.confirmPassword?.message}
                  {...register("confirmPassword")}
                />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-8 text-gray-400 hover:text-gray-600">
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password tips */}
              <div className="p-3 bg-blue-50 rounded-xl">
                <p className="text-xs font-semibold text-blue-700 mb-1.5">Password tips</p>
                <ul className="space-y-1 text-xs text-blue-600">
                  <li>• At least 6 characters long</li>
                  <li>• Mix letters, numbers, and symbols</li>
                  <li>• Don't reuse your old password</li>
                </ul>
              </div>

              <Button type="submit" className="w-full justify-center" size="lg" loading={loading}>
                Set New Password & Continue
              </Button>
            </form>
          </div>
        </motion.div>

        <p className="text-center text-xs text-gray-400 mt-6">
          © 2026 MedXplain. All rights reserved.
        </p>
      </div>
    </div>
  );
}
