'use client';

import { useEffect, useState } from 'react';
import type { LocalDateString } from '@/lib/domain';
import { getTodayKey } from '@/lib/time';

const TODAY_REFRESH_INTERVAL_MS = 60_000;

export function useTodayKey(timezone: string): LocalDateString {
  const [today, setToday] = useState(() => getTodayKey(timezone));

  useEffect(() => {
    const refresh = () => setToday(getTodayKey(timezone));
    const interval = window.setInterval(refresh, TODAY_REFRESH_INTERVAL_MS);

    refresh();
    document.addEventListener('visibilitychange', refresh);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [timezone]);

  return today;
}
