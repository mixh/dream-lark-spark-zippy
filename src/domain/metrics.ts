import { doctorAccounts, isBilled } from "./aging";
import { addDays, inPeriod } from "./dates";
import { linesTotal, lineAmounts, round2 } from "./money";
import { displayStatus } from "./policy";
import type { LedgerData, Order, OrderStatus, Period, ReturnOrder } from "./types";

export interface Totals {
  salesMonth: number;
  salesYear: number;
  salesTotal: number;
  inMonth: number;
  inYear: number;
  inTotal: number;
  balance: number;
  overdue: number;
}

function salesOf(
  data: LedgerData,
  today: string,
  matchOrder: (order: Order) => boolean,
  matchReturn: (ret: ReturnOrder) => boolean,
): Pick<Totals, "salesMonth" | "salesYear" | "salesTotal"> {
  const sum = (period: Period) => {
    let out = 0;
    for (const order of data.orders) {
      if (!order.billedOn || !isBilled(order.status) || !matchOrder(order)) continue;
      if (!inPeriod(order.billedOn, period, today)) continue;
      out += linesTotal(order.lines);
    }
    for (const ret of data.returns) {
      if (ret.status === "void" || !matchReturn(ret)) continue;
      if (!inPeriod(ret.createdOn, period, today)) continue;
      out -= linesTotal(ret.lines);
    }
    return round2(out);
  };
  return { salesMonth: sum("month"), salesYear: sum("year"), salesTotal: sum("all") };
}

function cashOf(
  data: LedgerData,
  today: string,
  doctorIds: Set<string> | "all",
): Pick<Totals, "inMonth" | "inYear" | "inTotal"> {
  const sum = (period: Period) =>
    round2(
      data.payments
        .filter((p) => (doctorIds === "all" || doctorIds.has(p.doctorId)) && inPeriod(p.paidOn, period, today))
        .reduce((s, p) => s + p.amount, 0),
    );
  return { inMonth: sum("month"), inYear: sum("year"), inTotal: sum("all") };
}

function bookOf(data: LedgerData, today: string, doctorIds: string[]): Pick<Totals, "balance" | "overdue"> {
  let balance = 0;
  let overdue = 0;
  for (const id of doctorIds) {
    const account = doctorAccounts(data, id, today);
    balance += account.balance;
    overdue += account.overdue;
  }
  return { balance: round2(balance), overdue: round2(overdue) };
}

export function orgTotals(data: LedgerData, today: string): Totals {
  const ids = data.doctors.map((d) => d.id);
  return {
    ...salesOf(data, today, () => true, () => true),
    ...cashOf(data, today, "all"),
    ...bookOf(data, today, ids),
  };
}

export function doctorTotals(data: LedgerData, doctorId: string, today: string): Totals {
  return {
    ...salesOf(
      data,
      today,
      (o) => o.doctorId === doctorId,
      (r) => r.doctorId === doctorId,
    ),
    ...cashOf(data, today, new Set([doctorId])),
    ...bookOf(data, today, [doctorId]),
  };
}

export function agentTotals(data: LedgerData, agentId: string, today: string): Totals {
  const book = data.doctors.filter((d) => d.agentId === agentId).map((d) => d.id);
  const bookSet = new Set(book);
  const orderAgent = (orderId: string) => data.orders.find((o) => o.id === orderId)?.agentId === agentId;
  return {
    ...salesOf(
      data,
      today,
      (o) => o.agentId === agentId,
      (r) => orderAgent(r.sourceOrderId),
    ),
    ...cashOf(data, today, bookSet),
    ...bookOf(data, today, book),
  };
}

const QUEUE_RANK: Record<OrderStatus, number> = {
  credit_hold: 0,
  approval_needed: 1,
  ready: 2,
  packed: 3,
  received: 4,
  dispatched: 5,
  at_depot: 6,
  intake: 7,
  delivered: 9,
  cancelled: 10,
};

export function workQueue(data: LedgerData, today: string) {
  return data.orders
    .map((order) => ({ order, status: displayStatus(order, data, today) }))
    .filter((row) => row.status !== "delivered" && row.status !== "cancelled")
    .sort(
      (a, b) =>
        QUEUE_RANK[a.status] - QUEUE_RANK[b.status] ||
        b.order.createdOn.localeCompare(a.order.createdOn),
    );
}

export function orderSeries(orders: Order[], today: string, days = 30) {
  const rows: { date: string; label: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = addDays(today, -i);
    const count = orders.filter((o) => o.createdOn === date && o.status !== "cancelled").length;
    rows.push({ date, label: date.slice(8), count });
  }
  return rows;
}

export function monthCounts(orders: Order[], ym: string) {
  const map = new Map<string, number>();
  for (const order of orders) {
    if (order.status === "cancelled" || !order.createdOn.startsWith(ym)) continue;
    map.set(order.createdOn, (map.get(order.createdOn) ?? 0) + 1);
  }
  return map;
}

export function mostSold(data: LedgerData, today: string, period: Period) {
  const qty = new Map<string, { qty: number; amount: number }>();
  const bump = (id: string, q: number, amount: number) => {
    const cur = qty.get(id) ?? { qty: 0, amount: 0 };
    qty.set(id, { qty: cur.qty + q, amount: round2(cur.amount + amount) });
  };
  for (const order of data.orders) {
    if (!order.billedOn || !isBilled(order.status) || !inPeriod(order.billedOn, period, today)) continue;
    for (const line of order.lines) bump(line.productId, line.qty, lineAmounts(line).total);
  }
  for (const ret of data.returns) {
    if (ret.status === "void" || !inPeriod(ret.createdOn, period, today)) continue;
    for (const line of ret.lines) bump(line.productId, -line.qty, -lineAmounts(line).total);
  }
  return [...qty.entries()]
    .map(([id, row]) => {
      const product = data.products.find((p) => p.id === id);
      return {
        id,
        title: product?.name ?? "Unknown item",
        detail: product?.pack ?? "",
        qty: row.qty,
        amount: row.amount,
      };
    })
    .filter((row) => row.qty !== 0)
    .sort((a, b) => b.qty - a.qty);
}

export function clientRanks(data: LedgerData, today: string, period: Period) {
  return data.doctors
    .map((doctor) => {
      const incoming = round2(
        data.payments
          .filter((p) => p.doctorId === doctor.id && inPeriod(p.paidOn, period, today))
          .reduce((s, p) => s + p.amount, 0),
      );
      const account = doctorAccounts(data, doctor.id, today);
      return { doctor, incoming, account };
    })
    .sort((a, b) => b.incoming - a.incoming);
}

export function agentRanks(data: LedgerData, today: string, period: Period) {
  return data.agents
    .map((agent) => {
      const totals = agentTotals(data, agent.id, today);
      const sales = period === "month" ? totals.salesMonth : period === "year" ? totals.salesYear : totals.salesTotal;
      return { agent, sales, totals };
    })
    .sort((a, b) => b.sales - a.sales);
}

export function overdueClients(data: LedgerData, today: string) {
  return data.doctors
    .map((doctor) => ({ doctor, account: doctorAccounts(data, doctor.id, today) }))
    .filter((row) => row.account.overdue >= 1)
    .sort((a, b) => b.account.overdue - a.account.overdue);
}

export function overdueAgents(data: LedgerData, today: string) {
  return data.agents
    .map((agent) => ({ agent, totals: agentTotals(data, agent.id, today) }))
    .filter((row) => row.totals.overdue >= 1)
    .sort((a, b) => b.totals.overdue - a.totals.overdue);
}

export interface StockRow {
  productId: string;
  onHand: number;
  backlog: number;
  orderedToday: number;
  receivedToday: number;
  returnedMonth: number;
}

export function stockRows(data: LedgerData, today: string): StockRow[] {
  const month = today.slice(0, 7);
  return data.products.map((product) => {
    const onHand = data.moves
      .filter((m) => m.productId === product.id)
      .reduce((s, m) => s + m.qty, 0);
    const backlog = data.orders
      .filter((o) => o.status === "at_depot")
      .flatMap((o) => o.lines)
      .filter((l) => l.productId === product.id)
      .reduce((s, l) => s + l.qty, 0);
    const orderedToday = data.orders
      .filter((o) => o.createdOn === today && o.status !== "cancelled")
      .flatMap((o) => o.lines)
      .filter((l) => l.productId === product.id)
      .reduce((s, l) => s + l.qty, 0);
    const receivedToday = data.moves
      .filter((m) => m.productId === product.id && m.on === today && m.kind === "receive")
      .reduce((s, m) => s + m.qty, 0);
    const returnedMonth = data.returns
      .filter((r) => r.status !== "void" && r.createdOn.startsWith(month))
      .flatMap((r) => r.lines)
      .filter((l) => l.productId === product.id)
      .reduce((s, l) => s + l.qty, 0);
    return { productId: product.id, onHand, backlog, orderedToday, receivedToday, returnedMonth };
  });
}

export function attentionCount(data: LedgerData, today: string): number {
  return data.orders.filter((order) => {
    const status = displayStatus(order, data, today);
    return status === "credit_hold" || status === "approval_needed" || status === "ready";
  }).length;
}
