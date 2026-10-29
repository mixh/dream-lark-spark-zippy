import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { formatDate, monthCells, monthKey, monthLabel, shiftMonth, todayIso } from "@/domain/dates";
import { monthCounts } from "@/domain/metrics";
import { formatMoney, linesTotal } from "@/domain/money";
import { displayStatus } from "@/domain/policy";
import type { OrderStatus } from "@/domain/types";
import { useLedger } from "@/store/ledger";
import { Button } from "@/components/ui";
import { EmptyNote, PageHeader, StatusPill } from "@/components/bits";
import { cn } from "@/lib/cn";

const WEEK = ["M", "T", "W", "T", "F", "S", "S"];

const FILTERS: { id: string; label: string; match: (status: OrderStatus) => boolean }[] = [
  { id: "all", label: "All", match: () => true },
  {
    id: "needs",
    label: "Needs you",
    match: (status) => status === "credit_hold" || status === "approval_needed" || status === "ready",
  },
  { id: "depot", label: "With depot", match: (status) => status === "at_depot" },
  { id: "house", label: "In the office", match: (status) => status === "received" || status === "packed" },
  { id: "out", label: "Out", match: (status) => status === "dispatched" },
  { id: "done", label: "Delivered", match: (status) => status === "delivered" },
];

export function OrdersPage() {
  const data = useLedger();
  const today = todayIso();
  const [month, setMonth] = useState(() => monthKey(today));
  const [day, setDay] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const counts = useMemo(() => monthCounts(data.orders, month), [data.orders, month]);
  const cells = monthCells(month);
  const active = FILTERS.find((item) => item.id === filter) ?? FILTERS[0];
  const needle = query.trim().toLowerCase();

  const rows = data.orders.filter((order) => {
    const status = displayStatus(order, data, today);
    if (status === "cancelled") return false;
    if (!active?.match(status)) return false;
    if (day && order.createdOn !== day) return false;
    if (!needle) return true;
    const doctor = data.doctors.find((item) => item.id === order.doctorId);
    const agent = data.agents.find((item) => item.id === order.agentId);
    const hay = `${order.number} ${doctor?.name ?? ""} ${doctor?.clinic ?? ""} ${agent?.name ?? ""}`.toLowerCase();
    return hay.includes(needle);
  });

  return (
    <div>
      <PageHeader
        kicker="Orders"
        title={monthLabel(month)}
        lede="Every order that was placed, including ones still on hold. Sales start only when a depot bill exists."
        action={
          <Link
            to="/intake"
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-forest px-4 text-sm font-medium text-on-forest"
          >
            New order
          </Link>
        }
      />

      <div className="mb-3 flex items-center justify-between gap-2">
        <Button tone="quiet" aria-label="Previous month" onClick={() => setMonth((value) => shiftMonth(value, -1))}>
          Previous
        </Button>
        <Button tone="ghost" onClick={() => { setMonth(monthKey(today)); setDay(null); }}>
          Today
        </Button>
        <Button tone="quiet" aria-label="Next month" onClick={() => setMonth((value) => shiftMonth(value, 1))}>
          Next
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEK.map((label, index) => (
          <div key={`${label}-${index}`} className="pb-1 text-center text-xs text-muted">
            {label}
          </div>
        ))}
        {cells.map((cell, index) => {
          if (!cell.date || cell.day == null) return <div key={`pad-${index}`} />;
          const count = counts.get(cell.date) ?? 0;
          const selected = day === cell.date;
          const isToday = cell.date === today;
          return (
            <button
              key={cell.date}
              type="button"
              onClick={() => setDay(selected ? null : cell.date)}
              className={cn(
                "flex min-h-11 flex-col items-center justify-center rounded-lg text-sm tabular-nums",
                selected && "bg-forest text-on-forest",
                !selected && count > 0 && "bg-mint text-forest",
                !selected && count === 0 && "text-muted hover:bg-sunken",
                !selected && isToday && "ring-2 ring-forest",
              )}
              aria-label={`${formatDate(cell.date)}, ${count} orders`}
              aria-pressed={selected}
            >
              <span>{cell.day}</span>
              {count > 0 ? <span className="text-xs">{count}</span> : null}
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={cn(
              "min-h-11 rounded-full px-3 text-sm font-medium",
              filter === item.id ? "bg-forest text-on-forest" : "bg-sunken text-ink",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <label className="mt-4 block">
        <span className="sr-only">Search orders</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by client or bill number"
          className="h-11 w-full rounded-lg border border-line bg-card px-3 outline-none focus-visible:border-forest"
        />
      </label>
      {day ? (
        <p className="mt-3 text-sm text-muted">
          Showing {formatDate(day)}.{" "}
          <button type="button" className="font-medium text-forest" onClick={() => setDay(null)}>
            Clear day
          </button>
        </p>
      ) : null}

      <ul className="mt-4">
        {rows.map((order) => {
          const doctor = data.doctors.find((item) => item.id === order.doctorId);
          const agent = data.agents.find((item) => item.id === order.agentId);
          const status = displayStatus(order, data, today);
          const amount = order.billedOn ? linesTotal(order.lines) : linesTotal(order.lines);
          return (
            <li key={order.id} className="border-b border-line">
              <Link to="/orders/$orderId" params={{ orderId: order.id }} className="grid gap-1 py-3 md:grid-cols-[7rem_minmax(0,1fr)_auto] md:items-center md:gap-4">
                <span className="font-medium">{order.number}</span>
                <span className="min-w-0">
                  <span className="block truncate">{doctor?.name ?? "Unknown client"}</span>
                  <span className="block text-sm text-muted">
                    {formatDate(order.createdOn)} · {agent?.name} 
                  </span>
                </span>
                <span className="flex items-center justify-between gap-3 md:justify-end">
                  <StatusPill status={status} />
                  <span className="tabular-nums">{formatMoney(amount)}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {rows.length === 0 ? (
        <div className="mt-4">
          <EmptyNote title="No orders in this view" body="Try another day, or clear the filter. Holds and delivered bills both live here." />
        </div>
      ) : null}
    </div>
  );
}
