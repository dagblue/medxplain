import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { triageSchema } from "@/lib/validations";

// POST /api/visits/:id/triage — nurse records vitals + makes triage decision
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "NURSE"].includes(session.user.role as string)) {
    return NextResponse.json({ error: "Only nurses can perform triage" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = triageSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const nurse = await prisma.nurse.findUnique({ where: { userId: session.user.id } });
  if (!nurse && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Nurse profile not found" }, { status: 404 });
  }

  const { requiresDoctor, needsLab, triageNotes, ...vitalsData } = parsed.data;

  // Determine next status based on nurse decision
  let nextStatus: string;
  if (needsLab) {
    nextStatus = "IN_LAB_PROCESS";
  } else if (requiresDoctor) {
    nextStatus = "WAITING_DOCTOR";
  } else {
    // Minor case — nurse should use the /minor-case endpoint which requires
    // a diagnosis and prescription. Plain triage cannot close a visit.
    return NextResponse.json({
      error: "To complete a minor case, use the /api/visits/:id/minor-case endpoint which requires a diagnosis and prescription.",
    }, { status: 400 });
  }

  const [visit] = await prisma.$transaction([
    prisma.visit.update({
      where: { id },
      data: {
        status: nextStatus as any,
        requiresDoctor,
        triageNotes,
        triageCompletedAt: new Date(),
      },
      include: { patient: { select: { id: true, name: true } } },
    }),
    prisma.visitVitals.upsert({
      where: { visitId: id },
      update: { ...vitalsData, nurseId: nurse?.id ?? "" },
      create: { visitId: id, nurseId: nurse?.id ?? "", ...vitalsData },
    }),
  ]);

  return NextResponse.json({ visit });
}
