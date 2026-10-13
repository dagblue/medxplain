"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import {
  Activity, Heart, Zap, Shield, Users, Calendar,
  FlaskConical, ArrowRight, Star, CheckCircle, ChevronDown,
  Stethoscope, TrendingUp, Globe, Brain,
} from "lucide-react";

const STATS = [
  { value: "50K+", label: "Patients Managed", icon: Users },
  { value: "1,200+", label: "Doctors Onboard", icon: Stethoscope },
  { value: "99.9%", label: "Uptime Guaranteed", icon: Shield },
  { value: "4.9★", label: "Average Rating", icon: Star },
];

const FEATURES = [
  { icon: Calendar, title: "Smart Appointments", desc: "AI-powered scheduling that eliminates double-bookings and optimizes doctor availability in real time.", color: "from-blue-500 to-cyan-400", bg: "bg-blue-50" },
  { icon: FlaskConical, title: "Lab Reports", desc: "Upload, attach, and share lab results instantly. Doctors get notified the moment results are ready.", color: "from-purple-500 to-pink-400", bg: "bg-purple-50" },
  { icon: Brain, title: "Patient Intelligence", desc: "Full medical history, prescriptions, and visit records in one unified, searchable profile.", color: "from-emerald-500 to-teal-400", bg: "bg-emerald-50" },
  { icon: Shield, title: "Role-Based Access", desc: "Granular permissions for Admins, Doctors, Nurses, Receptionists, and Lab Techs. Zero data leaks.", color: "from-orange-500 to-red-400", bg: "bg-orange-50" },
  { icon: TrendingUp, title: "Live Analytics", desc: "Real-time dashboards showing appointment stats, department loads, and patient flow at a glance.", color: "from-indigo-500 to-blue-400", bg: "bg-indigo-50" },
  { icon: Globe, title: "Multi-Department", desc: "Cardiology, Neurology, Emergency, Radiology, Lab — all managed from one unified platform.", color: "from-rose-500 to-pink-400", bg: "bg-rose-50" },
];

const ROLES = [
  { role: "Admin", color: "bg-red-100 text-red-700 border-red-200", desc: "Full system control" },
  { role: "Doctor", color: "bg-blue-100 text-blue-700 border-blue-200", desc: "Patient & appointment access" },
  { role: "Nurse", color: "bg-green-100 text-green-700 border-green-200", desc: "Patient care support" },
  { role: "Receptionist", color: "bg-yellow-100 text-yellow-700 border-yellow-200", desc: "Booking & front desk" },
  { role: "Lab Tech", color: "bg-purple-100 text-purple-700 border-purple-200", desc: "Reports & diagnostics" },
];

const TESTIMONIALS = [
  { name: "Dr. Sarah Chen", role: "Chief of Cardiology", text: "MedXplain cut our appointment chaos by 80%. The dashboard is insanely clean and fast.", avatar: "SC", color: "bg-blue-500" },
  { name: "James Okafor", role: "Hospital Administrator", text: "Finally a system that actually works. Setup took 20 minutes. Our staff loves it.", avatar: "JO", color: "bg-emerald-500" },
  { name: "Dr. Priya Nair", role: "Head of Neurology", text: "Patient history, prescriptions, lab reports — all in one place. This is the future.", avatar: "PN", color: "bg-purple-500" },
];

function FloatingOrb({ className }: { className: string }) {
  return (
    <motion.div
      className={`absolute rounded-full blur-3xl opacity-20 pointer-events-none ${className}`}
      animate={{ scale: [1, 1.2, 1], x: [0, 30, 0], y: [0, -20, 0] }}
      transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

export default function HomePage() {
  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.3], [0, -80]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.3], [1, 0]);
  const [activeTestimonial, setActiveTestimonial] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setActiveTestimonial((p) => (p + 1) % TESTIMONIALS.length), 4000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen bg-[#F8FAFC] overflow-x-hidden">

      {/* ── Navbar ── */}
      <motion.nav
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100 shadow-sm"
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-blue-400 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">MedXplain</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
            <a href="#features" className="hover:text-blue-600 transition-colors">Features</a>
            <a href="#roles" className="hover:text-blue-600 transition-colors">Roles</a>
            <a href="#testimonials" className="hover:text-blue-600 transition-colors">Reviews</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors px-4 py-2">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-blue-200 hover:shadow-blue-300 hover:-translate-y-0.5 inline-block"
            >
              Get Started
            </Link>
          </div>
        </div>
      </motion.nav>

      {/* ── Hero ── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
        <FloatingOrb className="w-[600px] h-[600px] bg-blue-400 -top-40 -right-40" />
        <FloatingOrb className="w-[400px] h-[400px] bg-purple-400 bottom-0 -left-20" />
        <FloatingOrb className="w-[300px] h-[300px] bg-cyan-400 top-1/2 left-1/2" />

        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "linear-gradient(#2563EB 1px, transparent 1px), linear-gradient(90deg, #2563EB 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="relative z-10 text-center max-w-5xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 text-blue-700 text-sm font-semibold px-4 py-2 rounded-full mb-8"
          >
            <Zap className="w-4 h-4 text-blue-500" />
            The #1 Hospital Management Platform
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.7, ease: "easeOut" }}
            className="text-6xl md:text-8xl font-black text-gray-900 leading-[1.05] tracking-tight mb-6"
          >
            Healthcare
            <br />
            <span className="relative inline-block">
              <span className="bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-400 bg-clip-text text-transparent">
                Reimagined.
              </span>
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.9, duration: 0.6 }}
                className="absolute -bottom-2 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 to-cyan-400 rounded-full origin-left"
              />
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="text-xl md:text-2xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            MedXplain unifies patients, doctors, appointments, lab reports, and prescriptions into one blazing-fast platform.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <Link href="/signup">
              <motion.button
                whileHover={{ scale: 1.04, y: -2 }}
                whileTap={{ scale: 0.97 }}
                className="group flex items-center gap-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg px-8 py-4 rounded-2xl shadow-2xl shadow-blue-300 transition-all"
              >
                Start for Free
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </motion.button>
            </Link>
            <Link href="/login">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center gap-2 bg-white border-2 border-gray-200 hover:border-blue-300 text-gray-700 font-semibold text-lg px-8 py-4 rounded-2xl transition-all"
              >
                Sign In
              </motion.button>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            className="flex flex-wrap justify-center gap-6 mt-12 text-sm text-gray-400"
          >
            {["No credit card required", "HIPAA compliant", "99.9% uptime SLA"].map((t) => (
              <div key={t} className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-green-400" />
                {t}
              </div>
            ))}
          </motion.div>
        </motion.div>

        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 text-gray-300"
        >
          <ChevronDown className="w-6 h-6" />
        </motion.div>
      </section>

      {/* ── Stats ── */}
      <section className="py-20 bg-white border-y border-gray-100">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-50 rounded-2xl mb-3">
                  <stat.icon className="w-6 h-6 text-blue-600" />
                </div>
                <div className="text-4xl font-black text-gray-900">{stat.value}</div>
                <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-28 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="inline-block bg-blue-50 text-blue-600 text-sm font-semibold px-4 py-1.5 rounded-full mb-4">
              Everything you need
            </span>
            <h2 className="text-5xl font-black text-gray-900 mb-4">Built for modern hospitals</h2>
            <p className="text-xl text-gray-500 max-w-2xl mx-auto">
              Every module is designed to eliminate friction and let your team focus on what matters — patient care.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                whileHover={{ y: -6 }}
                className="bg-white rounded-2xl border border-gray-100 p-7 cursor-default shadow-card hover:shadow-card-hover transition-shadow"
              >
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-2xl ${f.bg} mb-5`}>
                  <div className={`bg-gradient-to-br ${f.color} rounded-xl p-2`}>
                    <f.icon className="w-5 h-5 text-white" />
                  </div>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Roles ── */}
      <section id="roles" className="py-28 bg-gradient-to-br from-blue-600 to-blue-800 relative overflow-hidden">
        <FloatingOrb className="w-[500px] h-[500px] bg-white -top-40 -right-40" />
        <FloatingOrb className="w-[300px] h-[300px] bg-cyan-300 bottom-0 left-0" />
        <div className="relative z-10 max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-5xl font-black text-white mb-4">One platform, every role</h2>
            <p className="text-blue-200 text-xl max-w-xl mx-auto">
              Tailored dashboards and permissions for every member of your hospital team.
            </p>
          </motion.div>
          <div className="flex flex-wrap justify-center gap-4">
            {ROLES.map((r, i) => (
              <motion.div
                key={r.role}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, type: "spring" }}
                whileHover={{ scale: 1.06, rotate: 1 }}
                className="bg-white rounded-2xl px-6 py-5 text-center shadow-xl min-w-[160px]"
              >
                <span className={`inline-block text-xs font-bold px-3 py-1 rounded-full border mb-2 ${r.color}`}>
                  {r.role}
                </span>
                <p className="text-xs text-gray-500">{r.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section id="testimonials" className="py-28 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-5xl font-black text-gray-900 mb-4">Loved by healthcare teams</h2>
            <p className="text-gray-500 text-xl">Real feedback from real hospitals.</p>
          </motion.div>

          <div className="relative h-64">
            <AnimatePresence mode="wait">
              {TESTIMONIALS.map((t, i) =>
                i === activeTestimonial ? (
                  <motion.div
                    key={t.name}
                    initial={{ opacity: 0, x: 60, scale: 0.95 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -60, scale: 0.95 }}
                    transition={{ duration: 0.4 }}
                    className="absolute inset-0 bg-white rounded-3xl border border-gray-100 shadow-xl p-10 flex flex-col justify-between"
                  >
                    <p className="text-xl text-gray-700 font-medium leading-relaxed">"{t.text}"</p>
                    <div className="flex items-center gap-4 mt-6">
                      <div className={`w-12 h-12 ${t.color} rounded-2xl flex items-center justify-center text-white font-bold text-sm`}>
                        {t.avatar}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{t.name}</p>
                        <p className="text-sm text-gray-500">{t.role}</p>
                      </div>
                      <div className="ml-auto flex gap-1">
                        {[...Array(5)].map((_, s) => (
                          <Star key={s} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        ))}
                      </div>
                    </div>
                  </motion.div>
                ) : null
              )}
            </AnimatePresence>
          </div>

          <div className="flex justify-center gap-2 mt-8">
            {TESTIMONIALS.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveTestimonial(i)}
                className={`rounded-full transition-all ${i === activeTestimonial ? "w-8 h-2.5 bg-blue-600" : "w-2.5 h-2.5 bg-gray-200"}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-28 px-6">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 rounded-3xl p-16 text-center relative overflow-hidden shadow-2xl shadow-blue-200"
        >
          <FloatingOrb className="w-64 h-64 bg-white -top-20 -right-20" />
          <FloatingOrb className="w-48 h-48 bg-cyan-300 -bottom-10 -left-10" />
          <div className="relative z-10">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 3, repeat: Infinity }}
              className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-2xl mb-6"
            >
              <Heart className="w-8 h-8 text-white" />
            </motion.div>
            <h2 className="text-5xl font-black text-white mb-4">Ready to transform your hospital?</h2>
            <p className="text-blue-200 text-xl mb-10 max-w-xl mx-auto">
              Join thousands of healthcare professionals already using MedXplain.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup">
                <motion.button
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-2 bg-white text-blue-700 font-bold text-lg px-8 py-4 rounded-2xl shadow-xl hover:shadow-2xl transition-all"
                >
                  Create Free Account <ArrowRight className="w-5 h-5" />
                </motion.button>
              </Link>
              <Link href="/login">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/30 text-white font-semibold text-lg px-8 py-4 rounded-2xl transition-all"
                >
                  Sign In
                </motion.button>
              </Link>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-white border-t border-gray-100 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900">MedXplain</span>
          </div>
          <p className="text-sm text-gray-400">© 2026 MedXplain. Built for the future of healthcare.</p>
          <div className="flex gap-6 text-sm text-gray-500">
            <Link href="/login" className="hover:text-blue-600 transition-colors">Sign In</Link>
            <Link href="/signup" className="hover:text-blue-600 transition-colors">Sign Up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
