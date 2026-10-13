import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { patientSchema } from "@/lib/validations";

const ALLOWED = ["ADMIN", "RECEPTIONIST", "DOCTOR", "NURSE"];

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "15");
  const skip = (page - 1) * limit;

  // Patients can only see themselves
  if (session.user.role === "PATIENT") {
    const patient = await prisma.patient.findUnique({ where: { userId: session.user.id } });
    return NextResponse.json({ patients: patient ? [patient] : [], total: patient ? 1 : 0 });
  }

  const where: any = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
      { id: { contains: search, mode: "insensitive" } },
    ];
  }
  if (status) where.status = status;

  const [patients, total] = await Promise.all([
    prisma.patient.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" }, include: { registeredBy: { select: { name: true } } } }),
    prisma.patient.count({ where }),
  ]);

  return NextResponse.json({ patients, total, page, limit });
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED.includes(session.user.role as string)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = patientSchema.safeParse(body);
  if (!parsed.success) {
    console.error("Patient validation failed:", JSON.stringify(parsed.error.flatten()));
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const patient = await prisma.patient.create({
      data: {
        ...parsed.data,
        id: parsed.data.nationalId,           // FAN / National ID is the system ID
        email: parsed.data.email || undefined,
        dateOfBirth: parsed.data.dateOfBirth ? new Date(parsed.data.dateOfBirth) : undefined,
        registeredById: session.user.id,
      },
    });
    return NextResponse.json({ patient }, { status: 201 });
  } catch (e: any) {
    if (e.code === "P2002") {
      return NextResponse.json({ error: "A patient with this FAN / National ID already exists" }, { status: 409 });
    }
    throw e;
  }
}
