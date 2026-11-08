/** Pure deterministic judge-demo engine. NEVER a source of real payout authorizations. */
export const MOCK_STOCK_PRICE_CENTS = 20000; // $200/mB20, NOT a live market quote
export const DAY_MS = 86_400_000;
export type PurchaseKind = 'FIRST' | 'COMEBACK';
export type ReceiptStatus = 'DELIVERED' | 'BLOCKED' | 'REFUNDED';
export type DemoReceipt = {
  id: string;
  customerId: string;
  orderId: string;
  kind: PurchaseKind;
  orderCents: number;
  rewardCents: number;
  stockUnits: number;
  timestamp: number;
  status: ReceiptStatus;
  steps: string[];
  reason?: string;
};
export type DemoState = {
  budgetCents: number;
  spentCents: number;
  firstBps: number;
  repeatBps: number;
  maxRewardCents: number;
  windowMs: number;
  paused: boolean;
  now: number;
  orders: DemoReceipt[];
  initialCustomers: number;
  initialReturning: number;
  initialSpentCents: number;
  initialDelivered: number;
};
export const initialDemoState: DemoState = {
  budgetCents: 250000,
  spentCents: 0,
  firstBps: 200,
  repeatBps: 500,
  maxRewardCents: 1000,
  windowMs: 7 * DAY_MS,
  paused: false,
  now: Date.UTC(2026, 10, 6, 12),
  orders: [],
  initialCustomers: 0,
  initialReturning: 0,
  initialSpentCents: 0,
  initialDelivered: 0,
};
export function cents(n: number): number {
  if (!Number.isFinite(n)) throw new Error('Amount must be finite');
  return Math.round(n * 100);
}
export function dollars(n: number): string {
  return (n / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}
export function getCustomerReceipts(s: DemoState, customerId: string) {
  return s.orders.filter(
    (o) => o.customerId === customerId && (o.status === 'DELIVERED' || o.status === 'REFUNDED'),
  );
}
export function validOrderId(id: string) {
  return /^[A-Za-z0-9_-]{3,70}$/.test(id);
}
export type PurchaseInput = {
  customerId: string;
  orderId: string;
  orderCents: number;
  timestamp?: number;
  refunded?: boolean;
  attemptKind?: PurchaseKind;
};
export function evaluatePurchase(
  s: DemoState,
  input: PurchaseInput,
): { next: DemoState; receipt: DemoReceipt } {
  const t = input.timestamp ?? s.now;
  const seen = s.orders.some((o) => o.orderId === input.orderId);
  const history = getCustomerReceipts(s, input.customerId).sort((a, b) => a.timestamp - b.timestamp);
  const first = history.find((o) => o.kind === 'FIRST');
  const repeat = history.find((o) => o.kind === 'COMEBACK');
  const kind: PurchaseKind = input.attemptKind ?? (first ? 'COMEBACK' : 'FIRST');
  const bps = kind === 'FIRST' ? s.firstBps : s.repeatBps;
  const reward = Math.min(s.maxRewardCents, Math.floor((input.orderCents * bps) / 10000));
  let reason = '';
  if (!validOrderId(input.orderId) || !validOrderId(input.customerId))
    reason = 'Invalid customer or order identifier';
  else if (seen) reason = 'Duplicate order identifier';
  else if (!Number.isSafeInteger(input.orderCents) || input.orderCents <= 0)
    reason = 'Invalid purchase amount';
  else if (!Number.isSafeInteger(t) || t > s.now || t < 0) reason = 'Purchase timestamp invalid';
  else if (s.paused) reason = 'Merchant campaign is paused';
  else if (input.refunded) reason = 'Refunded orders are ineligible';
  else if (kind === 'COMEBACK' && !first) reason = 'First purchase required before comeback';
  else if (kind === 'FIRST' && first) reason = 'Customer already earned first-purchase reward';
  else if (first && repeat) reason = 'Comeback bonus already claimed';
  else if (first && (t <= first.timestamp || t > first.timestamp + s.windowMs))
    reason = 'Outside seven-day comeback window';
  else if (reward < 1) reason = 'Reward rounds below one cent';
  else if (s.spentCents + s.initialSpentCents + reward > s.budgetCents)
    reason = 'Insufficient merchant vault budget';
  // 1 simulated mB20 token = $200; stock base units use 8 decimals like the testnet ERC-20
  const stockUnits = reason ? 0 : Math.floor((reward * 100_000_000) / MOCK_STOCK_PRICE_CENTS);
  const receipt: DemoReceipt = {
    id: `evt-${s.orders.length + 1}`,
    customerId: input.customerId,
    orderId: input.orderId,
    kind,
    orderCents: input.orderCents,
    rewardCents: reason ? 0 : reward,
    stockUnits,
    timestamp: t,
    status: reason ? 'BLOCKED' : 'DELIVERED',
    reason: reason || undefined,
    steps: reason
      ? ['Mock checkout received', 'Policy rejected: ' + reason]
      : [
          'Mock order verified',
          'Eligibility: demo-only',
          'USDC budget reserved',
          'Mock stock delivered',
          'Demo receipt recorded',
        ],
  };
  return {
    next: { ...s, spentCents: s.spentCents + (reason ? 0 : reward), orders: [receipt, ...s.orders] },
    receipt,
  };
}
export function refundPurchase(s: DemoState, orderId: string): { next: DemoState; message: string } {
  const found = s.orders.find((o) => o.orderId === orderId);
  if (!found) return { next: s, message: 'Order not found' };
  if (found.status === 'BLOCKED') return { next: s, message: 'Order was already blocked' };
  if (found.status === 'REFUNDED') return { next: s, message: 'Already refunded' };
  // Historical delivered rewards remain visible; a real post-payout refund requires exception handling.
  return {
    next: {
      ...s,
      orders: s.orders.map((o) =>
        o.orderId === orderId
          ? { ...o, status: 'REFUNDED', steps: [...o.steps, 'Refund detected after demo delivery'] }
          : o,
      ),
    },
    message: 'Refund flagged; post-payout exception opened',
  };
}
export function metrics(s: DemoState) {
  const delivered = s.orders.filter((o) => o.status === 'DELIVERED' || o.status === 'REFUNDED');
  const unique = new Set(delivered.map((o) => o.customerId));
  const returning = new Set(delivered.filter((o) => o.kind === 'COMEBACK').map((o) => o.customerId));
  const totalCustomers = s.initialCustomers + unique.size;
  const totalReturning = s.initialReturning + returning.size;
  return {
    spentCents: s.spentCents + s.initialSpentCents,
    budgetCents: s.budgetCents,
    remainingCents: Math.max(0, s.budgetCents - s.spentCents - s.initialSpentCents),
    delivered: s.initialDelivered + delivered.length,
    uniqueCustomers: totalCustomers,
    returningCustomers: totalReturning,
    repeatRate: totalCustomers ? totalReturning / totalCustomers : 0,
    customerAcquisitionCount: unique.size,
    costPerReturnCents: totalReturning
      ? Math.round((s.spentCents + s.initialSpentCents) / totalReturning)
      : null,
  };
}
export function stockTokens(stockUnits: number) {
  return (stockUnits / 100_000_000).toFixed(6);
}
