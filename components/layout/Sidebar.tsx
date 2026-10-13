"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Users, Stethoscope, Calendar, Building2,
  FlaskConical, FileText, ChevronLeft, ChevronRight, Activity,
  MessageCircle, UserCog, Heart, Pill, Receipt, UserCheck, UserCircle,
  ClipboardList, Sparkles,
} from "lucide-react";
import { cn, ROLE_COLORS, type Role } from "@/lib/utils";

const NAV: Record<string, { href: string; label: string; icon: any }[]> = {
  ADMIN: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/visits", label: "Visit Queue", icon: ClipboardList },
    { href: "/dashboard/users", label: "Users", icon: UserCog },
    { href: "/dashboard/patients", label: "Patients", icon: UserCheck },
    { href: "/dashboard/appointments", label: "Appointments", icon: Calendar },
    { href: "/dashboard/medical-records", label: "Medical Records", icon: FileText },
    { href: "/dashboard/lab-requests", label: "Lab Requests", icon: FlaskConical },
    { href: "/dashboard/prescriptions", label: "Prescriptions", icon: Pill },
    { href: "/dashboard/billing", label: "Billing", icon: Receipt },
    { href: "/dashboard/departments", label: "Departments", icon: Building2 },
    { href: "/dashboard/ai", label: "AI Analysis", icon: Sparkles },
    { href: "/dashboard/messages", label: "Messages", icon: MessageCircle },
  ],
  RECEPTIONIST: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/visits", label: "Visit Queue", icon: ClipboardList },
    { href: "/dashboard/patients", label: "Patients", icon: UserCheck },
    { href: "/dashboard/appointments", label: "Appointments", icon: Calendar },
    { href: "/dashboard/ai", label: "AI Scanner", icon: Sparkles },
    { href: "/dashboard/messages", label: "Messages", icon: MessageCircle },
  ],
  DOCTOR: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/visits", label: "Visit Queue", icon: ClipboardList },
    { href: "/dashboard/appointments", label: "Appointments", icon: Calendar },
    { href: "/dashboard/patients", label: "Patients", icon: UserCheck },
    { href: "/dashboard/medical-records", label: "Medical Records", icon: FileText },
    { href: "/dashboard/lab-requests", label: "Lab Requests", icon: FlaskConical },
    { href: "/dashboard/prescriptions", label: "Prescriptions", icon: Pill },
    { href: "/dashboard/ai", label: "AI Analysis", icon: Sparkles },
    { href: "/dashboard/messages", label: "Messages", icon: MessageCircle },
  ],
  NURSE: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/visits", label: "Visit Queue", icon: ClipboardList },
    { href: "/dashboard/patients", label: "Patients", icon: UserCheck },
    { href: "/dashboard/vitals", label: "Vitals", icon: Heart },
    { href: "/dashboard/ai", label: "AI Triage", icon: Sparkles },
    { href: "/dashboard/messages", label: "Messages", icon: MessageCircle },
  ],
  LAB_TECHNICIAN: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/lab-requests", label: "Lab Requests", icon: FlaskConical },
    { href: "/dashboard/ai", label: "AI Summary", icon: Sparkles },
    { href: "/dashboard/messages", label: "Messages", icon: MessageCircle },
  ],
  PHARMACIST: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/prescriptions", label: "Prescriptions", icon: Pill },
    { href: "/dashboard/ai", label: "AI Checker", icon: Sparkles },
    { href: "/dashboard/messages", label: "Messages", icon: MessageCircle },
  ],
  ACCOUNTANT: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/billing", label: "Billing", icon: Receipt },
    { href: "/dashboard/patients", label: "Patients", icon: UserCheck },
    { href: "/dashboard/ai", label: "AI Extractor", icon: Sparkles },
    { href: "/dashboard/messages", label: "Messages", icon: MessageCircle },
  ],
  PATIENT: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/visits/book", label: "Book a Visit", icon: ClipboardList },
    { href: "/dashboard/appointments", label: "My Appointments", icon: Calendar },
    { href: "/dashboard/doctors", label: "Find Doctors", icon: Stethoscope },
    { href: "/dashboard/billing", label: "My Bills", icon: Receipt },
    { href: "/dashboard/messages", label: "Messages", icon: MessageCircle },
  ],
};

export function Sidebar({ userRole }: { userRole: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const items = NAV[userRole] ?? NAV.PATIENT;
  const roleColor = ROLE_COLORS[userRole as Role] ?? "bg-gray-100 text-gray-700";

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 248 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="relative flex flex-col bg-white border-r border-gray-100 shadow-sm h-screen sticky top-0 overflow-hidden flex-shrink-0"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-100">
        <div className="flex-shrink-0 w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
          <Activity className="w-5 h-5 text-white" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="font-bold text-gray-900 text-lg whitespace-nowrap">
              MedXplain
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Role badge */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-4 py-2.5">
            <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full", roleColor)}>
              {userRole.replace("_", " ")}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {items.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}>
              <motion.div whileHover={{ x: 2 }}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors duration-150 cursor-pointer relative",
                  isActive ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <item.icon className={cn("w-5 h-5 flex-shrink-0", isActive ? "text-blue-600" : "text-gray-400")} />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className={cn("text-sm font-medium whitespace-nowrap", isActive ? "text-blue-700" : "")}>
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
                {isActive && <motion.div layoutId="activeBar" className="absolute right-0 w-1 h-7 bg-blue-600 rounded-l-full" />}
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {/* Profile link — pinned at bottom */}
      <div className="px-3 py-3 border-t border-gray-100">
        {(() => {
          const isActive = pathname === "/dashboard/profile";
          return (
            <Link href="/dashboard/profile">
              <motion.div whileHover={{ x: 2 }}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors duration-150 cursor-pointer relative",
                  isActive ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <UserCircle className={cn("w-5 h-5 flex-shrink-0", isActive ? "text-blue-600" : "text-gray-400")} />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className={cn("text-sm font-medium whitespace-nowrap", isActive ? "text-blue-700" : "")}>
                      My Profile
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
            </Link>
          );
        })()}
      </div>

      {/* Collapse toggle */}
      <button onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm hover:bg-gray-50 z-10">
        {collapsed ? <ChevronRight className="w-3 h-3 text-gray-500" /> : <ChevronLeft className="w-3 h-3 text-gray-500" />}
      </button>
    </motion.aside>
  );
}
