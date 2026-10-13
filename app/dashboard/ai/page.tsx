import { Header } from "@/components/layout/Header";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { DoctorAIPanel } from "@/components/ai/DoctorAIPanel";
import { NurseAIPanel } from "@/components/ai/NurseAIPanel";
import { ReceptionistAIPanel } from "@/components/ai/ReceptionistAIPanel";
import { ViewOnlyAIPanel } from "@/components/ai/ViewOnlyAIPanel";

const ROLE_TITLES: Record<string, string> = {
  DOCTOR: "AI Clinical Analysis",
  NURSE: "AI Triage Assistant",
  RECEPTIONIST: "AI Document Scanner",
  LAB_TECHNICIAN: "AI Lab Report Summary",
  PHARMACIST: "AI Prescription Checker",
  ACCOUNTANT: "AI Billing Extractor",
  ADMIN: "AI Clinical Analysis",
};

export default async function AIPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const role = session?.user?.role as string ?? "PATIENT";

  const panels: Record<string, React.ReactNode> = {
    DOCTOR: <DoctorAIPanel />,
    ADMIN: <DoctorAIPanel />,
    NURSE: <NurseAIPanel />,
    RECEPTIONIST: <ReceptionistAIPanel />,
    LAB_TECHNICIAN: <ViewOnlyAIPanel type="lab_report" title="Lab Report AI Summary" description="Upload a lab report to get an AI-generated summary and flagged values." />,
    PHARMACIST: <ViewOnlyAIPanel type="prescription" title="Prescription AI Checker" description="Upload a prescription to verify medicines, dosages, and detect drug interactions." />,
    ACCOUNTANT: <ViewOnlyAIPanel type="clinical_note" title="AI Billing Extractor" description="Upload clinical notes to extract structured billing data." />,
  };

  return (
    <div>
      <Header title={ROLE_TITLES[role] ?? "AI Assistant"} />
      <div className="p-6">
        {panels[role] ?? (
          <div className="text-center py-16 text-gray-400">
            AI features are not available for your role.
          </div>
        )}
      </div>
    </div>
  );
}
