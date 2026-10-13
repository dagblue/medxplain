"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { RoleBadge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  User, Mail, Phone, Lock, Eye, EyeOff,
  Edit2, Save, X, ShieldCheck, Calendar,
  Stethoscope, Building2, Clock, Heart,
} from "lucide-react";
import { formatDate, ROLE_LABELS, type Role } from "@/lib/utils";
import toast from "react-hot-toast";

// ── Schemas ──────────────────────────────────────────────────────────────────

const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().optional(),
});

const passwordSchema = z
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
    message: "New password must be different from current",
    path: ["newPassword"],
  });

type ProfileInput = z.infer<typeof profileSchema>;
type PasswordInput = z.infer<typeof passwordSchema>;

// ── Main component ────────────────────────────────────────────────────────────

export function ProfileClient() {
  const [editingProfile, setEditingProfile] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await fetch("/api/profile");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const user = data?.user;

  const profileForm = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    values: { name: user?.name ?? "", phone: user?.phone ?? "" },
  });

  const passwordForm = useForm<PasswordInput>({ resolver: zodResolver(passwordSchema) });

  const profileMutation = useMutation({
    mutationFn: async (formData: ProfileInput) => {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Profile updated");
      qc.invalidateQueries({ queryKey: ["profile"] });
      setEditingProfile(false);
    },
    onError: () => toast.error("Failed to update profile"),
  });

  const passwordMutation = useMutation({
    mutationFn: async (formData: PasswordInput) => {
      const res = await fetch("/api/profile/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed");
      return result;
    },
    onSuccess: () => {
      toast.success("Password changed successfully");
      passwordForm.reset();
    },
    onError: (err: any) => toast.error(err.message || "Failed to change password"),
  });

  if (isLoading) return <ProfileSkeleton />;

  const initials = user?.name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() ?? "??";
  const roleLabel = ROLE_LABELS[user?.role as Role] ?? user?.role;

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* ── Profile header card ── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
        {/* Cover */}
        <div className="h-24 bg-gradient-to-r from-blue-600 to-indigo-600" />
        <div className="px-6 pb-6">
          {/* Avatar */}
          <div className="flex items-end justify-between -mt-10 mb-4">
            <div className="w-20 h-20 bg-white rounded-2xl border-4 border-white shadow-lg flex items-center justify-center text-blue-700 font-black text-2xl">
              {initials}
            </div>
            <RoleBadge role={user?.role} />
          </div>

          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{user?.name}</h2>
              <p className="text-gray-500 text-sm">{roleLabel}</p>
            </div>
            {!editingProfile && (
              <Button variant="secondary" size="sm" icon={<Edit2 className="w-4 h-4" />} onClick={() => setEditingProfile(true)}>
                Edit Profile
              </Button>
            )}
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
            <InfoRow icon={<Mail className="w-4 h-4 text-gray-400" />} label="Email" value={user?.email} />
            <InfoRow icon={<Phone className="w-4 h-4 text-gray-400" />} label="Phone" value={user?.phone || "Not set"} />
            <InfoRow icon={<Calendar className="w-4 h-4 text-gray-400" />} label="Member since" value={formatDate(user?.createdAt)} />
            <InfoRow icon={<ShieldCheck className="w-4 h-4 text-gray-400" />} label="Account type" value={roleLabel} />
          </div>
        </div>
      </motion.div>

      {/* ── Role profile details ── */}
      {user?.doctorProfile && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="bg-white rounded-2xl shadow-card border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Stethoscope className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Doctor Profile</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InfoRow icon={<Stethoscope className="w-4 h-4 text-gray-400" />} label="Specialization" value={user.doctorProfile.specialization} />
            <InfoRow icon={<Building2 className="w-4 h-4 text-gray-400" />} label="Department" value={user.doctorProfile.department?.name} />
            <InfoRow icon={<Clock className="w-4 h-4 text-gray-400" />} label="Availability" value={user.doctorProfile.availability || "Not set"} />
          </div>
          {user.doctorProfile.bio && (
            <div className="mt-3 p-3 bg-gray-50 rounded-xl">
              <p className="text-xs font-semibold text-gray-500 mb-1">Bio</p>
              <p className="text-sm text-gray-700">{user.doctorProfile.bio}</p>
            </div>
          )}
        </motion.div>
      )}

      {user?.nurseProfile && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="bg-white rounded-2xl shadow-card border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Heart className="w-5 h-5 text-green-600" />
            <h3 className="font-semibold text-gray-900">Nurse Profile</h3>
          </div>
          <InfoRow icon={<Building2 className="w-4 h-4 text-gray-400" />} label="Ward" value={user.nurseProfile.ward || "Not assigned"} />
        </motion.div>
      )}

      {/* ── Edit profile form ── */}
      {editingProfile && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-card border border-blue-100 p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold text-gray-900">Edit Profile</h3>
            </div>
            <button onClick={() => setEditingProfile(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={profileForm.handleSubmit((d) => profileMutation.mutate(d))} className="space-y-4">
            <Input label="Full Name" icon={<User className="w-4 h-4" />} error={profileForm.formState.errors.name?.message} {...profileForm.register("name")} />
            <Input label="Phone Number" type="tel" placeholder="+1 234 567 8900" icon={<Phone className="w-4 h-4" />} {...profileForm.register("phone")} />
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" type="button" onClick={() => setEditingProfile(false)} icon={<X className="w-4 h-4" />}>Cancel</Button>
              <Button className="flex-1" type="submit" loading={profileMutation.isPending} icon={<Save className="w-4 h-4" />}>Save Changes</Button>
            </div>
          </form>
        </motion.div>
      )}

      {/* ── Change password ── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl shadow-card border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-5">
          <Lock className="w-5 h-5 text-gray-600" />
          <h3 className="font-semibold text-gray-900">Change Password</h3>
        </div>

        <form onSubmit={passwordForm.handleSubmit((d) => passwordMutation.mutate(d))} className="space-y-4">
          <div className="relative">
            <Input
              label="Current Password"
              type={showCurrent ? "text" : "password"}
              placeholder="Your current password"
              icon={<Lock className="w-4 h-4" />}
              error={passwordForm.formState.errors.currentPassword?.message}
              {...passwordForm.register("currentPassword")}
            />
            <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-8 text-gray-400 hover:text-gray-600">
              {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <div className="relative">
            <Input
              label="New Password"
              type={showNew ? "text" : "password"}
              placeholder="Min 6 characters"
              icon={<Lock className="w-4 h-4" />}
              error={passwordForm.formState.errors.newPassword?.message}
              {...passwordForm.register("newPassword")}
            />
            <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-8 text-gray-400 hover:text-gray-600">
              {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <div className="relative">
            <Input
              label="Confirm New Password"
              type={showConfirm ? "text" : "password"}
              placeholder="Repeat new password"
              icon={<Lock className="w-4 h-4" />}
              error={passwordForm.formState.errors.confirmPassword?.message}
              {...passwordForm.register("confirmPassword")}
            />
            <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-8 text-gray-400 hover:text-gray-600">
              {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <Button type="submit" loading={passwordMutation.isPending} icon={<ShieldCheck className="w-4 h-4" />}>
            Update Password
          </Button>
        </form>
      </motion.div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
      <div className="flex-shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm font-medium text-gray-900 truncate">{value || "—"}</p>
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-pulse">
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="h-24 bg-gray-200" />
        <div className="p-6 space-y-4">
          <div className="flex items-end gap-4 -mt-10">
            <div className="w-20 h-20 bg-gray-200 rounded-2xl" />
          </div>
          <div className="h-6 bg-gray-200 rounded w-48" />
          <div className="grid grid-cols-2 gap-3">
            {[1,2,3,4].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl" />)}
          </div>
        </div>
      </div>
      <div className="h-64 bg-white rounded-2xl border border-gray-100" />
    </div>
  );
}
