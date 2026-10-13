import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

/**
 * PATCH /api/staff/availability
 * Allows doctors, nurses, lab technicians, and pharmacists to toggle
 * their own availability status.
 *
 * Body: { isAvailable: boolean }
 */
export async function PATCH(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role as string;
  const allowed = ["DOCTOR", "NURSE", "LAB_TECHNICIAN", "PHARMACIST", "ADMIN"];
  if (!allowed.includes(role)) {
    return NextResponse.json({ error: "Only staff can update availability" }, { status: 403 });
  }

  const body = await req.json();
  if (typeof body.isAvailable !== "boolean") {
    return NextResponse.json({ error: "isAvailable must be a boolean" }, { status: 400 });
  }

  const { isAvailable } = body;
  const userId = session.user.id;

  try {
    if (role === "DOCTOR") {
      const doc = await prisma.doctor.update({
        where: { userId },
        data: { isAvailable },
        select: { id: true, isAvailable: true, user: { select: { name: true } } },
      });
      return NextResponse.json({ profile: doc, role: "DOCTOR" });
    }

    if (role === "NURSE") {
      const nurse = await prisma.nurse.update({
        where: { userId },
        data: { isAvailable },
        select: { id: true, isAvailable: true, user: { select: { name: true } } },
      });
      return NextResponse.json({ profile: nurse, role: "NURSE" });
    }

    if (role === "LAB_TECHNICIAN") {
      const lab = await prisma.labTechnician.update({
        where: { userId },
        data: { isAvailable },
        select: { id: true, isAvailable: true, user: { select: { name: true } } },
      });
      return NextResponse.json({ profile: lab, role: "LAB_TECHNICIAN" });
    }

    if (role === "PHARMACIST") {
      const pharm = await prisma.pharmacist.update({
        where: { userId },
        data: { isAvailable },
        select: { id: true, isAvailable: true, user: { select: { name: true } } },
      });
      return NextResponse.json({ profile: pharm, role: "PHARMACIST" });
    }

    return NextResponse.json({ error: "Profile not found for role" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "Profile not found — ensure your staff profile is set up" }, { status: 404 });
  }
}

/**
 * GET /api/staff/availability
 * Returns the current user's availability status.
 */
export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role as string;
  const userId = session.user.id;

  try {
    if (role === "DOCTOR") {
      const doc = await prisma.doctor.findUnique({ where: { userId }, select: { isAvailable: true } });
      return NextResponse.json({ isAvailable: doc?.isAvailable ?? true });
    }
    if (role === "NURSE") {
      const nurse = await prisma.nurse.findUnique({ where: { userId }, select: { isAvailable: true } });
      return NextResponse.json({ isAvailable: nurse?.isAvailable ?? true });
    }
    if (role === "LAB_TECHNICIAN") {
      const lab = await prisma.labTechnician.findUnique({ where: { userId }, select: { isAvailable: true } });
      return NextResponse.json({ isAvailable: lab?.isAvailable ?? true });
    }
    if (role === "PHARMACIST") {
      const pharm = await prisma.pharmacist.findUnique({ where: { userId }, select: { isAvailable: true } });
      return NextResponse.json({ isAvailable: pharm?.isAvailable ?? true });
    }
    return NextResponse.json({ isAvailable: null });
  } catch {
    return NextResponse.json({ isAvailable: null });
  }
}
