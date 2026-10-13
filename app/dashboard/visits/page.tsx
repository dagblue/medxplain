import { Header } from "@/components/layout/Header";
import { VisitQueueClient } from "@/components/visits/VisitQueueClient";

export default function VisitsPage() {
  return (
    <div>
      <Header title="Visit Queue" />
      <div className="p-6">
        <VisitQueueClient />
      </div>
    </div>
  );
}
