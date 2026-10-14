import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Min 6 characters"),
});

export const patientSchema = z.object({
  // Identity
  name:              z.string().min(2, "Full name required"),
  nationalId:        z.string().min(3, "FAN / National ID is required"),
  dateOfBirth:       z.string().optional(),
  gender:            z.enum(["Male", "Female", "Other"]),
  nationality:       z.string().optional(),
  maritalStatus:     z.enum(["Single", "Married", "Divorced", "Widowed"]).optional(),

  // Contact
  phone:             z.string().min(7, "Phone required"),
  email:             z.string().email("Invalid email").optional().or(z.literal("")),
  address:           z.string().optional(),
  city:              z.string().optional(),
  region:            z.string().optional(),
  country:           z.string().optional(),

  // Medical
  bloodGroup:        z.string().optional(),
  allergies:         z.string().optional(),
  chronicConditions: z.string().optional(),
  currentMedications: z.string().optional(),

  // Past clinical data — discharge summary / referral letter text
  dischargeDocument: z.string().optional(),

  // Occupation
  occupation:        z.string().optional(),
  employer:          z.string().optional(),

  // Insurance
  insuranceProvider: z.string().optional(),
  insurancePolicyNo: z.string().optional(),

  // Emergency / Next of kin
  emergencyContact:  z.string().optional(),
  nextOfKinName:     z.string().optional(),
  nextOfKinPhone:    z.string().optional(),
  nextOfKinRelation: z.string().optional(),
});

export const doctorSchema = z.object({
  userId: z.string().min(1, "User required"),
  specialization: z.string().min(1, "Specialization required"),
  departmentId: z.string().min(1, "Department required"),
  availability: z.string().optional(),
  bio: z.string().optional(),
});

export const appointmentSchema = z.object({
  patientId: z.string().min(1, "Patient required"),
  doctorId: z.string().min(1, "Doctor required"),
  scheduledAt: z.string().min(1, "Date required"),
  type: z.string().default("General"),
  chiefComplaint: z.string().optional(),
  notes: z.string().optional(),
});

export const medicalRecordSchema = z.object({
  patientId: z.string().min(1),
  appointmentId: z.string().optional(),
  diagnosis: z.string().min(1, "Diagnosis required"),
  symptoms: z.string().optional(),
  treatment: z.string().optional(),
  notes: z.string().optional(),
  admitPatient: z.boolean().default(false),
});

export const vitalsSchema = z.object({
  patientId: z.string().min(1),
  temperature: z.string().optional(),
  bloodPressure: z.string().optional(),
  heartRate: z.string().optional(),
  oxygenSat: z.string().optional(),
  weight: z.string().optional(),
  height: z.string().optional(),
  notes: z.string().optional(),
});

export const labRequestSchema = z.object({
  patientId: z.string().min(1),
  visitId: z.string().optional(),
  testName: z.string().min(1, "Test name required"),
  testType: z.string().min(1, "Test type required"),
  urgency: z.enum(["ROUTINE", "URGENT", "STAT"]).default("ROUTINE"),
  notes: z.string().optional(),
});

export const labResultSchema = z.object({
  labRequestId: z.string().min(1),
  result: z.string().min(1, "Result required"),
  normalRange: z.string().optional(),
  interpretation: z.string().optional(),
  fileUrl: z.string().optional(),
});

export const prescriptionSchema = z.object({
  patientId: z.string().min(1),
  notes: z.string().optional(),
  medicines: z.array(z.object({
    name: z.string().min(1),
    dosage: z.string().min(1),
    frequency: z.string().min(1),
    duration: z.string().min(1),
    instructions: z.string().optional(),
  })).min(1, "At least one medicine required"),
});

export const billSchema = z.object({
  patientId: z.string().min(1),
  items: z.array(z.object({
    description: z.string().min(1),
    category: z.enum(["CONSULTATION", "LAB", "MEDICINE", "ADMISSION", "OTHER"]),
    quantity: z.coerce.number().min(1),
    unitPrice: z.coerce.number().min(0),
  })).min(1, "At least one item required"),
  tax: z.coerce.number().min(0).default(0),
  discount: z.coerce.number().min(0).default(0),
  notes: z.string().optional(),
});

export const paymentSchema = z.object({
  billId: z.string().min(1),
  amount: z.coerce.number().min(0.01),
  method: z.enum(["CASH", "CARD", "INSURANCE", "BANK_TRANSFER"]).default("CASH"),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

export const dischargeSchema = z.object({
  patientId: z.string().min(1),
  dischargeNotes: z.string().optional(),
  followUpDate: z.string().optional(),
});

// Visit workflow schemas
export const createVisitSchema = z.object({
  patientId: z.string().min(1, "Patient required"),
  chiefComplaint: z.string().optional(),
  departmentId: z.string().optional(),
  scheduledAt: z.string().optional(), // for online bookings
  visitType: z.enum(["WALK_IN", "ONLINE"]).default("WALK_IN"),
});

export const assignNurseSchema = z.object({
  nurseId: z.string().min(1, "Nurse required"),
});

export const triageSchema = z.object({
  temperature: z.string().optional(),
  bloodPressure: z.string().optional(),
  heartRate: z.string().optional(),
  oxygenSat: z.string().optional(),
  weight: z.string().optional(),
  height: z.string().optional(),
  notes: z.string().optional(),
  requiresDoctor: z.boolean(),
  needsLab: z.boolean().default(false),
  triageNotes: z.string().optional(),
});

export const assignDoctorSchema = z.object({
  doctorId: z.string().min(1, "Doctor required"),
});

export const consultationSchema = z.object({
  diagnosis: z.string().min(1, "Diagnosis required"),
  symptoms: z.string().optional(),
  treatment: z.string().optional(),
  consultationNotes: z.string().optional(),
  dischargeNotes: z.string().optional(),   // doctor's discharge summary
  followUpDate: z.string().optional(),      // follow-up date
  admitPatient: z.boolean().default(false),
});

export type CreateVisitInput = z.infer<typeof createVisitSchema>;
export type AssignNurseInput = z.infer<typeof assignNurseSchema>;
export type TriageInput = z.infer<typeof triageSchema>;
export type AssignDoctorInput = z.infer<typeof assignDoctorSchema>;
export type ConsultationInput = z.infer<typeof consultationSchema>;

export const messageSchema = z.object({
  receiverId: z.string().min(1),
  content: z.string().min(1).max(2000),
});

export const departmentSchema = z.object({
  name: z.string().min(2, "Department name required"),
  description: z.string().optional(),
});

export const promoteSchema = z.object({
  role: z.enum(["ADMIN","RECEPTIONIST","DOCTOR","NURSE","LAB_TECHNICIAN","PHARMACIST","ACCOUNTANT","PATIENT"]),
  // Doctor-specific
  specialization: z.string().optional(),
  departmentId: z.string().optional(),
  availability: z.string().optional(),
  bio: z.string().optional(),
  // Nurse-specific
  ward: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type PatientInput = z.infer<typeof patientSchema>;
export type DoctorInput = z.infer<typeof doctorSchema>;
export type AppointmentInput = z.infer<typeof appointmentSchema>;
export type MedicalRecordInput = z.infer<typeof medicalRecordSchema>;
export type VitalsInput = z.infer<typeof vitalsSchema>;
export type LabRequestInput = z.infer<typeof labRequestSchema>;
export type LabResultInput = z.infer<typeof labResultSchema>;
export type PrescriptionInput = z.infer<typeof prescriptionSchema>;
export type BillInput = z.infer<typeof billSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;
export type DischargeInput = z.infer<typeof dischargeSchema>;
export type MessageInput = z.infer<typeof messageSchema>;
export type PromoteInput = z.infer<typeof promoteSchema>;
export type DepartmentInput = z.infer<typeof departmentSchema>;

export const reportSchema = z.object({
  patientId: z.string().min(1, "Patient required"),
  doctorId: z.string().optional(),
  title: z.string().min(1, "Title required"),
  result: z.string().min(1, "Result required"),
  fileUrl: z.string().optional(),
});
export type ReportInput = z.infer<typeof reportSchema>;

export const userSchema = z.object({
  name: z.string().min(2, "Name required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Min 6 characters").optional(),
  phone: z.string().optional(),
  department: z.string().optional(),
  role: z.enum(["ADMIN","RECEPTIONIST","DOCTOR","NURSE","LAB_TECHNICIAN","PHARMACIST","ACCOUNTANT","PATIENT"]),
});
export type UserInput = z.infer<typeof userSchema>;
