import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { medicalRecordSchema } from "@/lib/validations";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const patientId = searchParams.get("patientId") || "";

  const where: any = {};
  if (patientId) where.patientId = patientId;

  // Doctors are scoped to their own records UNLESS a specific patientId is requested
  // (allows full history view when taking over a patient's care)
  if (session.user.role === "DOCTOR" && !patientId) {
    const doctor = await prisma.doctor.findUnique({ where: { userId: session.user.id } });
    if (doctor) where.doctorId = doctor.id;
  }

  const records = await prisma.medicalRecord.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      doctor: { include: { user: { select: { name: true } } } },
      patient: { select: { name: true } },
      appointment: { select: { scheduledAt: true, type: true } },
    },
  });

  return NextResponse.json({ records });
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "DOCTOR"].includes(session.user.role as string)) {
    return NextResponse.json({ error: "Only doctors can create medical records" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = medicalRecordSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const doctor = await prisma.doctor.findUnique({ where: { userId: session.user.id } });
  if (!doctor && session.user.role !== "ADMIN") return NextResponse.json({ error: "Doctor profile not found" }, { status: 404 });

  const record = await prisma.medicalRecord.create({
    data: {
      patientId: parsed.data.patientId,
      doctorId: doctor!.id,
      appointmentId: parsed.data.appointmentId || undefined,
      diagnosis: parsed.data.diagnosis,
      symptoms: parsed.data.symptoms,
      treatment: parsed.data.treatment,
      notes: parsed.data.notes,
      admitPatient: parsed.data.admitPatient,
    },
  });

  // If admitting patient, update status
  if (parsed.data.admitPatient) {
    await prisma.patient.update({ where: { id: parsed.data.patientId }, data: { status: "ADMITTED" } });
  }

  // Mark appointment as completed
  if (parsed.data.appointmentId) {
    await prisma.appointment.update({ where: { id: parsed.data.appointmentId }, data: { status: "COMPLETED" } });
  }

  return NextResponse.json({ record }, { status: 201 });
}
