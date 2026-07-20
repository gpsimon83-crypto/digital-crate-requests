export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-4 border-b border-black/8 bg-[linear-gradient(180deg,rgba(33,31,26,0.015),rgba(255,255,255,0))] px-6 py-6 sm:px-8">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
