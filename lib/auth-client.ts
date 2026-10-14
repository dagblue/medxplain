import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import type { auth } from "@/lib/auth";

export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined"
    ? window.location.origin
    : process.env.BETTER_AUTH_URL || "http://localhost:3000",
  plugins: [inferAdditionalFields<typeof auth>()],
});

export const {
  signIn,
  signOut,
  signUp,
  useSession,
  getSession,
} = authClient;
