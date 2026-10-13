import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { z } from "zod";

const labStatusSchema = z.object({
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"]),
});

// PATCH — update status (lab tech picks up)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "LAB_TECHNICIAN"].includes(session.user.role as string)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = labStatusSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const request = await prisma.labRequest.update({
    where: { id },
    data: { status: parsed.data.status },
  });

  return NextResponse.json({ request });
}

// POST to /api/lab-requests/:id/result — lab tech uploads result
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "LAB_TECHNICIAN"].includes(session.user.role as string)) {
    return NextResponse.json({ error: "Only lab technicians can upload results" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = labResultSchema.safeParse({ ...body, labRequestId: id });
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const labTech = await prisma.labTechnician.findUnique({ where: { userId: session.user.id } });
  if (!labTech) return NextResponse.json({ error: "Lab technician profile not found" }, { status: 404 });

  const [result] = await prisma.$transaction([
    prisma.labResult.create({
      data: {
        labRequestId: id,
        labTechnicianId: labTech.id,
        result: parsed.data.result,
        normalRange: parsed.data.normalRange,
        interpretation: parsed.data.interpretation,
        fileUrl: parsed.data.fileUrl,
      },
    }),
    prisma.labRequest.update({ where: { id }, data: { status: "COMPLETED" } }),
  ]);

  // If this lab request is linked to a visit in IN_LAB_PROCESS,
  // check if all lab requests for that visit are done — if so, move to WAITING_DOCTOR
  const labRequest = await prisma.labRequest.findUnique({
    where: { id },
    select: { visitId: true },
  });
  if (labRequest?.visitId) {
    const pendingForVisit = await prisma.labRequest.count({
      where: { visitId: labRequest.visitId, status: { not: "COMPLETED" } },
    });
    if (pendingForVisit === 0) {
      await prisma.visit.updateMany({
        where: { id: labRequest.visitId, status: "IN_LAB_PROCESS" },
        data: { status: "WAITING_DOCTOR" },
      });
    }
  }

  return NextResponse.json({ result }, { status: 201 });
}
