export default function OfflinePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center bg-background">
      <div className="eq-bars scale-150 opacity-80">
        <span></span>
        <span></span>
        <span></span>
        <span></span>
      </div>
      <h1 className="text-2xl font-semibold">You&apos;re offline</h1>
      <p className="max-w-xs text-sm text-muted">
        Digital Crate Requests needs a connection to send requests, votes, and tips.
        Reconnect and we&apos;ll pick up right where you left off.
      </p>
    </main>
  );
}
