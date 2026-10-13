import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { Header } from "@/components/layout/Header";
import { DoctorsClient } from "@/components/doctors/DoctorsClient";
import { FindDoctors } from "@/components/doctors/FindDoctors";

export default async function DoctorsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const role = session?.user?.role as string;

  return (
    <div>
      <Header title={role === "PATIENT" ? "Find Doctors" : "Doctors"} />
      <div className="p-6">
        {role === "PATIENT" ? <FindDoctors /> : <DoctorsClient />}
      </div>
    </div>
  );
}
