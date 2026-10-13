"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

/**
 * AvailabilityToggle
 * Shown in the dashboard for DOCTOR, NURSE, LAB_TECHNICIAN, PHARMACIST.
 * Lets staff mark themselves available or unavailable with one click.
 */
export function AvailabilityToggle() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["my-availability"],
    queryFn: async () => {
      const res = await fetch("/api/staff/availability");
      if (!res.ok) return { isAvailable: null };
      return res.json();
    },
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: async (isAvailable: boolean) => {
      const res = await fetch("/api/staff/availability", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAvailable }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Failed"); }
      return res.json();
    },
    onSuccess: (_, isAvailable) => {
      toast.success(isAvailable ? "You are now Available" : "You are now Unavailable");
      qc.invalidateQueries({ queryKey: ["my-availability"] });
      // Also refresh staff lists so receptionist sees updated status
      qc.invalidateQueries({ queryKey: ["nurses"] });
      qc.invalidateQueries({ queryKey: ["doctors-all"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // null means this user has no staff profile (e.g. ADMIN, RECEPTIONIST)
  if (isLoading || data?.isAvailable === null || data?.isAvailable === undefined) return null;

  const isAvailable = data.isAvailable as boolean;

  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={() => mutation.mutate(!isAvailable)}
      disabled={mutation.isPending}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 text-xs font-bold transition-all",
        isAvailable
          ? "bg-green-50 border-green-300 text-green-700 hover:bg-green-100"
          : "bg-red-50 border-red-300 text-red-700 hover:bg-red-100"
      )}
      title={isAvailable ? "Click to mark yourself Unavailable" : "Click to mark yourself Available"}
    >
      <span className={cn(
        "w-2 h-2 rounded-full flex-shrink-0",
        mutation.isPending ? "bg-gray-400 animate-pulse" :
        isAvailable ? "bg-green-500" : "bg-red-500"
      )} />
      <Activity className="w-3.5 h-3.5" />
      {mutation.isPending ? "Updating…" : isAvailable ? "Available" : "Unavailable"}
    </motion.button>
  );
}
