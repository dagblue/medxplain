import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

// GET /api/doctors/available — returns all users with role=DOCTOR, with availability status
// Accessible to all authenticated roles (used by nurse workflow)
export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Query users with DOCTOR role, including their doctor profile (may be null)
  const doctorUsers = await prisma.user.findMany({
    where: { role: "DOCTOR" },
    select: {
      id: true,
      name: true,
      doctorProfile: {
        include: {
          department: { select: { id: true, name: true } },
          visits: {
            where: { status: "IN_CONSULTATION" },
            select: { id: true },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const result = doctorUsers.map((u) => {
    if (!u.doctorProfile) {
      // Profile not yet created — surface this to the admin rather than silently fixing
      return {
        id: null,
        profileMissing: true,
        user: { id: u.id, name: u.name },
        specialization: null,
        isAvailable: false,
        busy: true,
        activeVisits: 0,
        department: null,
      };
    }
    const profile = u.doctorProfile;
    const activeVisits = profile.visits?.length ?? 0;
    const isAvailable = profile.isAvailable ?? true;
    return {
      id: profile.id,
      profileMissing: false,
      specialization: profile.specialization ?? "General",
      isAvailable,
      busy: !isAvailable || activeVisits > 0,
      activeVisits,
      user: { id: u.id, name: u.name },
      department: profile.department ?? { id: "", name: "General" },
    };
  });

  return NextResponse.json({ doctors: result, total: result.length });
}
