import Link from "next/link";

export default function GoalsPage() {
  return (
    <main className="min-h-dvh bg-background px-5 py-6 text-foreground sm:px-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="text-sm font-medium text-muted hover:text-foreground">
            Tick
          </Link>
          <h1 className="text-xl font-semibold">Goals</h1>
        </header>
        <section className="grid gap-3 sm:grid-cols-3">
          {["Short term", "Medium term", "Long term"].map((category) => (
            <div
              key={category}
              className="min-h-32 rounded-lg border border-border bg-surface p-4 shadow-sm"
            >
              <h2 className="font-medium">{category}</h2>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}