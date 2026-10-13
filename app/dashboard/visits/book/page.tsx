import { Header } from "@/components/layout/Header";
import { BookVisitClient } from "@/components/visits/BookVisitClient";

export default function BookVisitPage() {
  return (
    <div>
      <Header title="Book a Visit" />
      <div className="p-6">
        <BookVisitClient />
      </div>
    </div>
  );
}
