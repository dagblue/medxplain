import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { vitalsSchema } from "@/lib/validations";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const patientId = searchParams.get("patientId") || "";

  const vitals = await prisma.vitals.findMany({
    where: patientId ? { patientId } : {},
    orderBy: { recordedAt: "desc" },
    take: 20,
    include: { nurse: { include: { user: { select: { name: true } } } } },
  });

  return NextResponse.json({ vitals });
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "NURSE"].includes(session.user.role as string)) {
    return NextResponse.json({ error: "Only nurses can record vitals" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = vitalsSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const nurse = await prisma.nurse.findUnique({ where: { userId: session.user.id } });
  if (!nurse) return NextResponse.json({ error: "Nurse profile not found" }, { status: 404 });

  const vitals = await prisma.vitals.create({
    data: { ...parsed.data, nurseId: nurse.id },
  });

  return NextResponse.json({ vitals }, { status: 201 });
}
