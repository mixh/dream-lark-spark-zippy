import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { STATUS_LABEL } from "@/domain/labels";
import type { OrderStatus } from "@/domain/types";

export function PageHeader({
  kicker,
  title,
  lede,
  action,
}: {
  kicker: string;
  title: string;
  lede?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-widest text-muted">{kicker}</p>
        <h1 className="mt-1 font-display text-3xl text-ink md:text-4xl">{title}</h1>
        {lede ? <p className="mt-2 max-w-2xl text-muted">{lede}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function StatusPill({ status }: { status: OrderStatus }) {
  const tone =
    status === "credit_hold" || status === "approval_needed"
      ? "bg-copper-soft text-copper"
      : status === "ready"
        ? "bg-forest text-on-forest"
        : status === "cancelled"
          ? "bg-sunken text-muted"
          : status === "delivered" || status === "intake"
            ? "bg-sunken text-ink"
            : "bg-mint text-forest";
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", tone)}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function Ledger({
  rows,
}: {
  rows: { label: string; value: string; hint?: string; tone?: "alert" | "plain" }[];
}) {
  return (
    <dl className="rounded-xl bg-card px-4 shadow-card md:px-5">
      {rows.map((row) => (
        <div key={row.label} className="flex items-baseline justify-between gap-4 border-b border-line py-3 last:border-b-0">
          <dt className="min-w-0">
            <span className="block text-sm text-muted">{row.label}</span>
            {row.hint ? <span className="mt-0.5 block text-xs text-muted">{row.hint}</span> : null}
          </dt>
          <dd className={cn("shrink-0 text-sm font-medium tabular-nums", row.tone === "alert" && "text-copper")}>
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function SectionTitle({ kicker, title }: { kicker?: string; title: string }) {
  return (
    <div className="mb-3">
      {kicker ? <p className="text-xs font-medium uppercase tracking-widest text-muted">{kicker}</p> : null}
      <h2 className={cn("font-display text-2xl", kicker && "mt-1")}>{title}</h2>
    </div>
  );
}

export function EmptyNote({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line px-4 py-8">
      <p className="font-medium">{title}</p>
      <p className="mt-1 max-w-md text-sm text-muted">{body}</p>
    </div>
  );
}
