import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { assignDoctorSchema } from "@/lib/validations";

// POST /api/visits/:id/assign-doctor
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "RECEPTIONIST", "NURSE"].includes(session.user.role as string)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = assignDoctorSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const current = await prisma.visit.findUnique({ where: { id }, select: { status: true, patientId: true } });
  if (!current) return NextResponse.json({ error: "Visit not found" }, { status: 404 });

  // Only advance to IN_CONSULTATION if triage is already done
  const advanceStatuses = ["WAITING_DOCTOR", "IN_LAB_PROCESS"];
  const nextStatus = advanceStatuses.includes(current.status) ? "IN_CONSULTATION" : current.status;

  const visit = await prisma.visit.update({
    where: { id },
    data: {
      doctorId: parsed.data.doctorId,
      status: nextStatus as any,
    },
    include: {
      patient: { select: { id: true, name: true } },
      doctor: { include: { user: { select: { name: true } } } },
    },
  });

  // Only update patient status if actually moving to consultation
  if (nextStatus === "IN_CONSULTATION") {
    await prisma.patient.update({ where: { id: current.patientId }, data: { status: "IN_CONSULTATION" } });
  }

  return NextResponse.json({ visit });
}
