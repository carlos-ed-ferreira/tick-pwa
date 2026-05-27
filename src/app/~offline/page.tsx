import { Text } from '@/components/ui';

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh items-center bg-background px-5 py-10 text-foreground">
      <section className="mx-auto w-full max-w-md rounded-lg border border-border bg-surface p-5 shadow-sm">
        <Text tone="muted" weight="medium">
          Offline
        </Text>
        <h1 className="mt-3 text-2xl font-semibold">Tick is ready locally.</h1>
        <Text className="mt-3" leading="loose" size="base" tone="muted">
          Cached routes and local data remain available while the network is
          out.
        </Text>
      </section>
    </main>
  );
}
