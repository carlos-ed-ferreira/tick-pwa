import Link from "next/link";

const destinations = [
  {
    href: "/calendar",
    label: "Daily Calendar",
  },
  {
    href: "/goals",
    label: "Goals",
  },
];

export default function Home() {
  return (
    <main className="flex min-h-dvh items-center bg-background px-5 py-10 text-foreground sm:px-8">
      <section className="mx-auto flex w-full max-w-md flex-col gap-8">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Tick</h1>
          <span className="rounded-full border border-border px-3 py-1 text-sm text-muted">
            Local-first
          </span>
        </header>

        <nav aria-label="Primary" className="grid gap-3">
          {destinations.map((destination) => (
            <Link
              key={destination.href}
              href={destination.href}
              className="group flex min-h-16 items-center justify-between rounded-lg border border-border bg-surface px-4 text-lg font-medium shadow-sm transition hover:border-foreground/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
            >
              <span>{destination.label}</span>
              <span aria-hidden="true" className="text-muted transition group-hover:text-foreground">
                -&gt;
              </span>
            </Link>
          ))}
        </nav>
      </section>
    </main>
  );
}
