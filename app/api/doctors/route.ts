import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const skip = (page - 1) * limit;

  const where: any = search
    ? {
        OR: [
          { user: { name: { contains: search, mode: "insensitive" } } },
          { specialization: { contains: search, mode: "insensitive" } },
          { department: { name: { contains: search, mode: "insensitive" } } },
        ],
      }
    : {};

  // Filter by department
  const departmentId = searchParams.get("departmentId") || "";
  if (departmentId) {
    where.departmentId = departmentId;
  }

  const [doctors, total] = await Promise.all([
    prisma.doctor.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        department: { select: { id: true, name: true } },
        visits: {
          where: { status: "IN_CONSULTATION" },
          select: { id: true },
        },
      },
    }),
    prisma.doctor.count({ where }),
  ]);

  const result = doctors.map(({ visits, ...d }) => ({
    ...d,
    // busy = not available OR currently in a consultation
    busy: !d.isAvailable || visits.length > 0,
  }));

  return NextResponse.json({ doctors: result, total, page, limit });
}
