import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true, name: true, email: true, role: true,
      phone: true, mustChangePassword: true, createdAt: true,
      doctorProfile: {
        include: { department: { select: { name: true } } },
      },
      nurseProfile: true,
      labTechProfile: true,
      pharmacistProfile: true,
      patientProfile: {
        select: { name: true, gender: true, dateOfBirth: true, bloodGroup: true, phone: true, address: true, allergies: true, status: true },
      },
    },
  });

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ user });
}

export async function PATCH(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, phone } = body;

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: { name, phone },
    select: { id: true, name: true, email: true, role: true, phone: true },
  });

  return NextResponse.json({ user });
}
