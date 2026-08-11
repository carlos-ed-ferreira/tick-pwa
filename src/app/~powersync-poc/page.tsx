import { AuthGate } from '@/features/auth';
import { PowerSyncPocSurface } from '@/features/powersync-poc/powersync-poc-surface';

export default function PowerSyncPocPage() {
  return (
    <AuthGate>
      <PowerSyncPocSurface />
    </AuthGate>
  );
}
