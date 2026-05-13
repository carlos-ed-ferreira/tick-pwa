export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh items-center bg-background px-5 py-10 text-foreground">
      <section className="mx-auto w-full max-w-md rounded-lg border border-border bg-surface p-5 shadow-sm">
        <p className="text-sm font-medium text-muted">Offline</p>
        <h1 className="mt-3 text-2xl font-semibold">Tick is ready locally.</h1>
        <p className="mt-3 text-base leading-7 text-muted">
          Cached routes and local data remain available while the network is
          out.
        </p>
      </section>
    </main>
  );
}
