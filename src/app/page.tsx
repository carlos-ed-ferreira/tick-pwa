'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthGate } from '@/features/auth';

function RedirectToCalendar() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/calendar');
  }, [router]);

  return null;
}

export default function Home() {
  return (
    <AuthGate>
      <RedirectToCalendar />
    </AuthGate>
  );
}
