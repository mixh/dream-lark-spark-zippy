import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { todayIso } from "@/domain/dates";
import { formatBalance, formatMoney } from "@/domain/money";
import { agentRanks, clientRanks, mostSold, overdueClients } from "@/domain/metrics";
import type { Period } from "@/domain/types";
import { useLedger } from "@/store/ledger";
import { PageHeader, SectionTitle } from "@/components/bits";
import { cn } from "@/lib/cn";

const PERIODS: { id: Period; label: string }[] = [
  { id: "month", label: "This month" },
  { id: "year", label: "This year" },
  { id: "all", label: "All time" },
];

export function RankingsPage() {
  const data = useLedger();
  const today = todayIso();
  const [period, setPeriod] = useState<Period>("month");
  const sold = mostSold(data, today, period);
  const clients = clientRanks(data, today, period);
  const agents = agentRanks(data, today, period);
  const overdue = overdueClients(data, today);

  return (
    <div>
      <PageHeader
        kicker="Rankings"
        title="Who and what moves"
        lede="Sold and collected follow the period. Overdue does not — it is whatever is still open past the mandate."
      />
      <div className="mb-6 flex flex-wrap gap-2">
        {PERIODS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setPeriod(item.id)}
            className={cn("min-h-11 rounded-full px-3 text-sm font-medium", period === item.id ? "bg-forest text-on-forest" : "bg-sunken")}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="grid gap-10 lg:grid-cols-2">
        <section>
          <SectionTitle title="Most sold" />
          <ol>
            {sold.map((row, index) => (
              <li key={row.id} className="flex items-baseline justify-between gap-3 border-b border-line py-3">
                <span>
                  <span className="text-muted tabular-nums">{index + 1}</span>{" "}
                  <span className="font-medium">{row.title}</span>
                  <span className="mt-0.5 block text-sm text-muted">{row.detail}</span>
                </span>
                <span className="text-right text-sm tabular-nums">
                  <span className="block">{row.qty} packs</span>
                  <span className="text-muted">{formatMoney(row.amount)}</span>
                </span>
              </li>
            ))}
          </ol>
          {sold.length === 0 ? <p className="text-sm text-muted">Nothing billed in this period.</p> : null}
        </section>
        <section>
          <SectionTitle title="Best paying clients" />
          <ol>
            {clients.map((row, index) => (
              <li key={row.doctor.id} className="border-b border-line">
                <Link to="/clients/$clientId" params={{ clientId: row.doctor.id }} className="flex items-baseline justify-between gap-3 py-3">
                  <span>
                    <span className="text-muted tabular-nums">{index + 1}</span> <span className="font-medium">{row.doctor.name}</span>
                    <span className="mt-0.5 block text-sm text-muted">
                      {row.account.overdue >= 1 ? `Overdue ${formatMoney(row.account.overdue)}` : "Clear of the mandate"}
                    </span>
                  </span>
                  <span className="tabular-nums">{formatMoney(row.incoming)}</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
        <section>
          <SectionTitle title="Top agents" />
          <ol>
            {agents.map((row, index) => (
              <li key={row.agent.id} className="border-b border-line">
                <Link to="/agents/$agentId" params={{ agentId: row.agent.id }} className="flex items-baseline justify-between gap-3 py-3">
                  <span>
                    <span className="text-muted tabular-nums">{index + 1}</span> <span className="font-medium">{row.agent.name}</span>
                    <span className="mt-0.5 block text-sm text-muted">{row.agent.active ? row.agent.territory : "Inactive"}</span>
                  </span>
                  <span className="tabular-nums">{formatMoney(row.sales)}</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
        <section>
          <SectionTitle title="Highest overdue" />
          {overdue.length === 0 ? (
            <p className="text-sm text-muted">No open bill is past the mandate.</p>
          ) : (
            <ol>
              {overdue.map((row, index) => (
                <li key={row.doctor.id} className="border-b border-line">
                  <Link to="/clients/$clientId" params={{ clientId: row.doctor.id }} className="flex items-baseline justify-between gap-3 py-3">
                    <span>
                      <span className="text-muted tabular-nums">{index + 1}</span> <span className="font-medium">{row.doctor.name}</span>
                      <span className="mt-0.5 block text-sm text-muted">
                        {row.account.oldestDays} days · balance {formatBalance(row.account.balance)}
                      </span>
                    </span>
                    <span className="tabular-nums text-copper">{formatMoney(row.account.overdue)}</span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
