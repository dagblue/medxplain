import { Header } from "@/components/layout/Header";
import { DepartmentsClient } from "@/components/departments/DepartmentsClient";

export default function DepartmentsPage() {
  return (
    <div>
      <Header title="Departments" />
      <div className="p-6">
        <DepartmentsClient />
      </div>
    </div>
  );
}
