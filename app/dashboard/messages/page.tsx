import { Header } from "@/components/layout/Header";
import { MessagesClient } from "@/components/messages/MessagesClient";

export default function MessagesPage() {
  return (
    <div className="flex flex-col h-screen">
      <Header title="Messages" />
      <div className="flex-1 overflow-hidden p-6">
        <MessagesClient />
      </div>
    </div>
  );
}
