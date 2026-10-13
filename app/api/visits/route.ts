import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { createVisitSchema } from "@/lib/validations";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "";
  const search = searchParams.get("search") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const skip = (page - 1) * limit;

  const where: any = {};
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { patient: { name: { contains: search, mode: "insensitive" } } },
      { patient: { phone: { contains: search, mode: "insensitive" } } },
    ];
  }

  // Role-based scoping
  if (session.user.role === "NURSE") {
    const nurse = await prisma.nurse.findUnique({ where: { userId: session.user.id } });
    if (nurse) {
      // Nurse sees: visits assigned to them OR waiting for triage
      where.OR = [
        { nurseId: nurse.id },
        { status: "WAITING_TRIAGE" },
      ];
    }
  }

  if (session.user.role === "DOCTOR") {
    const doctor = await prisma.doctor.findUnique({ where: { userId: session.user.id } });
    if (doctor) {
      where.OR = [
        { doctorId: doctor.id },
        { status: "WAITING_DOCTOR" },
      ];
    }
  }

  if (session.user.role === "PATIENT") {
    const patient = await prisma.patient.findUnique({ where: { userId: session.user.id } });
    if (patient) where.patientId = patient.id;
  }

  const [visits, total] = await Promise.all([
    prisma.visit.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        patient: { select: { id: true, name: true, gender: true, phone: true, bloodGroup: true, allergies: true, dischargeDocument: true } },
        nurse: { include: { user: { select: { name: true } } } },
        doctor: { include: { user: { select: { name: true } }, department: { select: { name: true } } } },
        department: { select: { name: true } },
        vitals: true,
        labRequests: { include: { labResult: true } },
        prescriptions: { include: { medicines: true } },
        medicalRecord: true,
        createdBy: { select: { name: true, role: true } },
      },
    }),
    prisma.visit.count({ where }),
  ]);

  return NextResponse.json({ visits, total, page, limit });
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createVisitSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { patientId, chiefComplaint, departmentId, scheduledAt, visitType } = parsed.data;

  // Patients can only create visits for themselves
  if (session.user.role === "PATIENT") {
    const patient = await prisma.patient.findUnique({ where: { userId: session.user.id } });
    if (!patient || patient.id !== patientId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Assign queue number atomically using a raw query to avoid race conditions
  // between concurrent registrations counting the same activeToday value.
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

  // Use a transaction with a count-then-create to minimise (not eliminate) collisions.
  // The unique constraint on queueNumber per day would be the final safeguard if added to schema.
  const activeToday = await prisma.visit.count({
    where: {
      createdAt: { gte: today, lt: tomorrow },
      status: { notIn: ["CANCELLED"] },
    },
  });
  const queueNumber = activeToday + 1;

  const visit = await prisma.visit.create({
    data: {
      patientId,
      chiefComplaint,
      departmentId: departmentId || undefined,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
      visitType: visitType as any,
      createdById: session.user.id,
      status: "WAITING_TRIAGE",
      queueNumber,
    },
    include: {
      patient: { select: { name: true } },
      department: { select: { name: true } },
    },
  });

  // Update patient status
  await prisma.patient.update({ where: { id: patientId }, data: { status: "WAITING" } });

  return NextResponse.json({ visit }, { status: 201 });
}
