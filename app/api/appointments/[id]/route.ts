import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { z } from "zod";

const appointmentUpdateSchema = z.object({
  status: z.enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"]).optional(),
  notes: z.string().optional(),
  scheduledAt: z.string().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "RECEPTIONIST", "DOCTOR"].includes(session.user.role as string)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = appointmentUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const appointment = await prisma.appointment.update({
    where: { id },
    data: {
      status: parsed.data.status,
      notes: parsed.data.notes,
      scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : undefined,
    },
    include: {
      patient: { select: { id: true, name: true } },
      doctor: { include: { user: { select: { name: true } } } },
    },
  });

  // When doctor starts consultation, update patient status
  if (parsed.data.status === "IN_PROGRESS") {
    await prisma.patient.update({ where: { id: appointment.patient.id }, data: { status: "IN_CONSULTATION" } });
  }
  if (parsed.data.status === "COMPLETED") {
    await prisma.patient.update({ where: { id: appointment.patient.id }, data: { status: "REGISTERED" } });
  }

  return NextResponse.json({ appointment });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "RECEPTIONIST"].includes(session.user.role as string)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  await prisma.appointment.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
