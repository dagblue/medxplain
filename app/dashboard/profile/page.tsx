import { Header } from "@/components/layout/Header";
import { ProfileClient } from "@/components/profile/ProfileClient";

export default function ProfilePage() {
  return (
    <div>
      <Header title="My Profile" />
      <div className="p-6">
        <ProfileClient />
      </div>
    </div>
  );
}
