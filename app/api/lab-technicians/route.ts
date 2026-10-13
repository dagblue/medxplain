import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

/**
 * GET /api/lab-technicians
 * Returns all lab technicians with availability status.
 * A lab tech is busy if they have IN_PROGRESS lab results today.
 */
export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date(); today.setHours(0, 0, 0, 0);

  const techs = await prisma.labTechnician.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { id: true, name: true, email: true } },
      labResults: {
        where: { createdAt: { gte: today } },
        select: { id: true },
      },
    },
  });

  const result = techs.map((t) => ({
    id: t.id,
    isAvailable: t.isAvailable,
    user: t.user,
    busy: !t.isAvailable,
    resultsToday: t.labResults.length,
  }));

  return NextResponse.json({ technicians: result });
}
