import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/layout/Sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/login");
  }

  // Check if staff must change their admin-set password
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { mustChangePassword: true },
  });

  if (user?.mustChangePassword) {
    redirect("/change-password");
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar userRole={session.user.role as string} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
