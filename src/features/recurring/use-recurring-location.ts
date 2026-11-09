'use client';

import { useCallback, useEffect, useState } from 'react';
import type { RecurringView } from './recurring-view-tabs';

export interface RecurringLocation {
  activityId: string | null;
  view: RecurringView;
}

const views: readonly RecurringView[] = [
  'execute',
  'activities',
  'performance',
];

function readLocation(): RecurringLocation {
  if (typeof window === 'undefined') {
    return { activityId: null, view: 'execute' };
  }

  const params = new URLSearchParams(window.location.search);
  const view = params.get('view');
  const resolvedView = views.find((candidate) => candidate === view);

  return {
    activityId: resolvedView === 'performance' ? params.get('activity') : null,
    view: resolvedView ?? 'execute',
  };
}

function writeLocation({ activityId, view }: RecurringLocation) {
  const params = new URLSearchParams(window.location.search);

  params.delete('view');
  params.delete('activity');

  if (view !== 'execute') {
    params.set('view', view);
  }

  if (activityId) {
    params.set('activity', activityId);
  }

  const query = params.toString();

  window.history.pushState(
    null,
    '',
    `${window.location.pathname}${query ? `?${query}` : ''}`,
  );
}

export function useRecurringLocation() {
  const [location, setLocation] = useState<RecurringLocation>(readLocation);

  useEffect(() => {
    const syncLocation = () => setLocation(readLocation());

    window.addEventListener('popstate', syncLocation);

    return () => window.removeEventListener('popstate', syncLocation);
  }, []);

  const navigate = useCallback((next: RecurringLocation) => {
    setLocation(next);
    writeLocation(next);
  }, []);

  return { location, navigate };
}
