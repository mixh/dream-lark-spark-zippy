import { Link } from "@tanstack/react-router";
import { doctorAccounts } from "@/domain/aging";
import { formatDate, todayIso } from "@/domain/dates";
import { formatBalance, formatMoney, linesTotal } from "@/domain/money";
import { agentTotals } from "@/domain/metrics";
import { displayStatus } from "@/domain/policy";
import { useLedger } from "@/store/ledger";
import { Button, Field, TextInput } from "@/components/ui";
import { EmptyNote, Ledger, PageHeader, StatusPill } from "@/components/bits";

export function AgentPage({ agentId }: { agentId: string }) {
  const data = useLedger();
  const saveAgent = useLedger((state) => state.saveAgent);
  const agent = data.agents.find((row) => row.id === agentId);
  if (!agent) return <EmptyNote title="No such agent" body="They are not on this book." />;

  const today = todayIso();
  const totals = agentTotals(data, agent.id, today);
  const clients = data.doctors.filter((doctor) => doctor.agentId === agent.id);
  const orders = data.orders.filter((order) => order.agentId === agent.id);
  const month = new Intl.DateTimeFormat("en", { month: "long" }).format(new Date(`${today.slice(0, 7)}-01T00:00:00Z`));

  return (
    <div>
      <PageHeader
        kicker={agent.territory}
        title={agent.name}
        lede={agent.active ? `On the book since ${formatDate(agent.joinedOn)}.` : `Inactive. Joined ${formatDate(agent.joinedOn)}. Their old orders stay under their name.`}
        action={
          <Button tone={agent.active ? "quiet" : "primary"} onClick={() => saveAgent({ ...agent, active: !agent.active })}>
            {agent.active ? "Mark inactive" : "Reactivate"}
          </Button>
        }
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Phone">
          <TextInput value={agent.phone} onChange={(event) => saveAgent({ ...agent, phone: event.target.value })} />
        </Field>
        <Field label="Territory">
          <TextInput value={agent.territory} onChange={(event) => saveAgent({ ...agent, territory: event.target.value })} />
        </Field>
      </div>
      <div className="mt-6">
        <Ledger
          rows={[
            { label: `${month} sales`, value: formatMoney(totals.salesMonth), hint: "Orders they brought" },
            { label: `${today.slice(0, 4)} sales`, value: formatMoney(totals.salesYear) },
            { label: "All sales", value: formatMoney(totals.salesTotal) },
            { label: `${month} collected`, value: formatMoney(totals.inMonth), hint: "From clients currently on their book" },
            { label: "Book balance", value: formatBalance(totals.balance) },
            { label: "Book overdue", value: formatMoney(totals.overdue), tone: totals.overdue >= 1 ? "alert" : "plain" },
          ]}
        />
      </div>

      <section className="mt-8">
        <h2 className="font-display text-2xl">Clients</h2>
        <ul>
          {clients.map((doctor) => {
            const account = doctorAccounts(data, doctor.id, today);
            return (
              <li key={doctor.id} className="border-b border-line">
                <Link to="/clients/$clientId" params={{ clientId: doctor.id }} className="flex items-center justify-between gap-3 py-3">
                  <span>
                    <span className="font-medium">{doctor.name}</span>
                    <span className="mt-0.5 block text-sm text-muted">{doctor.active ? doctor.city : "Inactive"}</span>
                  </span>
                  <span className="text-right text-sm tabular-nums">
                    <span className="block">{formatBalance(account.balance)}</span>
                    {account.overdue >= 1 ? <span className="text-copper">{formatMoney(account.overdue)} overdue</span> : null}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        {clients.length === 0 ? <p className="mt-2 text-sm text-muted">No clients on this book.</p> : null}
      </section>

      <section className="mt-8">
        <h2 className="font-display text-2xl">Orders they brought</h2>
        <ul>
          {orders.map((order) => {
            const doctor = data.doctors.find((row) => row.id === order.doctorId);
            return (
              <li key={order.id} className="border-b border-line">
                <Link to="/orders/$orderId" params={{ orderId: order.id }} className="flex items-center justify-between gap-3 py-3">
                  <span>
                    <span className="font-medium">{order.number}</span>
                    <span className="mt-0.5 block text-sm text-muted">
                      {doctor?.name} · {formatDate(order.createdOn)}
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <StatusPill status={displayStatus(order, data, today)} />
                    <span className="tabular-nums">{formatMoney(linesTotal(order.lines))}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
