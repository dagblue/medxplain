import { Header } from "@/components/layout/Header";
import { ReportsClient } from "@/components/reports/ReportsClient";

export default function ReportsPage() {
  return (
    <div>
      <Header title="Lab Reports" />
      <div className="p-6">
        <ReportsClient />
      </div>
    </div>
  );
}
