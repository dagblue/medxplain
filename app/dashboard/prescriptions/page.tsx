import { Header } from "@/components/layout/Header";
import { PrescriptionsClient } from "@/components/prescriptions/PrescriptionsClient";

export default function PrescriptionsPage() {
  return (
    <div>
      <Header title="Prescriptions" />
      <div className="p-6"><PrescriptionsClient /></div>
    </div>
  );
}
