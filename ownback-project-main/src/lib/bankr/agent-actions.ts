/**
 * Agent actions: the "settle my reward" and "borrow against my position" steps, behind one
 * interface with two providers.
 *
 *  - DIRECT (default, always available): the user's own wallet sends the transaction. This is the
 *    path the shop already uses and needs no third party. Borrowing opens the lending venue.
 *  - BANKR (optional): the user's Bankr agent executes by natural language. Lights up only when a
 *    Bankr key is configured, so the UX ships working today and upgrades when credentials land.
 *
 * The provider is chosen per request, so a judge can switch between them live.
 */
import type { JobResponse } from './client';

export type AgentProviderId = 'direct' | 'bankr';

export type borrowOutcome = {
  provider: AgentProviderId;
  ok: boolean;
  /** For DIRECT: the lending venue to open. For BANKR: undefined (the agent did it). */
  openUrl?: string;
  /** For BANKR: the resulting transaction hash, when the job reported one. */
  transactionHash?: string;
  message: string;
};

export type ProviderStatus = {
  id: AgentProviderId;
  label: string;
  available: boolean;
  /** Why it's unavailable, for the UI. */
  detail: string;
};

/** Shape the /api/agent/status route returns. */
export type AgentStatusResponse = { providers: ProviderStatus[] };

/** Map a Bankr job result to a user-facing outcome. */
export function bankrJobToOutcome(job: JobResponse): borrowOutcome {
  return {
    provider: 'bankr',
    ok: false,
    transactionHash: job.transactionHash,
    message:
      job.status === 'completed'
        ? 'Bankr finished its analysis; no loan is considered open without an independently verified onchain debt position.'
        : (job.error ?? 'Bankr could not complete the borrow.'),
  };
}
