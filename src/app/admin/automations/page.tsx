import { AdminComingSoon } from "@/components/admin/coming-soon";
import { Zap } from "lucide-react";

export default function AdminAutomationsPage() {
  return (
    <AdminComingSoon
      title="Automations"
      subtitle="Automatic follow-ups, reminders, and status changes."
      icon={Zap}
      body="A workflow engine for things like automatic lead follow-up emails and payment reminders isn't built yet. Contracts and payments are tracked manually today from the Projects page."
    />
  );
}
