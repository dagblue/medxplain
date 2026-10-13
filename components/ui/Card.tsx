"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export function Card({ children, className, hover = false }: CardProps) {
  if (hover) {
    return (
      <motion.div
        whileHover={{ y: -2, boxShadow: "0 4px 12px rgba(37,99,235,0.12)" }}
        transition={{ duration: 0.2 }}
        className={cn("bg-white rounded-xl shadow-card border border-gray-100 p-6", className)}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <div className={cn("bg-white rounded-xl shadow-card border border-gray-100 p-6", className)}>
      {children}
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color?: string;
  change?: string;
}

export function StatCard({ title, value, icon, color = "bg-primary-50 text-primary-600", change }: StatCardProps) {
  return (
    <Card hover>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {change && <p className="text-xs text-green-600 mt-1">{change}</p>}
        </div>
        <div className={cn("p-3 rounded-xl", color)}>{icon}</div>
      </div>
    </Card>
  );
}
