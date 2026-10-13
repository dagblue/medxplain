"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { StatCard } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { Calendar, Clock, MessageCircle, Stethoscope, ArrowRight } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import Link from "next/link";

async function fetchStats() {
  const res = await fetch("/api/dashboard/stats");
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

async function fetchMyAppointments() {
  const res = await fetch("/api/appointments?limit=5");
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

export function PatientDashboard() {
  const { data: stats } = useQuery({ queryKey: ["dashboard-stats"], queryFn: fetchStats });
  const { data: appts, isLoading } = useQuery({ queryKey: ["my-appointments"], queryFn: fetchMyAppointments });

  return (
    <div className="space-y-6">
      {/* Stats */}
      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div variants={item}>
          <StatCard title="My Appointments" value={stats?.myAppointments ?? 0} icon={<Calendar className="w-6 h-6" />} color="bg-blue-50 text-blue-600" />
        </motion.div>
        <motion.div variants={item}>
          <StatCard title="Upcoming" value={stats?.upcomingAppointments ?? 0} icon={<Clock className="w-6 h-6" />} color="bg-green-50 text-green-600" />
        </motion.div>
        <motion.div variants={item}>
          <StatCard title="Unread Messages" value={stats?.unreadMessages ?? 0} icon={<MessageCircle className="w-6 h-6" />} color="bg-purple-50 text-purple-600" />
        </motion.div>
      </motion.div>

      {/* Quick actions */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/dashboard/appointments">
          <motion.div whileHover={{ y: -3 }} className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 text-white cursor-pointer shadow-lg shadow-blue-200">
            <Calendar className="w-8 h-8 mb-3 opacity-80" />
            <h3 className="font-bold text-lg">Book Appointment</h3>
            <p className="text-blue-200 text-sm mt-1">Schedule a visit with a doctor</p>
            <div className="flex items-center gap-1 mt-4 text-sm font-medium">
              Book now <ArrowRight className="w-4 h-4" />
            </div>
          </motion.div>
        </Link>
        <Link href="/dashboard/messages">
          <motion.div whileHover={{ y: -3 }} className="bg-gradient-to-br from-purple-600 to-indigo-600 rounded-2xl p-6 text-white cursor-pointer shadow-lg shadow-purple-200">
            <MessageCircle className="w-8 h-8 mb-3 opacity-80" />
            <h3 className="font-bold text-lg">Message a Doctor</h3>
            <p className="text-purple-200 text-sm mt-1">Ask questions, get advice</p>
            <div className="flex items-center gap-1 mt-4 text-sm font-medium">
              Open messages <ArrowRight className="w-4 h-4" />
            </div>
          </motion.div>
        </Link>
      </motion.div>

      {/* Recent appointments */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-white rounded-xl shadow-card border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-primary-600" />
            <h2 className="font-semibold text-gray-900">My Appointments</h2>
          </div>
          <Link href="/dashboard/appointments" className="text-sm text-blue-600 hover:underline font-medium">
            View all
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-header">Doctor</th>
                <th className="table-header">Date & Time</th>
                <th className="table-header">Notes</th>
                <th className="table-header">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading && (
                <tr><td colSpan={4} className="table-cell text-center text-gray-400 py-8">Loading...</td></tr>
              )}
              {!isLoading && appts?.appointments?.length === 0 && (
                <tr>
                  <td colSpan={4} className="table-cell text-center py-10">
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <Calendar className="w-8 h-8 text-gray-300" />
                      <p>No appointments yet</p>
                      <Link href="/dashboard/appointments" className="text-blue-600 text-sm font-medium hover:underline">
                        Book your first appointment →
                      </Link>
                    </div>
                  </td>
                </tr>
              )}
              {appts?.appointments?.map((apt: any) => (
                <tr key={apt.id} className="hover:bg-gray-50 transition-colors">
                  <td className="table-cell font-medium">Dr. {apt.doctor?.user?.name}</td>
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
