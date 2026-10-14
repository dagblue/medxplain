import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { labRequestSchema } from "@/lib/validations";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "";
  const patientId = searchParams.get("patientId") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "15");
  const skip = (page - 1) * limit;

  const where: any = {};
  if (status) where.status = status;
  if (patientId) where.patientId = patientId;

  if (session.user.role === "DOCTOR") {
    const doctor = await prisma.doctor.findUnique({ where: { userId: session.user.id } });
    if (doctor) where.doctorId = doctor.id;
  }

  const [requests, total] = await Promise.all([
    prisma.labRequest.findMany({
      where, skip, take: limit, orderBy: { createdAt: "desc" },
      include: {
        patient: { select: { name: true } },
        doctor: { include: { user: { select: { name: true } } } },
        labResult: true,
      },
    }),
    prisma.labRequest.count({ where }),
  ]);

  return NextResponse.json({ requests, total, page, limit });
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "DOCTOR", "NURSE"].includes(session.user.role as string)) {
    return NextResponse.json({ error: "Only doctors and nurses can request lab tests" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = labRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Find doctor profile — for ADMIN, allow passing doctorId directly in body
  let doctorId: string | undefined;

  if (session.user.role === "ADMIN" && body.doctorId) {
    doctorId = body.doctorId;
  } else if (session.user.role === "NURSE") {
    // Nurse-initiated lab request: use the doctor assigned to the visit
    if (parsed.data.visitId) {
      const visit = await prisma.visit.findUnique({
        where: { id: parsed.data.visitId },
        select: { doctorId: true },
      });
      if (visit?.doctorId) {
        doctorId = visit.doctorId;
      }
    }
    // If no doctor assigned yet, use any available doctor as placeholder
    if (!doctorId) {
      const anyDoctor = await prisma.doctor.findFirst({ where: { isAvailable: true } });
      if (anyDoctor) doctorId = anyDoctor.id;
    }
    if (!doctorId) {
      return NextResponse.json({ error: "No doctor available to attach to this lab request. Assign a doctor to the visit first." }, { status: 400 });
    }
  } else {
    // Primary: find by userId
    let doctor = await prisma.doctor.findUnique({ where: { userId: session.user.id } });

    // Fallback: if visitId provided, use the doctor already assigned to that visit
    if (!doctor && parsed.data.visitId) {
      const visit = await prisma.visit.findUnique({
        where: { id: parsed.data.visitId },
        select: { doctorId: true },
      });
      if (visit?.doctorId) {
        doctor = await prisma.doctor.findUnique({ where: { id: visit.doctorId } });
      }
    }

    if (!doctor) {
      // Return helpful debug info
      const allDoctors = await prisma.doctor.findMany({
        select: { userId: true, user: { select: { name: true, email: true } } },
      });
      return NextResponse.json(
        {
          error: "Doctor profile not found.",
          debug: {
            sessionUserId: session.user.id,
            sessionEmail: session.user.email,
            doctorUserIds: allDoctors.map(d => ({ userId: d.userId, name: d.user.name, email: d.user.email })),
          },
        },
        { status: 404 }
      );
    }
    doctorId = doctor.id;
  }

  const request = await prisma.labRequest.create({
    data: {
      patientId: parsed.data.patientId,
      visitId: parsed.data.visitId || undefined,
      testName: parsed.data.testName,
      testType: parsed.data.testType,
      urgency: parsed.data.urgency,
      notes: parsed.data.notes,
      doctorId: doctorId as string,
      labTechnicianId: body.labTechnicianId || undefined,
    },
    include: { patient: { select: { name: true } } },
  });

  return NextResponse.json({ request }, { status: 201 });
}
