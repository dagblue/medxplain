"use client";

import { motion } from "framer-motion";
import { Activity } from "lucide-react";

export function DefaultDashboard({ role }: { role: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center mb-4">
        <Activity className="w-8 h-8 text-primary-600" />
      </div>
      <h2 className="text-xl font-semibold text-gray-900">Welcome to MedXplain</h2>
      <p className="text-gray-500 mt-2">
        You are logged in as <span className="font-medium text-primary-600">{role}</span>
      </p>
      <p className="text-sm text-gray-400 mt-1">Use the sidebar to navigate to your modules.</p>
    </motion.div>
  );
}
