import type { LucideIcon } from "lucide-react";

export function EmptyState({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body?: string }) {
  return (
    <div className="flex flex-col items-start gap-1.5 py-6 text-muted">
      <Icon size={18} className="mb-1 text-muted" strokeWidth={1.5} />
      <p className="text-sm font-medium text-foreground">{title}</p>
      {body && <p className="text-sm text-muted">{body}</p>}
    </div>
  );
}
