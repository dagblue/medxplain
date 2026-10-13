import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

const ALLOWED_ROLES = ["ADMIN", "DOCTOR", "LAB_TECHNICIAN"];

/**
 * Reports are built from LabResult records — the actual model that exists in the schema.
 * Each lab result is linked to a LabRequest which has the patient and doctor.
 */
export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED_ROLES.includes(session.user.role as string)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const patientId = searchParams.get("patientId") || "";
  const search = searchParams.get("search") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "10");
  const skip = (page - 1) * limit;

  const where: any = {};
  if (patientId) where.labRequest = { patientId };
  if (search) {
    where.OR = [
      { labRequest: { testName: { contains: search, mode: "insensitive" } } },
      { labRequest: { patient: { name: { contains: search, mode: "insensitive" } } } },
    ];
  }

  // Doctors only see results linked to their own requests
  if (session.user.role === "DOCTOR") {
    const doctor = await prisma.doctor.findUnique({ where: { userId: session.user.id } });
    if (doctor) {
      where.labRequest = { ...where.labRequest, doctorId: doctor.id };
    }
  }

  // Lab technicians only see results they uploaded
  if (session.user.role === "LAB_TECHNICIAN") {
    const labTech = await prisma.labTechnician.findUnique({ where: { userId: session.user.id } });
    if (labTech) {
      where.labTechnicianId = labTech.id;
    }
  }

  const [reports, total] = await Promise.all([
    prisma.labResult.findMany({
      where,
      skip,
      take: limit,
      orderBy: { completedAt: "desc" },
      include: {
        labRequest: {
          include: {
            patient: { select: { id: true, name: true } },
            doctor: { include: { user: { select: { name: true } } } },
          },
        },
        labTechnician: { include: { user: { select: { name: true } } } },
      },
    }),
    prisma.labResult.count({ where }),
  ]);

  return NextResponse.json({ reports, total, page, limit });
}
