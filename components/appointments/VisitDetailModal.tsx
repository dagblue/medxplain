"use client";

import { useQuery } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatDateTime } from "@/lib/utils";
import { Phone, AlertTriangle, Droplets, FlaskConical, Stethoscope, Heart, Printer } from "lucide-react";

interface Visit {
  id: string;
  [key: string]: any;
}

function printVisit(v: any) {
  const win = window.open("", "_blank", "width=800,height=900");
  if (!win) return;

  const row = (label: string, value: string) =>
    value ? `<tr><td class="lbl">${label}</td><td class="val">${value}</td></tr>` : "";

  const section = (title: string, content: string) => `
    <div class="section">
      <div class="section-title">${title}</div>
      ${content}
    </div>`;

  const vitalsHtml = v.vitals ? section("Vitals", `
    <table class="info-table">
      ${row("Blood Pressure", v.vitals.bloodPressure ?? "")}
      ${row("Heart Rate", v.vitals.heartRate ? v.vitals.heartRate + " bpm" : "")}
      ${row("Temperature", v.vitals.temperature ? v.vitals.temperature + " °C" : "")}
      ${row("O₂ Saturation", v.vitals.oxygenSat ? v.vitals.oxygenSat + "%" : "")}
      ${row("Weight", v.vitals.weight ? v.vitals.weight + " kg" : "")}
      ${row("Height", v.vitals.height ? v.vitals.height + " cm" : "")}
      ${row("Notes", v.vitals.notes ?? "")}
    </table>`) : "";

  const labHtml = v.labRequests?.length > 0 ? section("Lab Requests", v.labRequests.map((r: any) => `
    <div class="card">
      <div class="card-header">
        <span>${r.testName} (${r.testType})</span>
        <span class="badge">${r.status}</span>
      </div>
      ${r.urgency !== "ROUTINE" ? `<p class="urgent">⚠ Urgency: ${r.urgency}</p>` : ""}
      ${r.labResult ? `
        <p><b>Result:</b> ${r.labResult.result}</p>
        ${r.labResult.normalRange ? `<p><b>Normal Range:</b> ${r.labResult.normalRange}</p>` : ""}
        ${r.labResult.interpretation ? `<p><b>Interpretation:</b> ${r.labResult.interpretation}</p>` : ""}
      ` : '<p class="muted">Awaiting result</p>'}
    </div>`).join("")) : "";

  const rxHtml = v.prescriptions?.length > 0 ? section("Prescriptions", v.prescriptions.map((rx: any) => `
    <div class="card">
      <div class="card-header">
        <span>Rx Code: <b>${rx.code}</b></span>
        <span class="badge">${rx.status}</span>
      </div>
      <p class="muted">Prescribed by Dr. ${rx.doctor?.user?.name ?? "—"}</p>
      ${rx.medicines?.map((m: any) => `
        <div class="medicine">
          <b>${m.name}</b> — ${m.dosage} · ${m.frequency} · ${m.duration}
          ${m.instructions ? `<br><span class="muted">${m.instructions}</span>` : ""}
        </div>`).join("") ?? ""}
    </div>`).join("")) : "";

  const diagnosisHtml = v.medicalRecord ? section("Consultation / Diagnosis", `
    <table class="info-table">
      ${row("Diagnosis", v.medicalRecord.diagnosis)}
      ${row("Symptoms", v.medicalRecord.symptoms ?? "")}
      ${row("Treatment", v.medicalRecord.treatment ?? "")}
      ${row("Notes", v.medicalRecord.notes ?? "")}
      ${v.medicalRecord.admitPatient ? row("Admission", "Patient admitted to hospital") : ""}
    </table>`) : "";

  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Visit Report — ${v.patient?.name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 13px; color: #111; padding: 24px 32px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1d4ed8; padding-bottom: 12px; margin-bottom: 20px; }
    .hospital-name { font-size: 22px; font-weight: 900; color: #1d4ed8; letter-spacing: 1px; }
    .hospital-sub { font-size: 11px; color: #6b7280; margin-top: 2px; }
    .report-title { text-align: right; }
    .report-title h2 { font-size: 16px; font-weight: 700; color: #111; }
    .report-title p { font-size: 11px; color: #6b7280; margin-top: 2px; }
    .queue-badge { display: inline-block; background: #1d4ed8; color: #fff; font-size: 28px; font-weight: 900; padding: 6px 20px; border-radius: 12px; margin-bottom: 16px; }
    .patient-card { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 14px 16px; margin-bottom: 20px; }
    .patient-name { font-size: 18px; font-weight: 800; color: #1e3a8a; }
    .patient-meta { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 6px; font-size: 12px; color: #374151; }
    .allergy-box { margin-top: 8px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 6px 10px; font-size: 12px; color: #b91c1c; font-weight: 600; }
    .section { margin-bottom: 18px; }
    .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #6b7280; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; margin-bottom: 10px; }
    .info-table { width: 100%; border-collapse: collapse; }
    .info-table .lbl { width: 38%; font-size: 12px; color: #6b7280; padding: 4px 0; vertical-align: top; }
    .info-table .val { font-size: 13px; font-weight: 600; color: #111; padding: 4px 0; }
    .staff-row { display: flex; gap: 16px; flex-wrap: wrap; }
    .staff-chip { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 8px 12px; min-width: 160px; }
    .staff-chip.doctor { background: #eff6ff; border-color: #bfdbfe; }
    .staff-chip .role { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #16a34a; letter-spacing: 0.5px; }
    .staff-chip.doctor .role { color: #1d4ed8; }
    .staff-chip .name { font-size: 14px; font-weight: 700; color: #111; margin-top: 2px; }
    .staff-chip .dept { font-size: 11px; color: #6b7280; }
    .card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; }
    .card-header { display: flex; justify-content: space-between; align-items: center; font-weight: 600; margin-bottom: 4px; }
    .badge { font-size: 10px; font-weight: 700; background: #e0e7ff; color: #3730a3; padding: 2px 8px; border-radius: 20px; }
    .urgent { color: #b45309; font-size: 12px; margin-bottom: 4px; }
    .muted { color: #6b7280; font-size: 12px; }
    .medicine { padding: 4px 0; border-top: 1px dashed #e5e7eb; margin-top: 4px; font-size: 12px; }
    .footer { margin-top: 28px; border-top: 1px solid #e5e7eb; padding-top: 10px; display: flex; justify-content: space-between; font-size: 11px; color: #9ca3af; }
    @media print { body { padding: 12px 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="hospital-name">MedXplain</div>
      <div class="hospital-sub">Hospital Management System</div>
    </div>
    <div class="report-title">
      <h2>Visit Report</h2>
      <p>Printed: ${new Date().toLocaleString()}</p>
    </div>
  </div>

  <div class="queue-badge">Queue #${v.queueNumber ?? "—"}</div>

  <div class="patient-card">
    <div class="patient-name">${v.patient?.name ?? "—"}</div>
    <div class="patient-meta">
      <span>ID (FAN): <b>${v.patient?.id ?? "—"}</b></span>
      <span>Gender: <b>${v.patient?.gender ?? "—"}</b></span>
      ${v.patient?.dateOfBirth ? `<span>DOB: <b>${new Date(v.patient.dateOfBirth).toLocaleDateString()}</b></span>` : ""}
      ${v.patient?.bloodGroup ? `<span>Blood Group: <b>${v.patient.bloodGroup}</b></span>` : ""}
      <span>Phone: <b>${v.patient?.phone ?? "—"}</b></span>
      ${v.patient?.email ? `<span>Email: <b>${v.patient.email}</b></span>` : ""}
      ${v.patient?.nationality ? `<span>Nationality: <b>${v.patient.nationality}</b></span>` : ""}
      ${v.patient?.address ? `<span>Address: <b>${[v.patient.address, v.patient.city, v.patient.region].filter(Boolean).join(", ")}</b></span>` : ""}
      ${v.patient?.insuranceProvider ? `<span>Insurance: <b>${v.patient.insuranceProvider}${v.patient.insurancePolicyNo ? " · " + v.patient.insurancePolicyNo : ""}</b></span>` : ""}
      ${v.patient?.emergencyContact ? `<span>Emergency Contact: <b>${v.patient.emergencyContact}</b></span>` : ""}
    </div>
    ${v.patient?.allergies ? `<div class="allergy-box">⚠ Allergies: ${v.patient.allergies}</div>` : ""}
    ${v.patient?.chronicConditions ? `<div class="allergy-box" style="background:#fffbeb;border-color:#fde68a;color:#92400e;">Chronic Conditions: ${v.patient.chronicConditions}</div>` : ""}
  </div>

  ${section("Visit Information", `
    <table class="info-table">
      ${row("Visit Type", v.visitType === "WALK_IN" ? "Walk-in" : "Online Booking")}
      ${row("Status", v.status.replace(/_/g, " "))}
      ${row("Chief Complaint", v.chiefComplaint ?? "—")}
      ${row("Arrived", formatDateTime(v.createdAt))}
      ${v.completedAt ? row("Completed", formatDateTime(v.completedAt)) : ""}
      ${row("Created By", v.createdBy?.name ?? "—")}
    </table>`)}

  ${(v.nurse || v.doctor) ? section("Assigned Staff", `
    <div class="staff-row">
      ${v.nurse ? `<div class="staff-chip"><div class="role">Nurse</div><div class="name">${v.nurse.user.name}</div>${v.nurse.ward ? `<div class="dept">Ward: ${v.nurse.ward}</div>` : ""}</div>` : ""}
      ${v.doctor ? `<div class="staff-chip doctor"><div class="role">Doctor</div><div class="name">Dr. ${v.doctor.user.name}</div>${v.doctor.specialization ? `<div class="dept">${v.doctor.specialization}</div>` : ""}${v.doctor.department ? `<div class="dept">${v.doctor.department.name}</div>` : ""}</div>` : ""}
    </div>`) : ""}

  ${v.triageNotes ? section("Triage Notes", `<p style="font-size:13px;color:#374151;">${v.triageNotes}</p>`) : ""}
  ${vitalsHtml}
  ${diagnosisHtml}
  ${labHtml}
  ${rxHtml}

  <div class="footer">
    <span>MedXplain Hospital Management System</span>
    <span>Patient ID: ${v.patient?.id ?? "—"} · Visit ID: ${v.id}</span>
  </div>
</body>
</html>`);

  win.document.close();
  win.focus();
  win.print();
  win.close();
}

export function VisitDetailModal({
  visit,
  open,
  onClose,
}: {
  visit: Visit | null;
  open: boolean;
  onClose: () => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["visit-detail", visit?.id],
    queryFn: async () => {
      const res = await fetch(`/api/visits/${visit!.id}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: open && !!visit?.id,
  });

  const v = data?.visit;

  return (
    <Modal open={open} onClose={onClose} title="Visit Details" size="xl">
      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-12 bg-gray-100 rounded-xl" />)}
        </div>
      ) : v ? (
        <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">

          {/* Patient header */}
          <div className="flex items-start gap-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg flex-shrink-0">
              {v.patient.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-gray-900">{v.patient.name}</h3>
                <StatusBadge status={v.status} />
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  Queue #{v.queueNumber ?? "—"}
                </span>
              </div>
              <div className="flex flex-wrap gap-3 mt-1 text-sm text-gray-600">
                <span>{v.patient.gender}</span>
                {v.patient.bloodGroup && (
                  <span className="flex items-center gap-1">
                    <Droplets className="w-3.5 h-3.5 text-red-500" />{v.patient.bloodGroup}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" />{v.patient.phone}
                </span>
              </div>
              {v.patient.allergies && (
                <p className="text-xs text-red-600 flex items-center gap-1 mt-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Allergies: {v.patient.allergies}
                </p>
              )}
            </div>
            <Button
              size="sm"
              variant="secondary"
              icon={<Printer className="w-4 h-4" />}
              onClick={() => printVisit(v)}
            >
              Print
            </Button>
          </div>

          {/* Visit info */}
          <div className="grid grid-cols-2 gap-3">
            {[
              ["Visit Type", v.visitType.replace("_", " ")],
              ["Source", v.visitType === "ONLINE" ? "Online Booking" : "Walk-in"],
              ["Created", formatDateTime(v.createdAt)],
              ["Chief Complaint", v.chiefComplaint || "—"],
            ].map(([label, value]) => (
              <div key={label} className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500">{label}</p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">{value}</p>
              </div>
            ))}
          </div>

          {/* Assigned staff */}
          {(v.nurse || v.doctor) && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Assigned Staff</p>
              <div className="flex gap-3 flex-wrap">
                {v.nurse && (
                  <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-xl px-3 py-2">
                    <Heart className="w-4 h-4 text-green-600" />
                    <div>
                      <p className="text-xs text-green-600 font-semibold">Nurse</p>
                      <p className="text-sm font-bold text-gray-900">{v.nurse.user.name}</p>
                    </div>
                  </div>
                )}
                {v.doctor && (
                  <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
                    <Stethoscope className="w-4 h-4 text-blue-600" />
                    <div>
                      <p className="text-xs text-blue-600 font-semibold">Doctor</p>
                      <p className="text-sm font-bold text-gray-900">Dr. {v.doctor.user.name}</p>
                      {v.doctor.department && <p className="text-xs text-gray-500">{v.doctor.department.name}</p>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Vitals */}
          {v.vitals && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Vitals</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  ["BP", v.vitals.bloodPressure],
                  ["HR", v.vitals.heartRate],
                  ["Temp", v.vitals.temperature],
                  ["O₂ Sat", v.vitals.oxygenSat],
                  ["Weight", v.vitals.weight],
                  ["Height", v.vitals.height],
                ].filter(([, val]) => val).map(([label, val]) => (
                  <div key={label} className="bg-gray-50 rounded-lg p-2 text-center">
                    <p className="text-xs text-gray-500">{label}</p>
                    <p className="text-sm font-bold text-gray-900">{val}</p>
                  </div>
                ))}
              </div>
              {v.vitals.notes && <p className="text-xs text-gray-500 mt-2 italic">"{v.vitals.notes}"</p>}
            </div>
          )}

          {/* Triage notes */}
          {v.triageNotes && (
            <div className="p-3 bg-yellow-50 rounded-xl border border-yellow-100">
              <p className="text-xs font-semibold text-yellow-700 mb-1">Triage Notes</p>
              <p className="text-sm text-gray-700">{v.triageNotes}</p>
            </div>
          )}

          {/* Lab requests */}
          {v.labRequests?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                <FlaskConical className="w-3.5 h-3.5" /> Lab Requests
              </p>
              <div className="space-y-2">
                {v.labRequests.map((r: any) => (
                  <div key={r.id} className="p-3 bg-cyan-50 rounded-xl border border-cyan-100">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-900">{r.testName} <span className="text-gray-400 font-normal">({r.testType})</span></p>
                      <StatusBadge status={r.status} />
                    </div>
                    {r.labResult && (
                      <div className="mt-2 space-y-0.5">
                        <p className="text-xs text-gray-700">Result: {r.labResult.result}</p>
                        {r.labResult.normalRange && <p className="text-xs text-gray-500">Normal: {r.labResult.normalRange}</p>}
                        {r.labResult.interpretation && <p className="text-xs text-blue-700">{r.labResult.interpretation}</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Medical record */}
          {v.medicalRecord && (
            <div className="p-3 bg-green-50 rounded-xl border border-green-100 space-y-1">
              <p className="text-xs font-semibold text-green-700">Consultation Record</p>
              <p className="text-sm font-bold text-gray-900">{v.medicalRecord.diagnosis}</p>
              {v.medicalRecord.symptoms && <p className="text-xs text-gray-600">Symptoms: {v.medicalRecord.symptoms}</p>}
              {v.medicalRecord.treatment && <p className="text-xs text-gray-600">Treatment: {v.medicalRecord.treatment}</p>}
              {v.medicalRecord.notes && <p className="text-xs text-gray-500 italic">"{v.medicalRecord.notes}"</p>}
            </div>
          )}

        </div>
      ) : (
        <p className="text-gray-400 text-center py-8">Visit not found</p>
      )}
    </Modal>
  );
}
