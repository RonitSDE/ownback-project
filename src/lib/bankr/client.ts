/**
 * Bankr Agent API client — the server-side half of OWNBACK's agent actions.
 *
 * Built against Bankr's public API (api.bankr.bot): the async /agent/prompt -> /agent/job/{id}
 * polling flow and the synchronous /wallet/submit endpoint, both authenticated with X-API-Key.
 * Reference: github.com/BankrBot/skills, docs.bankr.bot/agent-api, docs.bankr.bot/wallet-api.
 *
 * VERIFY BEFORE DEMO: run `npm run bankr:check` with a real bk_ key to confirm the endpoint
 * shapes still match. Bankr evolves; this client fails loud rather than inventing success.
 */

export const BANKR_BASE_URL = process.env.BANKR_API_URL ?? 'https://api.bankr.bot';

export type BankrConfig = { apiKey: string; baseUrl?: string; timeoutMs?: number };

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export type PromptResponse = { jobId: string; status?: JobStatus };

export type JobResponse = {
  jobId: string;
  status: JobStatus;
  result?: unknown;
  response?: string;
  richData?: unknown;
  transactionHash?: string;
  error?: string;
};

export type SubmitResponse = {
  success: boolean;
  transactionHash?: string;
  status?: 'success' | 'reverted' | 'pending';
  blockNumber?: string;
  error?: string;
};

export class BankrError extends Error {
  readonly status?: number;
  readonly needsKey: boolean;

  constructor(message: string, status?: number, needsKey = false) {
    super(message);
    this.name = 'BankrError';
    this.status = status;
    this.needsKey = needsKey;
  }
}

type RawTransaction = { to: string; chainId: number; value?: string; data?: string };

/**
 * Thin, typed wrapper. Normalises the field styles Bankr's surfaces use (jobId vs job_id) so
 * callers get one stable shape. Never throws a bare fetch error: everything becomes a BankrError
 * with an HTTP status so the UI can tell "no key" from "Bankr is down".
 */
export class BankrClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config: BankrConfig) {
    if (!config.apiKey) throw new BankrError('Missing Bankr API key', 401, true);
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? BANKR_BASE_URL).replace(/\/$/, '');
    this.timeoutMs = config.timeoutMs ?? 30_000;
  }

  private async call<T>(path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          'X-API-Key': this.apiKey,
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      throw new BankrError(
        (err as Error).name === 'AbortError' ? 'Bankr request timed out' : 'Could not reach Bankr',
      );
    } finally {
      clearTimeout(timer);
    }

    const text = await res.text();
    const json = text ? safeJson(text) : {};
    if (!res.ok) {
      const message = (json as { error?: string }).error ?? `Bankr returned ${res.status}`;
      throw new BankrError(
        message,
        res.status,
        res.status === 401 || res.status === 403 || res.status === 503,
      );
    }
    return json as T;
  }

  /** GET /wallet/me — current Bankr wallet authentication probe. */
  async me(): Promise<{ address?: string }> {
    return this.call('/wallet/me');
  }

  /** POST /agent/prompt — queue a natural-language action, returns a job id. */
  async prompt(prompt: string): Promise<PromptResponse> {
    const raw = await this.call<Record<string, unknown>>('/agent/prompt', { prompt });
    const jobId = (raw.jobId ?? raw.job_id) as string | undefined;
    if (!jobId) throw new BankrError('Bankr did not return a job id');
    return { jobId, status: raw.status as JobStatus | undefined };
  }

  /** GET /agent/job/{id} — one status read. */
  async job(jobId: string): Promise<JobResponse> {
    const raw = await this.call<Record<string, unknown>>(`/agent/job/${encodeURIComponent(jobId)}`);
    return {
      jobId: (raw.jobId ?? raw.job_id ?? jobId) as string,
      status: (raw.status ?? 'pending') as JobStatus,
      result: raw.result,
      response: typeof raw.response === 'string' ? raw.response : undefined,
      richData: raw.richData,
      transactionHash: (raw.transactionHash ?? raw.transaction_hash) as string | undefined,
      error: raw.error as string | undefined,
    };
  }

  /** Poll a job to a terminal state. Mirrors Bankr's own 2s / 60-attempt defaults. */
  async waitForJob(jobId: string, intervalMs = 2_000, maxAttempts = 60): Promise<JobResponse> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const job = await this.job(jobId);
      if (job.status === 'completed') return job;
      if (job.status === 'failed') throw new BankrError(job.error ?? 'Bankr job failed');
      if (job.status === 'cancelled') throw new BankrError('Bankr job was cancelled');
      if (attempt < maxAttempts) await sleep(intervalMs);
    }
    throw new BankrError('Bankr job did not finish in time');
  }

  /** POST /agent/prompt then poll — the common case. */
  async run(prompt: string): Promise<JobResponse> {
    const { jobId } = await this.prompt(prompt);
    return this.waitForJob(jobId);
  }

  /** POST /wallet/submit — broadcast a pre-built transaction from the Bankr wallet. */
  async submit(transaction: RawTransaction, description?: string): Promise<SubmitResponse> {
    return this.call('/wallet/submit', { transaction, description, waitForConfirmation: true });
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { error: text.slice(0, 200) };
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
