import { AdminComingSoon } from "@/components/admin/coming-soon";
import { Sparkles } from "lucide-react";

export default function AdminServicesPage() {
  return (
    <AdminComingSoon
      title="Services"
      subtitle="Your bookable packages and add-ons."
      icon={Sparkles}
      body="A catalog of standard service packages (wedding DJ, corporate, add-on lighting, etc.) isn't built yet — pricing today is set per-event from the Projects page."
    />
  );
}
