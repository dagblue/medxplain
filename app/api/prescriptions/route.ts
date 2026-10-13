import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prescriptionSchema } from "@/lib/validations";

/** Generate a short unique prescription code like RX-A3F9 */
function generateRxCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "RX-";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);

  // Pharmacist lookup by code — used for QR/code scanning
  const code = searchParams.get("code") || "";
  if (code) {
    const rx = await prisma.prescription.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        patient: { select: { id: true, name: true, phone: true, gender: true, bloodGroup: true, allergies: true } },
        doctor: { include: { user: { select: { name: true } } } },
        medicines: true,
        dispensation: { include: { pharmacist: { include: { user: { select: { name: true } } } } } },
        visit: { select: { id: true, queueNumber: true, status: true } },
      },
    });
    if (!rx) return NextResponse.json({ error: "Prescription not found" }, { status: 404 });
    return NextResponse.json({ prescription: rx });
  }

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

  const [prescriptions, total] = await Promise.all([
    prisma.prescription.findMany({
      where, skip, take: limit, orderBy: { createdAt: "desc" },
      include: {
        patient: { select: { name: true } },
        doctor: { include: { user: { select: { name: true } } } },
        medicines: true,
        dispensation: { include: { pharmacist: { include: { user: { select: { name: true } } } } } },
      },
    }),
    prisma.prescription.count({ where }),
  ]);

  return NextResponse.json({ prescriptions, total, page, limit });
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "DOCTOR", "NURSE"].includes(session.user.role as string)) {
    return NextResponse.json({ error: "Only doctors and nurses can create prescriptions" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = prescriptionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Resolve doctorId:
  // - Doctor: use their own profile
  // - Nurse/Admin: must explicitly provide doctorId in request body
  let doctorId: string | undefined;

  if (session.user.role === "DOCTOR" || session.user.role === "ADMIN") {
    const doctor = await prisma.doctor.findUnique({ where: { userId: session.user.id } });
    if (doctor) {
      doctorId = doctor.id;
    } else if (body.doctorId) {
      // Admin passing an explicit doctorId
      doctorId = body.doctorId as string;
    }
  }

  if (session.user.role === "NURSE") {
    // Nurses must pass the doctorId they're attributing this prescription to
    if (!body.doctorId) {
      return NextResponse.json({
        error: "Nurses must provide a doctorId to attribute the prescription to a supervising doctor.",
      }, { status: 400 });
    }
    doctorId = body.doctorId as string;
  }

  if (!doctorId) {
    return NextResponse.json({ error: "Doctor profile not found." }, { status: 404 });
  }

  // Generate unique code (retry on collision)
  let code = generateRxCode();
  let attempts = 0;
  while (attempts < 5) {
    const existing = await prisma.prescription.findUnique({ where: { code } });
    if (!existing) break;
    code = generateRxCode();
    attempts++;
  }

  const visitId = (body.visitId as string) || undefined;

  const prescription = await prisma.prescription.create({
    data: {
      patientId: parsed.data.patientId,
      doctorId,
      visitId,
      code,
      notes: parsed.data.notes,
      medicines: { create: parsed.data.medicines },
    },
    include: {
      patient: { select: { name: true } },
      medicines: true,
    },
  });

  // Move visit to WAITING_PHARMACY if linked
  if (visitId) {
    await prisma.visit.update({
      where: { id: visitId },
      data: { status: "WAITING_PHARMACY" },
    }).catch(() => {}); // non-fatal if visit not found
  }

  return NextResponse.json({ prescription }, { status: 201 });
}
