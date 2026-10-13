import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { NextRequest, NextResponse } from "next/server";

const { GET, POST: authPOST } = toNextJsHandler(auth);

export { GET };

/**
 * Block self-registration via the Better Auth signup endpoint.
 * Only admins can create accounts (via /api/admin/create-staff).
 */
export async function POST(req: NextRequest) {
  const url = new URL(req.url);

  // Block /api/auth/sign-up/email — patient self-registration is not allowed
  if (url.pathname === "/api/auth/sign-up/email") {
    return NextResponse.json(
      {
        error: "Self-registration is disabled. Please visit the hospital reception to register.",
        code: "REGISTRATION_DISABLED",
      },
      { status: 403 }
    );
  }

  return authPOST(req);
}
