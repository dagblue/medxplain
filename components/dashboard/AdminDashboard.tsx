"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { StatCard } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import {
  Users, UserRound, Calendar, Building2,
  FlaskConical, Clock, Receipt, Stethoscope,
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";

async function fetchStats() {
  const res = await fetch("/api/dashboard/stats");
  if (!res.ok) throw new Error("Failed to fetch stats");
  return res.json();
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-3 w-24 bg-gray-200 rounded" />
          <div className="h-7 w-12 bg-gray-200 rounded" />
        </div>
        <div className="w-12 h-12 bg-gray-200 rounded-xl" />
      </div>
    </div>
  );
}

export function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: fetchStats,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  const stats = [
    { title: "Total Doctors",          value: data?.totalDoctors       ?? 0, icon: <Stethoscope className="w-6 h-6" />, color: "bg-blue-50 text-blue-600" },
    { title: "Total Nurses",           value: data?.totalNurses         ?? 0, icon: <UserRound className="w-6 h-6" />,   color: "bg-green-50 text-green-600" },
    { title: "Total Patients",         value: data?.totalPatients       ?? 0, icon: <Users className="w-6 h-6" />,       color: "bg-teal-50 text-teal-600" },
    { title: "Departments",            value: data?.totalDepartments    ?? 0, icon: <Building2 className="w-6 h-6" />,   color: "bg-pink-50 text-pink-600" },
    { title: "Today's Appointments",   value: data?.todayAppointments   ?? 0, icon: <Calendar className="w-6 h-6" />,    color: "bg-purple-50 text-purple-600" },
    { title: "Pending Lab Requests",   value: data?.pendingLabRequests  ?? 0, icon: <FlaskConical className="w-6 h-6" />,color: "bg-orange-50 text-orange-600" },
    { title: "Pending Prescriptions",  value: data?.pendingPrescriptions ?? 0, icon: <Clock className="w-6 h-6" />,     color: "bg-yellow-50 text-yellow-600" },
    { title: "Unpaid Bills",           value: data?.unpaidBills         ?? 0, icon: <Receipt className="w-6 h-6" />,     color: "bg-red-50 text-red-600" },
  ];

  return (
    <div className="space-y-6">
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {stats.map((stat) => (
          <motion.div key={stat.title} variants={item}>
            <StatCard {...stat} />
          </motion.div>
        ))}
      </motion.div>

      {/* Recent Appointments */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-white rounded-xl shadow-card border border-gray-100"
      >
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Recent Appointments</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-header">Patient</th>
                <th className="table-header">Doctor</th>
                <th className="table-header">Date</th>
                <th className="table-header">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {!data?.recentAppointments?.length && (
                <tr>
                  <td colSpan={4} className="table-cell text-center text-gray-400 py-8">
                    No appointments yet
                  </td>
                </tr>
              )}
              {data?.recentAppointments?.map((apt: any) => (
                <tr key={apt.id} className="hover:bg-gray-50 transition-colors">
                  <td className="table-cell font-medium">{apt.patient?.name ?? "—"}</td>
                  <td className="table-cell text-gray-500">Dr. {apt.doctor?.user?.name ?? "—"}</td>
                  <td className="table-cell text-gray-500">{formatDateTime(apt.scheduledAt)}</td>
                  <td className="table-cell"><StatusBadge status={apt.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
