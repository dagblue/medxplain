import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { assignNurseSchema } from "@/lib/validations";

// POST /api/visits/:id/assign-nurse
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "RECEPTIONIST", "NURSE"].includes(session.user.role as string)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = assignNurseSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Only advance to IN_TRIAGE if currently WAITING_TRIAGE
  const current = await prisma.visit.findUnique({ where: { id }, select: { status: true } });
  if (!current) return NextResponse.json({ error: "Visit not found" }, { status: 404 });

  const nextStatus = current.status === "WAITING_TRIAGE" ? "IN_TRIAGE" : current.status;

  const visit = await prisma.visit.update({
    where: { id },
    data: {
      nurseId: parsed.data.nurseId,
      status: nextStatus as any,
    },
    include: {
      patient: { select: { name: true } },
      nurse: { include: { user: { select: { name: true } } } },
      // include queueNumber so callers can show it in confirmations
    },
    // select queueNumber explicitly
  });

  // Re-fetch with queueNumber (update doesn't support selecting scalar + include together cleanly)
  const full = await prisma.visit.findUnique({
    where: { id },
    select: {
      id: true,
      queueNumber: true,
      status: true,
      chiefComplaint: true,
      visitType: true,
      createdAt: true,
      patient: { select: { id: true, name: true } },
      nurse: { include: { user: { select: { name: true } } } },
    },
  });

  return NextResponse.json({ visit: full });
}
