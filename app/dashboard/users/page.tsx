import { Header } from "@/components/layout/Header";
import { UsersClient } from "@/components/users/UsersClient";

export default function UsersPage() {
  return (
    <div>
      <Header title="User Management" />
      <div className="p-6">
        <UsersClient />
      </div>
    </div>
  );
}
