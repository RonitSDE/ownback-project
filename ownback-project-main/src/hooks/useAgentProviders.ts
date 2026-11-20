'use client';

import { useEffect, useState } from 'react';
import type { AgentProviderId, AgentStatusResponse, ProviderStatus } from '@/lib/bankr/agent-actions';

/**
 * Which agent providers this deployment offers. The direct (own-wallet) path is always present;
 * Bankr appears only when the server has a key and the key authenticates.
 */
export function useAgentProviders() {
  const [providers, setProviders] = useState<ProviderStatus[]>([
    {
      id: 'direct',
      label: 'Your wallet',
      available: true,
      detail: 'You sign each action in your own wallet.',
    },
    { id: 'bankr', label: 'Bankr agent', available: false, detail: 'Checking…' },
  ]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch('/api/agent/status', { signal: ctrl.signal })
      .then((r) => r.json() as Promise<AgentStatusResponse>)
      .then((body) => body.providers?.length && setProviders(body.providers))
      .catch(() => undefined) // leave the safe defaults in place
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, []);

  const bankr = providers.find((p) => p.id === 'bankr');
  return { providers, loading, bankrAvailable: Boolean(bankr?.available), bankrDetail: bankr?.detail };
}

export type { AgentProviderId };
