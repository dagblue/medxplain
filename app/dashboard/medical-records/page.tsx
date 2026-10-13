import { Header } from "@/components/layout/Header";
import { MedicalRecordsClient } from "@/components/medical-records/MedicalRecordsClient";

export default function MedicalRecordsPage() {
  return (
    <div>
      <Header title="Medical Records" />
      <div className="p-6"><MedicalRecordsClient /></div>
    </div>
  );
}
