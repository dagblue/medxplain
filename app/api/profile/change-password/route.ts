import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { currentPassword, newPassword } = body;

  if (!newPassword || newPassword.length < 6) {
    return NextResponse.json({ error: "New password must be at least 6 characters" }, { status: 400 });
  }

  // Use Better Auth to verify current password and change it
  try {
    await auth.api.changePassword({
      body: {
        currentPassword,
        newPassword,
        revokeOtherSessions: false,
      },
      headers: await headers(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Current password is incorrect" },
      { status: 400 }
    );
  }

  // Clear the mustChangePassword flag
  await prisma.user.update({
    where: { id: session.user.id },
    data: { mustChangePassword: false },
  });

  return NextResponse.json({ success: true });
}
