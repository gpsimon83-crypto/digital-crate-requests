import { AdminComingSoon } from "@/components/admin/coming-soon";
import { FolderOpen } from "lucide-react";

export default function AdminFilesPage() {
  return (
    <AdminComingSoon
      title="Files"
      subtitle="Contracts, invoices, and client documents in one place."
      icon={FolderOpen}
      body="Centralized file storage isn't wired up yet. Contract documents are currently linked by URL from each event's Projects page."
    />
  );
}
