import { Header } from "@/components/layout/Header";
import { BillingClient } from "@/components/billing/BillingClient";

export default function BillingPage() {
  return (
    <div>
      <Header title="Billing & Payments" />
      <div className="p-6"><BillingClient /></div>
    </div>
  );
}
