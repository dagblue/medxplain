import { Header } from "@/components/layout/Header";
import { VitalsClient } from "@/components/vitals/VitalsClient";

export default function VitalsPage() {
  return (
    <div>
      <Header title="Patient Vitals" />
      <div className="p-6"><VitalsClient /></div>
    </div>
  );
}
