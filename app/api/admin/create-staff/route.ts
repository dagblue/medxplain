import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { z } from "zod";

const createStaffSchema = z.object({
  name: z.string().min(2, "Name required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Min 6 characters"),
  role: z.enum(["RECEPTIONIST", "DOCTOR", "NURSE", "LAB_TECHNICIAN", "PHARMACIST", "ACCOUNTANT", "ADMIN"]),
  phone: z.string().optional(),
  // Doctor-specific
  specialization: z.string().optional(),
  departmentId: z.string().optional(),
  availability: z.string().optional(),
  bio: z.string().optional(),
  // Nurse-specific
  ward: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Only admins can create staff accounts" }, { status: 403 });

  const body = await req.json();
  const parsed = createStaffSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { name, email, password, role, phone, specialization, departmentId, availability, bio, ward } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: "Email already in use" }, { status: 409 });

  let result: any;
  try {
    result = await auth.api.signUpEmail({ body: { name, email, password } });
  } catch (e: any) {
    console.error("signUpEmail error:", e);
    return NextResponse.json({ error: e?.message ?? "Failed to create auth account" }, { status: 500 });
  }

  if (!result?.user) return NextResponse.json({ error: "Failed to create user account" }, { status: 500 });

  await prisma.user.update({
    where: { id: result.user.id },
    data: { role: role as any, phone, mustChangePassword: true },
  });

  if (role === "DOCTOR" && specialization && departmentId) {
    await prisma.doctor.create({
      data: { userId: result.user.id, specialization, departmentId, availability, bio },
    });
  }
  if (role === "NURSE") {
    await prisma.nurse.create({ data: { userId: result.user.id, ward } });
  }
  if (role === "LAB_TECHNICIAN") {
    await prisma.labTechnician.create({ data: { userId: result.user.id } });
  }
  if (role === "PHARMACIST") {
    await prisma.pharmacist.create({ data: { userId: result.user.id } });
  }

  const user = await prisma.user.findUnique({
    where: { id: result.user.id },
    select: { id: true, name: true, email: true, role: true, phone: true, createdAt: true },
  });

  return NextResponse.json({ user }, { status: 201 });
}
