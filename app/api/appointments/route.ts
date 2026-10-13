import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { appointmentSchema } from "@/lib/validations";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "";
  const today = searchParams.get("today") === "true";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "15");
  const skip = (page - 1) * limit;

  const where: any = {};

  if (session.user.role === "DOCTOR") {
    const doctor = await prisma.doctor.findUnique({ where: { userId: session.user.id } });
    if (doctor) where.doctorId = doctor.id;
  }

  if (session.user.role === "PATIENT") {
    const patient = await prisma.patient.findUnique({ where: { userId: session.user.id } });
    if (patient) where.patientId = patient.id;
  }

  if (search) {
    where.OR = [
      { patient: { name: { contains: search, mode: "insensitive" } } },
      { doctor: { user: { name: { contains: search, mode: "insensitive" } } } },
    ];
  }
  if (status) where.status = status;
  if (today) {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    where.scheduledAt = { gte: start, lte: end };
  }

  const [appointments, total] = await Promise.all([
    prisma.appointment.findMany({
      where, skip, take: limit, orderBy: { scheduledAt: "desc" },
      include: {
        patient: { select: { id: true, name: true, gender: true, phone: true } },
        doctor: { include: { user: { select: { name: true } }, department: { select: { name: true } } } },
        createdBy: { select: { name: true } },
      },
    }),
    prisma.appointment.count({ where }),
  ]);

  return NextResponse.json({ appointments, total, page, limit });
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "RECEPTIONIST"].includes(session.user.role as string)) {
    return NextResponse.json({ error: "Only receptionists can book appointments" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = appointmentSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Update patient status to WAITING
  await prisma.patient.update({ where: { id: parsed.data.patientId }, data: { status: "WAITING" } });

  const appointment = await prisma.appointment.create({
    data: {
      patientId: parsed.data.patientId,
      doctorId: parsed.data.doctorId,
      createdById: session.user.id,
      scheduledAt: new Date(parsed.data.scheduledAt),
      type: parsed.data.type,
      chiefComplaint: parsed.data.chiefComplaint,
      notes: parsed.data.notes,
    },
    include: {
      patient: { select: { name: true } },
      doctor: { include: { user: { select: { name: true } } } },
    },
  });

  return NextResponse.json({ appointment }, { status: 201 });
}
