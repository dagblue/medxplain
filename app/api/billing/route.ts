import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { billSchema } from "@/lib/validations";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const patientId = searchParams.get("patientId") || "";
  const status = searchParams.get("status") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "15");
  const skip = (page - 1) * limit;

  const where: any = {};
  if (patientId) where.patientId = patientId;
  if (status) where.status = status;

  if (session.user.role === "PATIENT") {
    const patient = await prisma.patient.findUnique({ where: { userId: session.user.id } });
    if (patient) where.patientId = patient.id;
  }

  const [bills, total] = await Promise.all([
    prisma.bill.findMany({
      where, skip, take: limit, orderBy: { createdAt: "desc" },
      include: {
        patient: { select: { name: true } },
        items: true,
        payments: true,
      },
    }),
    prisma.bill.count({ where }),
  ]);

  return NextResponse.json({ bills, total, page, limit });
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "ACCOUNTANT"].includes(session.user.role as string)) {
    return NextResponse.json({ error: "Only accountants can create bills" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = billSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const items = parsed.data.items.map((item) => ({
    ...item,
    total: item.quantity * item.unitPrice,
  }));

  const subtotal = items.reduce((sum, i) => sum + i.total, 0);
  const taxPercent = parsed.data.tax || 0;       // stored as a percentage (e.g. 15 = 15%)
  const discountAmount = parsed.data.discount || 0; // stored as a flat amount
  const total = subtotal + (subtotal * taxPercent / 100) - discountAmount;

  const bill = await prisma.bill.create({
    data: {
      patientId: parsed.data.patientId,
      createdById: session.user.id,
      subtotal,
      tax: taxPercent,
      discount: discountAmount,
      total,
      notes: parsed.data.notes,
      status: "ISSUED",
      issuedAt: new Date(),
      items: { create: items },
    },
    include: { patient: { select: { name: true } }, items: true },
  });

  return NextResponse.json({ bill }, { status: 201 });
}
