import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const visit = await prisma.visit.findUnique({
    where: { id },
    include: {
      patient: true,
      nurse: { include: { user: { select: { name: true } } } },
      doctor: { include: { user: { select: { name: true } }, department: { select: { name: true } }, } },
      department: { select: { name: true } },
      vitals: { include: { nurse: { include: { user: { select: { name: true } } } } } },
      labRequests: { include: { labResult: true, doctor: { include: { user: { select: { name: true } } } } } },
      prescriptions: { include: { medicines: true, doctor: { include: { user: { select: { name: true } } } } } },
      medicalRecord: { include: { doctor: { include: { user: { select: { name: true } } } } } },
      createdBy: { select: { name: true, role: true } },
    },
  });

  if (!visit) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Patients can only view their own visits
  if (session.user.role === "PATIENT") {
    const patient = await prisma.patient.findUnique({ where: { userId: session.user.id }, select: { id: true } });
    if (!patient || visit.patientId !== patient.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  return NextResponse.json({ visit });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "RECEPTIONIST"].includes(session.user.role as string)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  await prisma.visit.update({ where: { id }, data: { status: "CANCELLED" } });
  return NextResponse.json({ success: true });
}
