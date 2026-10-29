import { daysBetween } from "./dates";
import { linesTotal, round2 } from "./money";
import type { LedgerData, OrderStatus } from "./types";

export function isBilled(status: OrderStatus): boolean {
  return (
    status === "at_depot" ||
    status === "received" ||
    status === "packed" ||
    status === "dispatched" ||
    status === "delivered"
  );
}

export interface Account {
  balance: number;
  overdue: number;
  oldestDays: number | null;
  invoiceCount: number;
}

/**
 * Payments and return credits clear the oldest open bill first.
 * Overdue is whatever is still open on bills older than the mandate.
 */
export function doctorAccounts(data: LedgerData, doctorId: string, today: string): Account {
  const threshold = data.settings.overdueDays;
  const open = data.orders
    .filter((o) => o.doctorId === doctorId && o.billedOn && isBilled(o.status))
    .map((o) => ({ date: o.billedOn as string, remaining: linesTotal(o.lines) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  let pool = round2(
    data.payments
      .filter((p) => p.doctorId === doctorId)
      .reduce((sum, p) => sum + p.amount, 0) +
      data.returns
        .filter((r) => r.doctorId === doctorId && r.status !== "void")
        .reduce((sum, r) => sum + linesTotal(r.lines), 0),
  );

  for (const item of open) {
    if (pool <= 0) break;
    const applied = Math.min(item.remaining, pool);
    item.remaining = round2(item.remaining - applied);
    pool = round2(pool - applied);
  }

  const balance = round2(open.reduce((sum, item) => sum + item.remaining, 0) - Math.max(pool, 0));
  const overdue = round2(
    open
      .filter((item) => daysBetween(item.date, today) > threshold && item.remaining >= 1)
      .reduce((sum, item) => sum + item.remaining, 0),
  );
  const oldest = open
    .filter((item) => item.remaining >= 1)
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  return {
    balance,
    overdue,
    oldestDays: oldest ? daysBetween(oldest.date, today) : null,
    invoiceCount: open.length,
  };
}
