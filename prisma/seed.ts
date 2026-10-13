import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Seed departments
  const departments = [
    { name: "Cardiology", description: "Heart and cardiovascular care" },
    { name: "Neurology", description: "Brain and nervous system" },
    { name: "Emergency", description: "Emergency and trauma care" },
    { name: "Radiology", description: "Imaging and diagnostics" },
    { name: "Laboratory", description: "Lab tests and analysis" },
  ];

  const createdDepts: Record<string, string> = {};

  for (const dept of departments) {
    const d = await prisma.department.upsert({
      where: { name: dept.name },
      update: {},
      create: dept,
    });
    createdDepts[dept.name] = d.id;
  }

  console.log("✅ Departments seeded");

  // Note: To create users with Better Auth, use the /api/auth/sign-up/email endpoint
  // or use the auth.api.signUpEmail method in a script.
  // Demo credentials are shown on the login page.

  console.log("✅ Seed complete!");
  console.log("");
  console.log("📋 Next steps:");
  console.log("   1. Start the app: npm run dev");
  console.log("   2. Visit http://localhost:3000/login");
  console.log("   3. Create your first admin user via the API:");
  console.log("      POST /api/auth/sign-up/email");
  console.log("      { name, email, password }");
  console.log("   4. Then update the role to ADMIN in Prisma Studio:");
  console.log("      npm run db:studio");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
