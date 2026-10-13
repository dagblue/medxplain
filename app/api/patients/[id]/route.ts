import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { z } from "zod";

const STAFF_ROLES = ["ADMIN", "RECEPTIONIST", "DOCTOR", "NURSE", "LAB_TECHNICIAN", "PHARMACIST", "ACCOUNTANT"];

const patientUpdateSchema = z.object({
  name:              z.string().min(2).optional(),
  dateOfBirth:       z.string().optional(),
  gender:            z.enum(["Male", "Female", "Other"]).optional(),
  nationality:       z.string().optional(),
  maritalStatus:     z.enum(["Single", "Married", "Divorced", "Widowed"]).optional(),
  phone:             z.string().min(7).optional(),
  email:             z.string().email().optional().or(z.literal("")).optional(),
  address:           z.string().optional(),
  city:              z.string().optional(),
  region:            z.string().optional(),
  country:           z.string().optional(),
  bloodGroup:        z.string().optional(),
  allergies:         z.string().optional(),
  chronicConditions: z.string().optional(),
  currentMedications:z.string().optional(),
  dischargeDocument: z.string().optional(),
  occupation:        z.string().optional(),
  employer:          z.string().optional(),
  insuranceProvider: z.string().optional(),
  insurancePolicyNo: z.string().optional(),
  emergencyContact:  z.string().optional(),
  nextOfKinName:     z.string().optional(),
  nextOfKinPhone:    z.string().optional(),
  nextOfKinRelation: z.string().optional(),
  // status can only be changed by staff
  status:            z.enum(["REGISTERED","WAITING","IN_CONSULTATION","ADMITTED","DISCHARGED"]).optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Patients can only view their own record
  if (session.user.role === "PATIENT") {
    const self = await prisma.patient.findUnique({ where: { userId: session.user.id }, select: { id: true } });
    if (!self || self.id !== id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const patient = await prisma.patient.findUnique({
    where: { id },
    include: {
      registeredBy: { select: { name: true } },
      appointments: { include: { doctor: { include: { user: { select: { name: true } } } } }, orderBy: { scheduledAt: "desc" }, take: 5 },
      medicalRecords: { include: { doctor: { include: { user: { select: { name: true } } } } }, orderBy: { createdAt: "desc" }, take: 5 },
      vitals: { orderBy: { recordedAt: "desc" }, take: 3 },
      labRequests: { include: { labResult: true }, orderBy: { createdAt: "desc" }, take: 5 },
      prescriptions: { include: { medicines: true }, orderBy: { createdAt: "desc" }, take: 5 },
      bills: { orderBy: { createdAt: "desc" }, take: 3 },
    },
  });

  if (!patient) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ patient });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!STAFF_ROLES.includes(session.user.role as string)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = patientUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Only ADMINs and RECEPTIONISTs can change patient status directly
  if (parsed.data.status && !["ADMIN", "RECEPTIONIST"].includes(session.user.role as string)) {
    delete parsed.data.status;
  }

  const patient = await prisma.patient.update({
    where: { id },
    data: {
      ...parsed.data,
      // nationalId is the primary key — cannot be changed after registration
      dateOfBirth: parsed.data.dateOfBirth ? new Date(parsed.data.dateOfBirth) : undefined,
      email: parsed.data.email || undefined,
    },
  });

  return NextResponse.json({ patient });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await prisma.patient.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
