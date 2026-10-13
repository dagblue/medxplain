import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Prisma 6 removed $use middleware. Retry logic is now handled per-call
 * via withRetry(). The client is a plain singleton.
 */
function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * Retry a Prisma operation on Neon cold-start connection errors.
 * Neon free tier suspends after ~5 min idle — first request may fail, retry succeeds.
 *
 * Usage: const result = await withRetry(() => prisma.user.findMany());
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 2000
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      const isConnErr =
        e?.message?.includes("Can't reach database") ||
        e?.message?.includes("Connection refused") ||
        e?.message?.includes("ECONNREFUSED") ||
        e?.errorCode === "P1001" ||
        e?.code === "P1001";

      if (isConnErr && i < retries - 1) {
        console.warn(
          `[Prisma] DB connection failed, retrying in ${delayMs}ms... (attempt ${i + 1}/${retries})`
        );
        await new Promise((r) => setTimeout(r, delayMs));
        await prisma.$disconnect().catch(() => {});
        continue;
      }
      throw e;
    }
  }
  throw new Error("Max retries exceeded");
}
