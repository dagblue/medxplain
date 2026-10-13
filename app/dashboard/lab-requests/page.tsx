import { Header } from "@/components/layout/Header";
import { LabRequestsClient } from "@/components/lab/LabRequestsClient";

export default function LabRequestsPage() {
  return (
    <div>
      <Header title="Lab Requests" />
      <div className="p-6"><LabRequestsClient /></div>
    </div>
  );
}
