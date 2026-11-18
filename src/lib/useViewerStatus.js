'use client';

import { useEffect, useState } from 'react';
import { authClient } from './auth/client.js';

// One /api/me request per signed-in user per page load, shared by every component that asks.
let cache = null; // { userId, promise }

function fetchStatus(userId) {
  if (!cache || cache.userId !== userId) {
    cache = {
      userId,
      promise: fetch('/api/me', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : { registered: false }))
        .catch(() => ({ registered: false })),
    };
  }
  return cache.promise;
}

// { pending, signedIn, registered, home } for the current visitor (home: '/judge', '/admin', … or null). Until the session and team lookup answer,
// signedIn/registered are false, so callers show the signed-out state and then update.
export function useViewerStatus() {
  const { data, isPending } = authClient.useSession();
  const userId = data?.user?.id ?? null;
  const [team, setTeam] = useState({ userId: null, registered: null, home: null });

  useEffect(() => {
    if (!userId) return undefined;
    let live = true;
    fetchStatus(userId).then((d) => live && setTeam({ userId, registered: Boolean(d.registered), home: d.home ?? null }));
    return () => { live = false; };
  }, [userId]);

  const registered = userId && team.userId === userId ? team.registered : null;
  return {
    pending: isPending || (Boolean(userId) && registered === null),
    signedIn: Boolean(userId),
    registered: Boolean(registered),
    home: userId && team.userId === userId ? team.home : null,
  };
}
