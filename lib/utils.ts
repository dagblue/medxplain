import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(date: Date | string) {
  return new Date(date).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function formatTime(date: Date | string) {
  return new Date(date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

export const ROLES = ["ADMIN","RECEPTIONIST","DOCTOR","NURSE","LAB_TECHNICIAN","PHARMACIST","ACCOUNTANT","PATIENT"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  RECEPTIONIST: "Receptionist",
  DOCTOR: "Doctor",
  NURSE: "Nurse",
  LAB_TECHNICIAN: "Lab Technician",
  PHARMACIST: "Pharmacist",
  ACCOUNTANT: "Accountant",
  PATIENT: "Patient",
};

export const ROLE_COLORS: Record<Role, string> = {
  ADMIN: "bg-red-100 text-red-700",
  RECEPTIONIST: "bg-cyan-100 text-cyan-700",
  DOCTOR: "bg-blue-100 text-blue-700",
  NURSE: "bg-green-100 text-green-700",
  LAB_TECHNICIAN: "bg-purple-100 text-purple-700",
  PHARMACIST: "bg-orange-100 text-orange-700",
  ACCOUNTANT: "bg-yellow-100 text-yellow-700",
  PATIENT: "bg-gray-100 text-gray-700",
};

export const DEPARTMENTS = ["Cardiology","Neurology","Emergency","Radiology","Laboratory","Orthopedics","Pediatrics","Oncology","General Medicine"] as const;

export const APPOINTMENT_STATUSES = ["SCHEDULED","IN_PROGRESS","COMPLETED","CANCELLED","NO_SHOW"] as const;
export const VISIT_STATUSES = ["WAITING_TRIAGE","IN_TRIAGE","WAITING_DOCTOR","IN_CONSULTATION","COMPLETED","CANCELLED"] as const;
export const LAB_REQUEST_STATUSES = ["PENDING","IN_PROGRESS","COMPLETED","CANCELLED"] as const;
export const PRESCRIPTION_STATUSES = ["PENDING","DISPENSED","CANCELLED"] as const;
export const BILL_STATUSES = ["DRAFT","ISSUED","PAID","PARTIALLY_PAID","CANCELLED"] as const;
export const PATIENT_STATUSES = ["REGISTERED","WAITING","IN_CONSULTATION","ADMITTED","DISCHARGED"] as const;

export const STATUS_BADGE: Record<string, string> = {
  // Appointment
  SCHEDULED: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-yellow-100 text-yellow-700",
  COMPLETED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
  NO_SHOW: "bg-gray-100 text-gray-600",
  // Visit
  WAITING_TRIAGE: "bg-orange-100 text-orange-700",
  IN_TRIAGE: "bg-yellow-100 text-yellow-700",
  IN_LAB_PROCESS: "bg-cyan-100 text-cyan-700",
  WAITING_DOCTOR: "bg-purple-100 text-purple-700",
  IN_CONSULTATION: "bg-blue-100 text-blue-700",
  WAITING_PHARMACY: "bg-orange-100 text-orange-700",
  // Lab
  PENDING: "bg-yellow-100 text-yellow-700",
  // Prescription
  DISPENSED: "bg-green-100 text-green-700",
  // Bill
  DRAFT: "bg-gray-100 text-gray-600",
  ISSUED: "bg-blue-100 text-blue-700",
  PAID: "bg-green-100 text-green-700",
  PARTIALLY_PAID: "bg-orange-100 text-orange-700",
  // Patient
  REGISTERED: "bg-gray-100 text-gray-600",
  WAITING: "bg-yellow-100 text-yellow-700",
  ADMITTED: "bg-purple-100 text-purple-700",
  DISCHARGED: "bg-green-100 text-green-700",
};
