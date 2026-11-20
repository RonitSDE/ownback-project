'use client';

import { useEffect } from 'react';

// Hides the Farcaster/Base App splash screen once the app has mounted.
// Outside a Mini App host this is a harmless no-op.
export function MiniAppReady() {
  useEffect(() => {
    import('@farcaster/miniapp-sdk')
      .then(({ sdk }) => sdk.actions.ready())
      .catch(() => {});
  }, []);
  return null;
}
