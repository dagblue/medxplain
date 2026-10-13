import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { Header } from "@/components/layout/Header";
import {
  AdminDashboard, ReceptionistDashboard, DoctorDashboard,
  NurseDashboard, LabTechDashboard, PharmacistDashboard,
  AccountantDashboard, PatientDashboard,
} from "@/components/dashboard/RoleDashboard";

const DASHBOARDS: Record<string, React.ReactNode> = {
  ADMIN: <AdminDashboard />,
  RECEPTIONIST: <ReceptionistDashboard />,
  DOCTOR: <DoctorDashboard />,
  NURSE: <NurseDashboard />,
  LAB_TECHNICIAN: <LabTechDashboard />,
  PHARMACIST: <PharmacistDashboard />,
  ACCOUNTANT: <AccountantDashboard />,
  PATIENT: <PatientDashboard />,
};

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const role = session?.user?.role as string ?? "PATIENT";
  const name = session?.user?.name ?? "";

  return (
    <div>
      <Header title={`Welcome back, ${name.split(" ")[0]} 👋`} />
      <div className="p-6">
        {DASHBOARDS[role] ?? <PatientDashboard />}
      </div>
    </div>
  );
}
