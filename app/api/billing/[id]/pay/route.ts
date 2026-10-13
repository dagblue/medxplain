import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { paymentSchema } from "@/lib/validations";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "ACCOUNTANT"].includes(session.user.role as string)) {
    return NextResponse.json({ error: "Only accountants can record payments" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = paymentSchema.safeParse({ ...body, billId: id });
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const bill = await prisma.bill.findUnique({ where: { id }, include: { payments: true } });
  if (!bill) return NextResponse.json({ error: "Bill not found" }, { status: 404 });

  const totalPaid = bill.payments.reduce((s, p) => s + p.amount, 0) + parsed.data.amount;
  const newStatus = totalPaid >= bill.total ? "PAID" : "PARTIALLY_PAID";

  const [payment] = await prisma.$transaction([
    prisma.payment.create({
      data: {
        billId: id,
        amount: parsed.data.amount,
        method: parsed.data.method,
        reference: parsed.data.reference,
        notes: parsed.data.notes,
      },
    }),
    prisma.bill.update({ where: { id }, data: { status: newStatus } }),
  ]);

  return NextResponse.json({ payment, status: newStatus }, { status: 201 });
}
