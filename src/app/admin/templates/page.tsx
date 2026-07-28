import { AdminComingSoon } from "@/components/admin/coming-soon";
import { FileStack } from "lucide-react";

export default function AdminTemplatesPage() {
  return (
    <AdminComingSoon
      title="Templates"
      subtitle="Reusable contracts, emails, and questionnaires."
      icon={FileStack}
      body="A template editor for contracts and email replies isn't built yet. Crate (music) templates already exist under CratesDJ Operations → Crate Templates."
    />
  );
}
