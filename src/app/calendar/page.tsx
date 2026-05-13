import Link from 'next/link';

export default function CalendarPage() {
  return (
    <main className="min-h-dvh bg-background px-5 py-6 text-foreground sm:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="text-sm font-medium text-muted hover:text-foreground"
          >
            Tick
          </Link>
          <h1 className="text-xl font-semibold">Daily Calendar</h1>
        </header>
        <section className="min-h-[60vh] rounded-lg border border-border bg-surface shadow-sm" />
      </div>
    </main>
  );
}
