import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

/**
 * GET /api/nurses
 * Returns all nurses with department info and real-time busy status.
 */
export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const nurses = await prisma.nurse.findMany({
    orderBy: [{ department: { name: "asc" } }, { createdAt: "asc" }],
    include: {
      user: { select: { id: true, name: true, email: true } },
      department: { select: { id: true, name: true } },
      visits: {
        where: { status: { in: ["IN_TRIAGE", "WAITING_TRIAGE"] } },
        select: { id: true, status: true },
      },
    },
  });

  const result = nurses.map((n) => ({
    id: n.id,
    ward: n.ward,
    isAvailable: n.isAvailable,
    department: n.department,
    user: n.user,
    busy: !n.isAvailable || n.visits.some((v) => v.status === "IN_TRIAGE"),
    activeVisits: n.visits.length,
  }));

  return NextResponse.json({ nurses: result });
}
