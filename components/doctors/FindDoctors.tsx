"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { SearchInput } from "@/components/ui/SearchInput";
import { Skeleton } from "@/components/ui/Skeleton";
import { Stethoscope, MessageCircle, Calendar, Building2 } from "lucide-react";

async function fetchDoctors(search: string) {
  const res = await fetch(`/api/doctors?search=${encodeURIComponent(search)}&limit=50`);
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

export function FindDoctors() {
  const [search, setSearch] = useState("");
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ["doctors", search],
    queryFn: () => fetchDoctors(search),
  });

  const handleMessage = (doctorUserId: string) => {
    router.push(`/dashboard/messages?with=${doctorUserId}`);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-gray-500 text-sm">Browse available doctors and book an appointment or send a message.</p>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by name or specialty..."
          className="w-72"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6 space-y-3">
              <div className="flex gap-3">
                <Skeleton className="w-14 h-14 rounded-2xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
              <Skeleton className="h-8 w-full" />
            </div>
          ))}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {data?.doctors?.length === 0 && (
            <div className="col-span-3 text-center py-16 text-gray-400">
              <Stethoscope className="w-10 h-10 mx-auto mb-2 text-gray-200" />
              No doctors found
            </div>
          )}
          {data?.doctors?.map((doctor: any, i: number) => {
            const initials = doctor.user.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
            return (
              <motion.div
                key={doctor.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ y: -4 }}
                className="bg-white rounded-2xl border border-gray-100 shadow-card hover:shadow-card-hover transition-shadow p-6"
              >
                {/* Avatar + name */}
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0 shadow-md shadow-blue-200">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-gray-900 truncate">Dr. {doctor.user.name}</h3>
                    <p className="text-sm text-blue-600 font-medium">{doctor.specialization}</p>
                    <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                      <Building2 className="w-3 h-3" />
                      {doctor.department?.name}
                    </div>
                  </div>
                </div>

                {doctor.availability && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-4 bg-gray-50 rounded-lg px-3 py-2">
                    <Calendar className="w-3.5 h-3.5 text-green-500" />
                    {doctor.availability}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleMessage(doctor.user.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 text-sm font-medium bg-blue-50 hover:bg-blue-100 text-blue-700 py-2 rounded-xl transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Message
                  </button>
                  <a
                    href="/dashboard/appointments"
                    className="flex-1 flex items-center justify-center gap-1.5 text-sm font-medium bg-gray-50 hover:bg-gray-100 text-gray-700 py-2 rounded-xl transition-colors"
                  >
                    <Calendar className="w-4 h-4" />
                    Book
                  </a>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
