import { Header } from "@/components/layout/Header";
import { AppointmentsClient } from "@/components/appointments/AppointmentsClient";

export default function AppointmentsPage() {
  return (
    <div>
      <Header title="Appointments" />
      <div className="p-6"><AppointmentsClient /></div>
    </div>
  );
}
