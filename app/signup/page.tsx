"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signIn } from "@/lib/auth-client";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import {
  Activity, Mail, Lock, Eye, EyeOff, User, Phone, ArrowLeft,
  Stethoscope, Shield, Clock, Users,
} from "lucide-react";
import toast from "react-hot-toast";

const signupSchema = z.object({
  name: z.string().min(2, "Full name required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Min 6 characters"),
  confirm: z.string().min(6, "Confirm your password"),
  phone: z.string().optional(),
}).refine(d => d.password === d.confirm, {
  message: "Passwords don't match",
  path: ["confirm"],
});

type FormData = z.infer<typeof signupSchema>;

const HIGHLIGHTS = [
  { icon: Stethoscope, text: "Book appointments with top doctors" },
  { icon: Clock, text: "Track your visit history in real time" },
  { icon: Shield, text: "Your medical data stays private and secure" },
  { icon: Users, text: "Connect with your care team directly" },
];

function FloatingOrb({ className }: { className: string }) {
  return (
    <motion.div
      className={`absolute rounded-full blur-3xl opacity-20 pointer-events-none ${className}`}
      animate={{ scale: [1, 1.2, 1], x: [0, 25, 0], y: [0, -20, 0] }}
      transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

export default function SignupPage() {
  const router = useRouter();
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(signupSchema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      // Register via Better Auth as PATIENT (default role)
      const res = await fetch("/api/auth/sign-up/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          password: data.password,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.message ?? result.error ?? "Registration failed");

      // Update phone if provided
      if (data.phone) {
        await fetch("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: data.phone }),
        });
      }

      toast.success("Account created — welcome to MedXplain!");
      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">

      {/* ── Left panel ── */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 relative overflow-hidden flex-col justify-between p-12">
        <FloatingOrb className="w-[500px] h-[500px] bg-white -top-32 -right-32" />
        <FloatingOrb className="w-[300px] h-[300px] bg-cyan-300 bottom-10 -left-10" />
        <FloatingOrb className="w-[200px] h-[200px] bg-indigo-300 top-1/2 right-10" />

        {/* Logo */}
        <div className="relative z-10">
          <Link href="/home" className="flex items-center gap-2.5 group w-fit">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center group-hover:bg-white/30 transition-colors">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">MedXplain</span>
          </Link>
        </div>

        {/* Main copy */}
        <div className="relative z-10">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.7 }}
          >
            <h2 className="text-4xl font-black text-white leading-tight mb-4">
              Your health,
              <br />
              <span className="text-cyan-300">in your hands.</span>
            </h2>
            <p className="text-blue-200 text-lg mb-10">
              Create a free patient account and manage your health journey from anywhere.
            </p>

            <div className="space-y-4">
              {HIGHLIGHTS.map((h, i) => (
                <motion.div
                  key={h.text}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.1 }}
                  className="flex items-center gap-3"
                >
                  <div className="w-9 h-9 bg-white/15 rounded-xl flex items-center justify-center flex-shrink-0">
                    <h.icon className="w-4 h-4 text-cyan-300" />
                  </div>
                  <span className="text-blue-100 text-sm">{h.text}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        <div className="relative z-10 text-blue-300 text-xs">
          © 2026 MedXplain. All rights reserved.
        </div>
      </div>

      {/* ── Right panel (form) ── */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">

          {/* Back link */}
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="mb-8">
            <Link href="/home" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back to home
            </Link>
          </motion.div>

          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">MedXplain</span>
          </div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <h1 className="text-3xl font-black text-gray-900 mb-1">Create your account</h1>
            <p className="text-gray-500 mb-8">
              Already have one?{" "}
              <Link href="/login" className="text-blue-600 font-semibold hover:underline">Sign in</Link>
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <Input
                label="Full Name"
                placeholder="Abebe Kebede"
                icon={<User className="w-4 h-4" />}
                error={errors.name?.message}
                {...register("name")}
              />
              <Input
                label="Email address"
                type="email"
                placeholder="you@example.com"
                icon={<Mail className="w-4 h-4" />}
                error={errors.email?.message}
                {...register("email")}
              />
              <Input
                label="Phone (optional)"
                placeholder="+251 912 345 678"
                icon={<Phone className="w-4 h-4" />}
                error={errors.phone?.message}
                {...register("phone")}
              />
              <div className="relative">
                <Input
                  label="Password"
                  type={showPw ? "text" : "password"}
                  placeholder="••••••••"
                  icon={<Lock className="w-4 h-4" />}
                  error={errors.password?.message}
                  {...register("password")}
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-8 text-gray-400 hover:text-gray-600 transition-colors">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Input
                label="Confirm Password"
                type={showPw ? "text" : "password"}
                placeholder="••••••••"
                icon={<Lock className="w-4 h-4" />}
                error={errors.confirm?.message}
                {...register("confirm")}
              />

              <Button type="submit" className="w-full justify-center" size="lg" loading={loading}>
                Create Patient Account
              </Button>
            </form>

            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">staff accounts are managed by admin</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
          </motion.div>

          <p className="text-center text-xs text-gray-400 mt-4">
            © 2026 MedXplain. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
