"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Printer, X, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";

export interface TicketData {
  queueNumber: number;
  patientName: string;
  patientPhone: string;
  patientGender: string;
  chiefComplaint?: string;
  nurseName: string;
  departmentName?: string;
  ward?: string;
  visitType: string;
  createdAt: string;
}

function pad(n: number) {
  return String(n).padStart(3, "0");
}

function fmt(iso: string, mode: "date" | "time") {
  const d = new Date(iso);
  if (mode === "date") return d.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

// ─── Build the HTML string that gets printed in a new window ─────────────────
function buildPrintHTML(t: TicketData): string {
  const row = (label: string, value: string) =>
    `<tr><td class="label">${label}</td><td class="value">${value}</td></tr>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Queue Ticket #${pad(t.queueNumber)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Courier New', monospace; background: #fff; display: flex; justify-content: center; padding: 20px; }
    .ticket { width: 300px; border: 2px dashed #ccc; border-radius: 12px; padding: 20px; }
    .header { text-align: center; border-bottom: 1px solid #e5e7eb; padding-bottom: 14px; margin-bottom: 14px; }
    .logo { width: 44px; height: 44px; background: #2563eb; border-radius: 10px; margin: 0 auto 8px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 20px; font-weight: 900; line-height: 44px; text-align: center; }
    .hospital-name { font-size: 16px; font-weight: 900; letter-spacing: 2px; color: #111; }
    .hospital-sub { font-size: 10px; color: #9ca3af; margin-top: 2px; }
    .datetime { font-size: 10px; color: #d1d5db; margin-top: 4px; }
    .queue-box { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 10px; text-align: center; padding: 16px 0; margin-bottom: 14px; }
    .queue-label { font-size: 10px; font-weight: 700; color: #f97316; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 4px; }
    .queue-num { font-size: 64px; font-weight: 900; color: #ea580c; line-height: 1; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    td { padding: 3px 0; vertical-align: top; }
    td.label { color: #9ca3af; width: 80px; }
    td.value { font-weight: 700; color: #111; }
    .divider { border-top: 1px solid #e5e7eb; margin: 10px 0; }
    .footer { text-align: center; font-size: 10px; color: #d1d5db; margin-top: 12px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="ticket">
    <div class="header">
      <div class="logo">M</div>
      <div class="hospital-name">MEDXPLAIN</div>
      <div class="hospital-sub">Hospital Management System</div>
      <div class="datetime">${fmt(t.createdAt, "date")} &middot; ${fmt(t.createdAt, "time")}</div>
    </div>

    <div class="queue-box">
      <div class="queue-label">Queue Number</div>
      <div class="queue-num">${pad(t.queueNumber)}</div>
    </div>

    <table>
      ${row("Patient", t.patientName)}
      ${row("Phone", t.patientPhone)}
      ${row("Gender", t.patientGender)}
      ${t.chiefComplaint ? row("Complaint", t.chiefComplaint) : ""}
    </table>

    <div class="divider"></div>

    <table>
      ${row("Nurse", t.nurseName)}
      ${t.departmentName ? row("Department", t.departmentName) : ""}
      ${t.ward ? row("Ward", t.ward) : ""}
      ${row("Visit Type", t.visitType === "WALK_IN" ? "Walk-in" : "Online")}
    </table>

    <div class="footer">
      <p>Please keep this ticket and wait to be called</p>
      <p style="margin-top:6px">- - - - - - - - - - - - - - - - -</p>
    </div>
  </div>
</body>
</html>`;
}

// ─── Print in a new window ────────────────────────────────────────────────────
export function printTicket(ticket: TicketData) {
  const win = window.open("", "_blank", "width=400,height=600");
  if (!win) return;
  win.document.write(buildPrintHTML(ticket));
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
    win.close();
  }, 400);
}

// ─── Ticket preview (screen only) ────────────────────────────────────────────
function TicketPreview({ ticket }: { ticket: TicketData }) {
  return (
    <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-5 w-72 mx-auto space-y-3 font-mono text-xs">
      {/* Header */}
      <div className="text-center border-b border-gray-100 pb-3">
        <div className="w-10 h-10 bg-blue-600 rounded-xl mx-auto mb-1.5 flex items-center justify-center">
          <span className="text-white font-black text-base">M</span>
        </div>
        <p className="font-black text-gray-900 text-sm tracking-widest">MEDXPLAIN</p>
        <p className="text-gray-400 text-[10px]">Hospital Management System</p>
        <p className="text-gray-300 text-[10px] mt-0.5">{fmt(ticket.createdAt, "date")} · {fmt(ticket.createdAt, "time")}</p>
      </div>

      {/* Queue number */}
      <div className="text-center py-3 bg-orange-50 rounded-xl border border-orange-100">
        <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-1">Queue Number</p>
        <p className="text-5xl font-black text-orange-600 leading-none">{pad(ticket.queueNumber)}</p>
      </div>

      {/* Patient */}
      <div className="space-y-1">
        <InfoRow label="Patient" value={ticket.patientName} />
        <InfoRow label="Phone" value={ticket.patientPhone} />
        <InfoRow label="Gender" value={ticket.patientGender} />
        {ticket.chiefComplaint && <InfoRow label="Complaint" value={ticket.chiefComplaint} />}
      </div>

      {/* Assignment */}
      <div className="border-t border-gray-100 pt-2 space-y-1">
        <InfoRow label="Nurse" value={ticket.nurseName} />
        {ticket.departmentName && <InfoRow label="Department" value={ticket.departmentName} />}
        {ticket.ward && <InfoRow label="Ward" value={ticket.ward} />}
        <InfoRow label="Visit Type" value={ticket.visitType === "WALK_IN" ? "Walk-in" : "Online"} />
      </div>

      <div className="text-center border-t border-gray-100 pt-2">
        <p className="text-gray-300 text-[10px]">Please keep this ticket and wait to be called</p>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-gray-400 w-20 flex-shrink-0">{label}:</span>
      <span className="font-bold text-gray-900 flex-1 break-words">{value}</span>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
export function QueueTicketModal({
  ticket,
  onClose,
}: {
  ticket: TicketData | null;
  onClose: () => void;
}) {
  const autoPrinted = useRef(false);

  useEffect(() => {
    if (!ticket) { autoPrinted.current = false; return; }
    if (autoPrinted.current) return;
    autoPrinted.current = true;
    // slight delay so the modal renders first
    const t = setTimeout(() => printTicket(ticket), 500);
    return () => clearTimeout(t);
  }, [ticket]);

  return (
    <AnimatePresence>
      {ticket && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="bg-white rounded-3xl shadow-2xl overflow-hidden w-full max-w-sm"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <p className="font-bold text-gray-900">Nurse Assigned — Ticket Ready</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Preview */}
            <div className="p-5 bg-gray-50 flex justify-center">
              <TicketPreview ticket={ticket} />
            </div>

            {/* Actions */}
            <div className="flex gap-3 px-5 py-4 border-t border-gray-100">
              <Button variant="secondary" className="flex-1" onClick={onClose}>
                Close
              </Button>
              <Button
                className="flex-1"
                icon={<Printer className="w-4 h-4" />}
                onClick={() => printTicket(ticket)}
              >
                Print Ticket
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
