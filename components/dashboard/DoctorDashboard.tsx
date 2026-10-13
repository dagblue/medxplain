"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { StatCard } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { Calendar, Clock, Users, MessageCircle } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import Link from "next/link";

async function fetchStats() {
  const res = await fetch("/api/dashboard/stats");
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

async function fetchTodayAppointments() {
  const res = await fetch("/api/appointments?today=true&limit=20");
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

export function DoctorDashboard() {
  const { data: stats } = useQuery({ queryKey: ["dashboard-stats"], queryFn: fetchStats });
  const { data: appts, isLoading } = useQuery({ queryKey: ["today-appointments"], queryFn: fetchTodayAppointments });

  return (
    <div className="space-y-6">
      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div variants={item}>
          <StatCard title="Today's Appointments" value={stats?.todayAppointments ?? 0} icon={<Calendar className="w-6 h-6" />} color="bg-blue-50 text-blue-600" />
        </motion.div>
        <motion.div variants={item}>
          <StatCard title="Total Patients" value={stats?.totalPatients ?? 0} icon={<Users className="w-6 h-6" />} color="bg-green-50 text-green-600" />
        </motion.div>
        <motion.div variants={item}>
          <StatCard title="Pending" value={stats?.pendingAppointments ?? 0} icon={<Clock className="w-6 h-6" />} color="bg-yellow-50 text-yellow-600" />
        </motion.div>
        <motion.div variants={item}>
          <StatCard title="Unread Messages" value={stats?.unreadMessages ?? 0} icon={<MessageCircle className="w-6 h-6" />} color="bg-purple-50 text-purple-600" />
        </motion.div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-white rounded-xl shadow-card border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary-600" />
            <h2 className="font-semibold text-gray-900">Today's Schedule</h2>
          </div>
          <Link href="/dashboard/appointments" className="text-sm text-blue-600 hover:underline font-medium">
            View all
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-header">Patient</th>
                <th className="table-header">Time</th>
                <th className="table-header">Notes</th>
                <th className="table-header">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading && (
                <tr><td colSpan={4} className="table-cell text-center text-gray-400 py-8">Loading...</td></tr>
              )}
              {!isLoading && !appts?.appointments?.length && (
                <tr><td colSpan={4} className="table-cell text-center text-gray-400 py-8">No appointments today</td></tr>
              )}
              {appts?.appointments?.map((apt: any) => (
                <tr key={apt.id} className="hover:bg-gray-50">
                  <td className="table-cell font-medium">{apt.user?.name}</td>
                  <td className="table-cell text-gray-500">{formatDateTime(apt.date)}</td>
                  <td className="table-cell text-gray-500 max-w-xs truncate">{apt.notes || "—"}</td>
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
