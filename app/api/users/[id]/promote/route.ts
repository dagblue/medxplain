import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { promoteSchema } from "@/lib/validations";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = promoteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { role, specialization, departmentId, availability, bio, ward } = parsed.data;

  // Update user role
  await prisma.user.update({ where: { id }, data: { role } });

  // Create role profile
  if (role === "DOCTOR" && specialization && departmentId) {
    await prisma.doctor.upsert({
      where: { userId: id },
      update: { specialization, departmentId, availability, bio },
      create: { userId: id, specialization, departmentId, availability, bio },
    });
  }
  if (role === "NURSE") {
    await prisma.nurse.upsert({
      where: { userId: id },
      update: { ward },
      create: { userId: id, ward },
    });
  }
  if (role === "LAB_TECHNICIAN") {
    await prisma.labTechnician.upsert({
      where: { userId: id },
      update: {},
      create: { userId: id },
    });
  }
  if (role === "PHARMACIST") {
    await prisma.pharmacist.upsert({
      where: { userId: id },
      update: {},
      create: { userId: id },
    });
  }

  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, role: true } });
  return NextResponse.json({ user });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await prisma.user.update({ where: { id }, data: { role: "PATIENT" } });
  return NextResponse.json({ success: true });
}
