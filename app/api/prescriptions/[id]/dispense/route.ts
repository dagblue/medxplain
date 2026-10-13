import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "PHARMACIST"].includes(session.user.role as string)) {
    return NextResponse.json({ error: "Only pharmacists can dispense" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  const pharmacist = await prisma.pharmacist.findUnique({ where: { userId: session.user.id } });
  if (!pharmacist) return NextResponse.json({ error: "Pharmacist profile not found" }, { status: 404 });

  const [dispensation] = await prisma.$transaction([
    prisma.dispensation.create({
      data: {
        prescriptionId: id,
        pharmacistId: pharmacist.id,
        notes: body.notes,
      },
    }),
    prisma.prescription.update({ where: { id }, data: { status: "DISPENSED" } }),
  ]);

  // Move linked visit to COMPLETED if it was WAITING_PHARMACY
  const rx = await prisma.prescription.findUnique({ where: { id }, select: { visitId: true } });
  if (rx?.visitId) {
    await prisma.visit.updateMany({
      where: { id: rx.visitId, status: "WAITING_PHARMACY" },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
  }

  return NextResponse.json({ dispensation }, { status: 201 });
}
