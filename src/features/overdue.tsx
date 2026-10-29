import { Link } from "@tanstack/react-router";
import { todayIso } from "@/domain/dates";
import { formatMoney } from "@/domain/money";
import { overdueAgents, overdueClients } from "@/domain/metrics";
import { useLedger } from "@/store/ledger";
import { EmptyNote, PageHeader, SectionTitle } from "@/components/bits";

export function OverduePage() {
  const data = useLedger();
  const today = todayIso();
  const clients = overdueClients(data, today);
  const agents = overdueAgents(data, today);
  const days = data.settings.overdueDays;

  return (
    <div>
      <PageHeader
        kicker="Mandate"
        title="Past the line"
        lede={`A client is mandated when any open bill is older than ${days} days. Payments clear the oldest bill first. Change the line on the System page if the rule changes.`}
      />
      <div className="grid gap-10 lg:grid-cols-2">
        <section>
          <SectionTitle title="Clients" />
          {clients.length === 0 ? (
            <EmptyNote title="Nobody is past the mandate" body="Open balances younger than the line still show on each client file." />
          ) : (
            <ul>
              {clients.map(({ doctor, account }) => {
                const agent = data.agents.find((row) => row.id === doctor.agentId);
                return (
                  <li key={doctor.id} className="border-b border-line">
                    <Link to="/clients/$clientId" params={{ clientId: doctor.id }} className="block py-3">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="font-medium">{doctor.name}</span>
                        <span className="tabular-nums text-copper">{formatMoney(account.overdue)}</span>
                      </span>
                      <span className="mt-0.5 block text-sm text-muted">
                        {agent?.name} · oldest open bill {account.oldestDays} days · balance {formatMoney(account.balance)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <section>
          <SectionTitle title="Agents" />
          <p className="mb-2 text-sm text-muted">This is the overdue sitting on the clients they hold now, not old orders they once brought.</p>
          {agents.length === 0 ? (
            <EmptyNote title="No agent book is past the mandate" body="An inactive agent still appears here if their leftover clients owe past the line." />
          ) : (
            <ul>
              {agents.map(({ agent, totals }) => (
                <li key={agent.id} className="border-b border-line">
                  <Link to="/agents/$agentId" params={{ agentId: agent.id }} className="flex items-baseline justify-between gap-3 py-3">
                    <span>
                      <span className="font-medium">{agent.name}</span>
                      <span className="mt-0.5 block text-sm text-muted">
                        {agent.territory}
                        {agent.active ? "" : " · inactive"}
                      </span>
                    </span>
                    <span className="tabular-nums text-copper">{formatMoney(totals.overdue)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
