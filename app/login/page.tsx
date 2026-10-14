"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "@/lib/auth-client";
import { loginSchema, LoginInput } from "@/lib/validations";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import {
  Activity, Mail, Lock, Eye, EyeOff, ArrowLeft,
  Stethoscope, Shield, Clock, Users,
} from "lucide-react";
import toast from "react-hot-toast";

const HIGHLIGHTS = [
  { icon: Stethoscope, text: "Manage doctors & patients in one place" },
  { icon: Clock, text: "Real-time appointment scheduling" },
  { icon: Shield, text: "Role-based access — zero data leaks" },
  { icon: Users, text: "Built for every hospital team member" },
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

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginInput) => {
    setLoading(true);
    try {
      const result = await signIn.email({
        email: data.email,
        password: data.password,
      });
      if (result.error) {
        toast.error(result.error.message || "Invalid credentials");
      } else {
        toast.success("Welcome back!");
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
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
              Welcome back.
              <br />
              <span className="text-cyan-300">Your patients need you.</span>
            </h2>
            <p className="text-blue-200 text-lg mb-10">
              Sign in to access your dashboard, appointments, and patient records.
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

        {/* Highlights end */}
      </div>

      {/* ── Right panel (form) ── */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">

          {/* Back link */}
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="mb-8"
          >
            <Link
              href="/home"
              className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 transition-colors"
            >
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

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-3xl font-black text-gray-900 mb-1">Sign in</h1>
            <p className="text-gray-500 mb-8">
              No account yet?{" "}
              <Link href="/signup" className="text-blue-600 font-semibold hover:underline">
                Create one
              </Link>
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <Input
                label="Email address"
                type="email"
                placeholder="you@hospital.com"
                icon={<Mail className="w-4 h-4" />}
                error={errors.email?.message}
                {...register("email")}
              />

              <div className="relative">
                <Input
                  label="Password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  icon={<Lock className="w-4 h-4" />}
                  error={errors.password?.message}
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-8 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <Button
                type="submit"
                className="w-full justify-center"
                size="lg"
                loading={loading}
              >
                Sign in to dashboard
              </Button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">staff accounts are managed by admin</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>


          </motion.div>

          <p className="text-center text-xs text-gray-400 mt-8">
            © 2026 MedXplain. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
