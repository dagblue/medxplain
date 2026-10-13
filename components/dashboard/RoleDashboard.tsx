"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { StatCard } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { formatDateTime, formatCurrency } from "@/lib/utils";
import { NurseWorkflow } from "@/components/dashboard/NurseWorkflow";
import { DoctorWorkflow } from "@/components/dashboard/DoctorWorkflow";
import { LabWorkflow } from "@/components/dashboard/LabWorkflow";
import { PharmacistWorkflow } from "@/components/dashboard/PharmacistWorkflow";
import Link from "next/link";
import {
  Calendar, Users, Clock, FlaskConical, Pill, Receipt,
  Heart, CheckCircle, AlertCircle, DollarSign, UserCheck,
  ArrowRight, Activity, UserRound, Building2, Bed,
} from "lucide-react";

// ─── Fetch dashboard stats (appointments, revenue, patients, etc.) ─────────
const fetchStats = async () => {
  const res = await fetch("/api/dashboard/stats");
  if (!res.ok) throw new Error("Failed to fetch stats");
  const data = await res.json();
  return {
    ...data,
    totalPatients: Number(data?.totalPatients) || 0,    // from original API
    totalRevenue: Number(data?.totalRevenue) || 0,
    todayAppointments: Number(data?.todayAppointments) || 0,
    pendingLabRequests: Number(data?.pendingLabRequests) || 0,
    pendingPrescriptions: Number(data?.pendingPrescriptions) || 0,
    unpaidBills: Number(data?.unpaidBills) || 0,
    availableBeds: Number(data?.availableBeds) || 0,
    waitingPatients: Number(data?.waitingPatients) || 0,
    admittedPatients: Number(data?.admittedPatients) || 0,
    pendingRequests: Number(data?.pendingRequests) || 0,
    completedToday: Number(data?.completedToday) || 0,
    dispensedToday: Number(data?.dispensedToday) || 0,
    paidToday: Number(data?.paidToday) || 0,
    myAppointments: Number(data?.myAppointments) || 0,
    unreadMessages: Number(data?.unreadMessages) || 0,
    recentAppointments: data?.recentAppointments ?? [],
    recentBills: data?.recentBills ?? [],
    recentVitals: data?.recentVitals ?? [],
    recentRequests: data?.recentRequests ?? [],
    recentPrescriptions: data?.recentPrescriptions ?? [],
  };
};

// ─── Fetch all users to count staff roles (excluding patients) ────────────
const fetchAllUsers = async () => {
  const res = await fetch("/api/users?limit=1000&page=1");
  if (!res.ok) throw new Error("Failed to fetch users");
  const data = await res.json();
  return data.users || [];
};

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.07 } } };
const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

function Section({ title, href, children }: { title: string; href?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-card border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">{title}</h2>
        {href && <Link href={href} className="text-sm text-blue-600 hover:underline font-medium flex items-center gap-1">View all <ArrowRight className="w-3 h-3" /></Link>}
      </div>
      {children}
    </div>
  );
}

// ── ADMIN DASHBOARD (patients from stats API, other roles from users) ──────
export function AdminDashboard() {
  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery({
    queryKey: ["stats"],
    queryFn: fetchStats,
  });
  const { data: users, isLoading: usersLoading, error: usersError } = useQuery({
    queryKey: ["all-users"],
    queryFn: fetchAllUsers,
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = statsLoading || usersLoading;
  const error = statsError || usersError;

  if (isLoading) return <DashboardSkeleton count={14} />;
  if (error) return <DashboardError message="Failed to load admin dashboard" />;

  // Count staff roles from users array (exclude PATIENT)
  const totalPatients = stats?.totalPatients ?? 0;   // from stats API
  const totalDoctors = users?.filter((u: any) => u.role === "DOCTOR").length || 0;
  const totalNurses = users?.filter((u: any) => u.role === "NURSE").length || 0;
  const totalLabTechs = users?.filter((u: any) => u.role === "LAB_TECHNICIAN").length || 0;
  const totalReceptionists = users?.filter((u: any) => u.role === "RECEPTIONIST").length || 0;
  const totalPharmacists = users?.filter((u: any) => u.role === "PHARMACIST").length || 0;
  const totalAccountants = users?.filter((u: any) => u.role === "ACCOUNTANT").length || 0;
  const totalAdmins = users?.filter((u: any) => u.role === "ADMIN").length || 0;

  const statsCards = [
    { title: "Total Patients", value: totalPatients, icon: <Users className="w-6 h-6" />, color: "bg-blue-50 text-blue-600" },
    { title: "Total Doctors", value: totalDoctors, icon: <UserCheck className="w-6 h-6" />, color: "bg-green-50 text-green-600" },
    { title: "Total Nurses", value: totalNurses, icon: <UserRound className="w-6 h-6" />, color: "bg-teal-50 text-teal-600" },
    { title: "Total Lab Techs", value: totalLabTechs, icon: <FlaskConical className="w-6 h-6" />, color: "bg-purple-50 text-purple-600" },
    { title: "Total Receptionists", value: totalReceptionists, icon: <Building2 className="w-6 h-6" />, color: "bg-indigo-50 text-indigo-600" },
    { title: "Total Pharmacists", value: totalPharmacists, icon: <Pill className="w-6 h-6" />, color: "bg-emerald-50 text-emerald-600" },
    { title: "Total Accountants", value: totalAccountants, icon: <DollarSign className="w-6 h-6" />, color: "bg-amber-50 text-amber-600" },
    { title: "Total Admins", value: totalAdmins, icon: <UserCheck className="w-6 h-6" />, color: "bg-rose-50 text-rose-600" },
    { title: "Today's Appointments", value: stats?.todayAppointments, icon: <Calendar className="w-6 h-6" />, color: "bg-purple-50 text-purple-600" },
    { title: "Total Revenue", value: formatCurrency(stats?.totalRevenue), icon: <DollarSign className="w-6 h-6" />, color: "bg-emerald-50 text-emerald-600" },
    { title: "Pending Lab Requests", value: stats?.pendingLabRequests, icon: <FlaskConical className="w-6 h-6" />, color: "bg-yellow-50 text-yellow-600" },
    { title: "Pending Prescriptions", value: stats?.pendingPrescriptions, icon: <Pill className="w-6 h-6" />, color: "bg-orange-50 text-orange-600" },
    { title: "Unpaid Bills", value: stats?.unpaidBills, icon: <Receipt className="w-6 h-6" />, color: "bg-red-50 text-red-600" },
    { title: "Available Beds", value: stats?.availableBeds, icon: <Bed className="w-6 h-6" />, color: "bg-amber-50 text-amber-600" },
  ];

  return (
    <div className="space-y-6">
      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((s) => (
          <motion.div key={s.title} variants={item}><StatCard {...s} /></motion.div>
        ))}
      </motion.div>
      <Section title="Recent Appointments" href="/dashboard/appointments">
        <AppointmentTable rows={stats?.recentAppointments ?? []} showPatient showDoctor />
      </Section>
    </div>
  );
}

// ── RECEPTIONIST ─────────────────────────────────────────────────────────────
export function ReceptionistDashboard() {
  const { data, isLoading, error } = useQuery({ queryKey: ["stats"], queryFn: fetchStats });
  if (isLoading) return <DashboardSkeleton count={3} />;
  if (error) return <DashboardError message="Failed to load receptionist dashboard" />;

  return (
    <div className="space-y-6">
      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { title: "Today's Appointments", value: data?.todayAppointments, icon: <Calendar className="w-6 h-6" />, color: "bg-blue-50 text-blue-600" },
          { title: "Waiting Patients", value: data?.waitingPatients, icon: <Clock className="w-6 h-6" />, color: "bg-yellow-50 text-yellow-600" },
          { title: "Total Patients", value: data?.totalPatients, icon: <Users className="w-6 h-6" />, color: "bg-green-50 text-green-600" },
        ].map((s) => <motion.div key={s.title} variants={item}><StatCard {...s} /></motion.div>)}
      </motion.div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <QuickAction href="/dashboard/patients" icon={<UserCheck className="w-6 h-6" />} title="Register Patient" desc="Add a new patient" color="from-blue-600 to-blue-700" />
        <QuickAction href="/dashboard/appointments" icon={<Calendar className="w-6 h-6" />} title="Book Appointment" desc="Schedule a doctor visit" color="from-purple-600 to-indigo-600" />
      </div>
      <Section title="Today's Schedule" href="/dashboard/appointments">
        <AppointmentTable rows={data?.recentAppointments ?? []} showPatient showDoctor />
      </Section>
    </div>
  );
}

// ── DOCTOR ───────────────────────────────────────────────────────────────────
export function DoctorDashboard() {
  const { data, isLoading, error } = useQuery({ queryKey: ["stats"], queryFn: fetchStats });
  if (isLoading) return <DashboardSkeleton count={3} />;
  if (error) return <DashboardError message="Unable to load doctor dashboard" />;

  return (
    <div className="space-y-6">
      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { title: "Today's Appointments", value: data?.todayAppointments, icon: <Calendar className="w-6 h-6" />, color: "bg-blue-50 text-blue-600" },
          { title: "Lab Results Ready", value: data?.pendingLabRequests, icon: <FlaskConical className="w-6 h-6" />, color: "bg-purple-50 text-purple-600" },
          { title: "Pending Prescriptions", value: data?.pendingPrescriptions, icon: <Pill className="w-6 h-6" />, color: "bg-orange-50 text-orange-600" },
        ].map((s) => <motion.div key={s.title} variants={item}><StatCard {...s} /></motion.div>)}
      </motion.div>
      <DoctorWorkflow />
    </div>
  );
}

// ── NURSE ────────────────────────────────────────────────────────────────────
export function NurseDashboard() {
  const { data, isLoading, error } = useQuery({ queryKey: ["stats"], queryFn: fetchStats });
  if (isLoading) return <DashboardSkeleton count={2} />;
  if (error) return <DashboardError message="Failed to load nurse dashboard" />;

  return (
    <div className="space-y-6">
      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { title: "Waiting for Triage", value: data?.waitingPatients, icon: <Clock className="w-6 h-6" />, color: "bg-yellow-50 text-yellow-600" },
          { title: "Admitted Patients", value: data?.admittedPatients, icon: <Heart className="w-6 h-6" />, color: "bg-red-50 text-red-600" },
        ].map((s) => <motion.div key={s.title} variants={item}><StatCard {...s} /></motion.div>)}
      </motion.div>
      <NurseWorkflow />
    </div>
  );
}

// ── LAB TECHNICIAN ───────────────────────────────────────────────────────────
export function LabTechDashboard() {
  const { data, isLoading, error } = useQuery({ queryKey: ["stats"], queryFn: fetchStats });
  if (isLoading) return <DashboardSkeleton count={2} />;
  if (error) return <DashboardError message="Failed to load lab dashboard" />;

  return (
    <div className="space-y-6">
      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { title: "Pending Requests", value: data?.pendingRequests, icon: <AlertCircle className="w-6 h-6" />, color: "bg-yellow-50 text-yellow-600" },
          { title: "Completed Today", value: data?.completedToday, icon: <CheckCircle className="w-6 h-6" />, color: "bg-green-50 text-green-600" },
        ].map((s) => <motion.div key={s.title} variants={item}><StatCard {...s} /></motion.div>)}
      </motion.div>
      <LabWorkflow />
    </div>
  );
}

// ── PHARMACIST ───────────────────────────────────────────────────────────────
export function PharmacistDashboard() {
  const { data, isLoading, error } = useQuery({ queryKey: ["stats"], queryFn: fetchStats });
  if (isLoading) return <DashboardSkeleton count={2} />;
  if (error) return <DashboardError message="Failed to load pharmacist dashboard" />;

  return (
    <div className="space-y-6">
      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { title: "Pending Prescriptions", value: data?.pendingPrescriptions, icon: <Pill className="w-6 h-6" />, color: "bg-orange-50 text-orange-600" },
          { title: "Dispensed Today", value: data?.dispensedToday, icon: <CheckCircle className="w-6 h-6" />, color: "bg-green-50 text-green-600" },
        ].map((s) => <motion.div key={s.title} variants={item}><StatCard {...s} /></motion.div>)}
      </motion.div>
      <PharmacistWorkflow />
    </div>
  );
}

// ── ACCOUNTANT ───────────────────────────────────────────────────────────────
export function AccountantDashboard() {
  const { data, isLoading, error } = useQuery({ queryKey: ["stats"], queryFn: fetchStats });
  if (isLoading) return <DashboardSkeleton count={3} />;
  if (error) return <DashboardError message="Failed to load accountant dashboard" />;

  return (
    <div className="space-y-6">
      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { title: "Unpaid Bills", value: data?.unpaidBills, icon: <AlertCircle className="w-6 h-6" />, color: "bg-red-50 text-red-600" },
          { title: "Payments Today", value: data?.paidToday, icon: <CheckCircle className="w-6 h-6" />, color: "bg-green-50 text-green-600" },
          { title: "Total Revenue", value: formatCurrency(data?.totalRevenue), icon: <DollarSign className="w-6 h-6" />, color: "bg-emerald-50 text-emerald-600" },
        ].map((s) => <motion.div key={s.title} variants={item}><StatCard {...s} /></motion.div>)}
      </motion.div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <QuickAction href="/dashboard/billing" icon={<Receipt className="w-6 h-6" />} title="Create Bill" desc="Generate invoice" color="from-blue-600 to-indigo-600" />
        <QuickAction href="/dashboard/billing" icon={<DollarSign className="w-6 h-6" />} title="Record Payment" desc="Process payment" color="from-green-600 to-emerald-600" />
      </div>
      <Section title="Recent Bills" href="/dashboard/billing">
        <div className="divide-y divide-gray-50">
          {data?.recentBills?.map((bill: any) => (
            <div key={bill.id} className="px-6 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{bill.patient?.name}</p>
                <p className="text-xs text-gray-500">Total: {formatCurrency(bill.total)} · Paid: {formatCurrency(bill.payments?.reduce((s: number, p: any) => s + p.amount, 0) ?? 0)}</p>
              </div>
              <StatusBadge status={bill.status} />
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

// ── PATIENT ──────────────────────────────────────────────────────────────────
export function PatientDashboard() {
  const { data, isLoading, error } = useQuery({ queryKey: ["stats"], queryFn: fetchStats });
  if (isLoading) return <DashboardSkeleton count={3} />;
  if (error) return <DashboardError message="Failed to load patient dashboard" />;

  return (
    <div className="space-y-6">
      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { title: "My Appointments", value: data?.myAppointments, icon: <Calendar className="w-6 h-6" />, color: "bg-blue-50 text-blue-600" },
          { title: "Unpaid Bills", value: data?.unpaidBills, icon: <Receipt className="w-6 h-6" />, color: "bg-red-50 text-red-600" },
          { title: "Unread Messages", value: data?.unreadMessages, icon: <Activity className="w-6 h-6" />, color: "bg-purple-50 text-purple-600" },
        ].map((s) => <motion.div key={s.title} variants={item}><StatCard {...s} /></motion.div>)}
      </motion.div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <QuickAction href="/dashboard/doctors" icon={<UserCheck className="w-6 h-6" />} title="Find a Doctor" desc="Browse specialists" color="from-blue-600 to-blue-700" />
        <QuickAction href="/dashboard/messages" icon={<Activity className="w-6 h-6" />} title="Message Doctor" desc="Ask questions" color="from-purple-600 to-indigo-600" />
      </div>
    </div>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function QuickAction({ href, icon, title, desc, color }: { href: string; icon: React.ReactNode; title: string; desc: string; color: string }) {
  return (
    <Link href={href}>
      <motion.div whileHover={{ y: -3 }} className={`bg-gradient-to-br ${color} rounded-2xl p-6 text-white cursor-pointer shadow-lg`}>
        <div className="opacity-80 mb-3">{icon}</div>
        <h3 className="font-bold text-lg">{title}</h3>
        <p className="text-white/70 text-sm mt-1">{desc}</p>
        <div className="flex items-center gap-1 mt-4 text-sm font-medium">Go <ArrowRight className="w-4 h-4" /></div>
      </motion.div>
    </Link>
  );
}

function AppointmentTable({ rows, showPatient, showDoctor }: { rows: any[]; showPatient?: boolean; showDoctor?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            {showPatient && <th className="table-header">Patient</th>}
            {showDoctor && <th className="table-header">Doctor</th>}
            <th className="table-header">Date & Time</th>
            <th className="table-header">Type</th>
            <th className="table-header">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.length === 0 && (
            <tr><td colSpan={5} className="table-cell text-center text-gray-400 py-8">No appointments</td></tr>
          )}
          {rows.map((apt: any) => (
            <tr key={apt.id} className="hover:bg-gray-50">
              {showPatient && <td className="table-cell font-medium">{apt.patient?.name ?? "—"}</td>}
              {showDoctor && <td className="table-cell text-gray-600">Dr. {apt.doctor?.user?.name ?? "—"}</td>}
              <td className="table-cell text-gray-500">{formatDateTime(apt.scheduledAt)}</td>
              <td className="table-cell text-gray-500">{apt.type ?? "—"}</td>
              <td className="table-cell"><StatusBadge status={apt.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DashboardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="h-28 bg-gray-100 rounded-xl" />
        ))}
      </div>
      <div className="h-64 bg-gray-100 rounded-xl" />
    </div>
  );
}

function DashboardError({ message }: { message: string }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
      <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
      <h3 className="text-red-800 font-semibold text-lg">Something went wrong</h3>
      <p className="text-red-600 mt-1">{message}</p>
      <button
        onClick={() => window.location.reload()}
        className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}