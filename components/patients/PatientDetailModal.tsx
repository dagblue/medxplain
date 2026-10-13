"use client";

import { useQuery } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatDate, formatDateTime } from "@/lib/utils";
import { Phone, MapPin, AlertTriangle, Droplets } from "lucide-react";

export function PatientDetailModal({ open, onClose, patientId }: { open: boolean; onClose: () => void; patientId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["patient", patientId],
    queryFn: async () => { const res = await fetch(`/api/patients/${patientId}`); return res.json(); },
    enabled: open,
  });
  const p = data?.patient;

  return (
    <Modal open={open} onClose={onClose} title="Patient Record" size="xl">
      {isLoading ? <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-10" />)}</div> : p ? (
        <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
          {/* Header */}
          <div className="flex items-start gap-4 p-4 bg-blue-50 rounded-xl">
            <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
              {p.name.split(" ").map((n: string) => n[0]).join("").slice(0,2)}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-gray-900">{p.name}</h3>
                <StatusBadge status={p.status} />
              </div>
              <div className="flex flex-wrap gap-3 mt-1 text-sm text-gray-600">
                <span>{p.gender}</span>
                {p.dateOfBirth && <span>DOB: {formatDate(p.dateOfBirth)}</span>}
                {p.bloodGroup && <span className="flex items-center gap-1"><Droplets className="w-3.5 h-3.5 text-red-500" />{p.bloodGroup}</span>}
              </div>
              <div className="flex flex-wrap gap-3 mt-1 text-sm text-gray-500">
                <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{p.phone}</span>
                {p.address && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{p.address}</span>}
              </div>
              {p.allergies && <div className="flex items-center gap-1 mt-1 text-xs text-red-600 font-medium"><AlertTriangle className="w-3.5 h-3.5" />Allergies: {p.allergies}</div>}
            </div>
          </div>

          {/* Latest Vitals */}
          {p.vitals?.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Latest Vitals</h4>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "BP", value: p.vitals[0].bloodPressure },
                  { label: "HR", value: p.vitals[0].heartRate },
                  { label: "Temp", value: p.vitals[0].temperature },
                  { label: "O₂ Sat", value: p.vitals[0].oxygenSat },
                  { label: "Weight", value: p.vitals[0].weight },
                  { label: "Height", value: p.vitals[0].height },
                ].filter(v => v.value).map(v => (
                  <div key={v.label} className="bg-gray-50 rounded-lg p-2 text-center">
                    <p className="text-xs text-gray-500">{v.label}</p>
                    <p className="text-sm font-semibold text-gray-900">{v.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Medical Records */}
          {p.medicalRecords?.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Medical Records</h4>
              <div className="space-y-2">
                {p.medicalRecords.map((r: any) => (
                  <div key={r.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-semibold text-gray-900">{r.diagnosis}</p>
                      <p className="text-xs text-gray-400">{formatDate(r.createdAt)}</p>
                    </div>
                    <p className="text-xs text-gray-600">Dr. {r.doctor?.user?.name}</p>
                    {r.treatment && <p className="text-xs text-gray-500 mt-1">Treatment: {r.treatment}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Appointments */}
          {p.appointments?.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Appointments</h4>
              <div className="space-y-2">
                {p.appointments.map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium">Dr. {a.doctor?.user?.name}</p>
                      <p className="text-xs text-gray-500">{formatDateTime(a.scheduledAt)} · {a.type}</p>
                    </div>
                    <StatusBadge status={a.status} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lab Requests */}
          {p.labRequests?.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Lab Tests</h4>
              <div className="space-y-2">
                {p.labRequests.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium">{r.testName}</p>
                      {r.labResult && <p className="text-xs text-gray-600 mt-0.5">Result: {r.labResult.result}</p>}
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : <p className="text-gray-400 text-center py-8">Patient not found</p>}
    </Modal>
  );
}
