import { Header } from "@/components/layout/Header";
import { PatientsClient } from "@/components/patients/PatientsClient";

export default function PatientsPage() {
  return (
    <div>
      <Header title="Patients" />
      <div className="p-6"><PatientsClient /></div>
    </div>
  );
}
