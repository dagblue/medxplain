import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { dischargeSchema } from "@/lib/validations";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "DOCTOR"].includes(session.user.role as string)) {
    return NextResponse.json({ error: "Only doctors can discharge patients" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = dischargeSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const doctor = await prisma.doctor.findUnique({ where: { userId: session.user.id } });
  if (!doctor) return NextResponse.json({ error: "Doctor profile not found" }, { status: 404 });

  const [discharge] = await prisma.$transaction([
    prisma.discharge.create({
      data: {
        patientId: parsed.data.patientId,
        doctorId: doctor.id,
        dischargeNotes: parsed.data.dischargeNotes,
        followUpDate: parsed.data.followUpDate ? new Date(parsed.data.followUpDate) : undefined,
      },
    }),
    prisma.patient.update({ where: { id: parsed.data.patientId }, data: { status: "DISCHARGED" } }),
  ]);

  return NextResponse.json({ discharge }, { status: 201 });
}
