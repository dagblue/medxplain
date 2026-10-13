"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Printer, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatDateTime } from "@/lib/utils";

export interface TicketData {
  queueNumber: number | null;
  patientName: string;
  patientId: string;
  nurseName: string;
  chiefComplaint?: string;
  visitType: string;
  createdAt: string;
}

interface TriageTicketProps {
  ticket: TicketData | null;
  onClose: () => void;
}

export function TriageTicket({ ticket, onClose }: TriageTicketProps) {
  const printRef = useRef<HTMLDivElement>(null);

  // Auto-trigger print when ticket appears
  useEffect(() => {
    if (!ticket) return;
    const timer = setTimeout(() => handlePrint(), 400);
    return () => clearTimeout(timer);
  }, [ticket]);

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;

    const printWindow = window.open("", "_blank", "width=400,height=600");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Triage Ticket</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: 'Courier New', monospace;
              width: 80mm;
              padding: 8mm;
              font-size: 12px;
              color: #000;
            }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .divider { border-top: 1px dashed #000; margin: 6px 0; }
            .queue-number {
              font-size: 64px;
              font-weight: 900;
              text-align: center;
              line-height: 1;
              letter-spacing: -2px;
              margin: 8px 0;
            }
            .label { font-size: 10px; color: #555; text-transform: uppercase; letter-spacing: 0.5px; }
            .value { font-size: 13px; font-weight: bold; margin-bottom: 6px; }
            .hospital { font-size: 16px; font-weight: 900; text-align: center; letter-spacing: 1px; }
            .subtitle { font-size: 10px; text-align: center; color: #555; margin-bottom: 4px; }
            .footer { font-size: 9px; text-align: center; color: #888; margin-top: 8px; }
            @media print {
              body { width: 80mm; }
            }
          </style>
        </head>
        <body>
          <p class="hospital">MedXplain</p>
          <p class="subtitle">Hospital Management System</p>
          <div class="divider"></div>

          <p class="center bold" style="font-size:11px; margin-bottom:2px;">TRIAGE TICKET</p>
          <div class="queue-number">${ticket?.queueNumber ?? "—"}</div>
          <p class="center" style="font-size:10px; color:#555; margin-bottom:6px;">Queue Number</p>

          <div class="divider"></div>

          <p class="label">Patient Name</p>
          <p class="value">${ticket?.patientName}</p>

          <p class="label">Patient ID (FAN)</p>
          <p class="value">${ticket?.patientId}</p>

          <p class="label">Assigned Nurse</p>
          <p class="value">${ticket?.nurseName}</p>

          ${ticket?.chiefComplaint ? `
          <p class="label">Chief Complaint</p>
          <p class="value">${ticket.chiefComplaint}</p>
          ` : ""}

          <p class="label">Visit Type</p>
          <p class="value">${ticket?.visitType === "WALK_IN" ? "Walk-in" : "Online Booking"}</p>

          <div class="divider"></div>

          <p class="label">Date & Time</p>
          <p class="value">${ticket ? formatDateTime(ticket.createdAt) : ""}</p>

          <div class="divider"></div>
          <p class="footer">Please wait to be called by your assigned nurse.</p>
          <p class="footer">Keep this ticket with you at all times.</p>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  return (
    <AnimatePresence>
      {ticket && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 20 }}
            transition={{ type: "spring", damping: 22, stiffness: 280 }}
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden"
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-gray-900">Triage Ticket</h3>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Ticket preview */}
            <div ref={printRef} className="px-6 py-5 font-mono text-sm">
              {/* Hospital name */}
              <div className="text-center mb-3">
                <p className="text-lg font-black tracking-widest text-gray-900">MedXplain</p>
                <p className="text-xs text-gray-400">Hospital Management System</p>
              </div>

              <div className="border-t border-dashed border-gray-300 my-3" />

              <p className="text-center text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Triage Ticket</p>

              {/* Big queue number */}
              <div className="text-center my-3">
                <p className="text-8xl font-black text-gray-900 leading-none tracking-tighter">
                  {ticket.queueNumber ?? "—"}
                </p>
                <p className="text-xs text-gray-400 mt-1">Queue Number</p>
              </div>

              <div className="border-t border-dashed border-gray-300 my-3" />

              <div className="space-y-2">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-gray-400">Patient Name</p>
                  <p className="font-bold text-gray-900">{ticket.patientName}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-gray-400">Patient ID (FAN)</p>
                  <p className="font-bold text-gray-900">{ticket.patientId}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-gray-400">Assigned Nurse</p>
                  <p className="font-bold text-gray-900">{ticket.nurseName}</p>
                </div>
                {ticket.chiefComplaint && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-gray-400">Chief Complaint</p>
                    <p className="font-bold text-gray-900">{ticket.chiefComplaint}</p>
                  </div>
                )}
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-gray-400">Visit Type</p>
                  <p className="font-bold text-gray-900">{ticket.visitType === "WALK_IN" ? "Walk-in" : "Online Booking"}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-gray-400">Date & Time</p>
                  <p className="font-bold text-gray-900">{formatDateTime(ticket.createdAt)}</p>
                </div>
              </div>

              <div className="border-t border-dashed border-gray-300 my-3" />
              <p className="text-[10px] text-center text-gray-400">Please wait to be called by your assigned nurse.</p>
              <p className="text-[10px] text-center text-gray-400">Keep this ticket with you at all times.</p>
            </div>

            {/* Actions */}
            <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
              <Button variant="secondary" className="flex-1 justify-center" onClick={onClose}>
                Close
              </Button>
              <Button className="flex-1 justify-center" icon={<Printer className="w-4 h-4" />} onClick={handlePrint}>
                Print Ticket
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
