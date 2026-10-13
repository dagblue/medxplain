import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const doctor = await prisma.doctor.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      department: true,
    },
  });

  if (!doctor) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ doctor });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();

  const doctor = await prisma.doctor.update({
    where: { id },
    data: {
      specialization: body.specialization,
      departmentId: body.departmentId,
      availability: body.availability,
      bio: body.bio,
    },
    include: {
      user: { select: { name: true, email: true } },
      department: { select: { name: true } },
    },
  });

  return NextResponse.json({ doctor });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  // Demote user back to PATIENT
  const doctor = await prisma.doctor.findUnique({ where: { id } });
  if (doctor) {
    await prisma.$transaction([
      prisma.doctor.delete({ where: { id } }),
      prisma.user.update({ where: { id: doctor.userId }, data: { role: "PATIENT" } }),
    ]);
  }
  return NextResponse.json({ success: true });
}
