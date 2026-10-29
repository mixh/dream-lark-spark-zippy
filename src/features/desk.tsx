import { Link } from "@tanstack/react-router";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { formatMoney } from "@/domain/money";
import { formatPretty, monthLabel, todayIso } from "@/domain/dates";
import { orderSeries, orgTotals, stockRows, workQueue } from "@/domain/metrics";
import { explain } from "@/domain/policy";
import { CHANNEL_LABEL } from "@/domain/labels";
import { useLedger } from "@/store/ledger";
import { Ledger, PageHeader, SectionTitle, StatusPill } from "@/components/bits";

const PATHS = [
  {
    id: "o-roh-2",
    title: "See a mandate hold",
    body: "Rohan Mehta is past 45 days. The new order will not bill unless you sign an exception.",
  },
  {
    id: "o-hale-ready",
    title: "Send a clean bill",
    body: "Hale Street is inside the mandate. Cut the depot bill and it joins the backlog.",
  },
  {
    id: "o-riv",
    title: "Hand over a packed order",
    body: "Riverside is packed in the office. Choose office staff or a courier.",
  },
];

export function DeskPage() {
  const data = useLedger();
  const today = todayIso();
  const totals = orgTotals(data, today);
  const queue = workQueue(data, today);
  const series = orderSeries(data.orders, today, 30);
  const placedToday = data.orders.filter((order) => order.createdOn === today && order.status !== "cancelled").length;
  const stock = stockRows(data, today);
  const pulse = stock.reduce(
    (acc, row) => ({
      ordered: acc.ordered + row.orderedToday,
      received: acc.received + row.receivedToday,
      backlog: acc.backlog + row.backlog,
      onHand: acc.onHand + row.onHand,
    }),
    { ordered: 0, received: 0, backlog: 0, onHand: 0 },
  );
  const month = monthLabel(today.slice(0, 7)).split(" ")[0] ?? "This month";
  const waiting = queue.filter(
    (row) => row.status === "credit_hold" || row.status === "approval_needed" || row.status === "ready",
  ).length;

  return (
    <div>
      <PageHeader
        kicker="Desk"
        title={formatPretty(today)}
        lede={
          waiting
            ? `${waiting} ${waiting === 1 ? "order needs" : "orders need"} a person before anything else goes to the depot. ${placedToday} placed today.`
            : `Nothing is waiting on a decision. ${placedToday} placed today.`
        }
        action={
          <Link
            to="/intake"
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-forest px-4 text-sm font-medium text-on-forest"
          >
            New order
          </Link>
        }
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,0.9fr)]">
        <section>
          <SectionTitle kicker="Queue" title="What is still open" />
          <ul>
            {queue.map(({ order, status }) => {
              const doctor = data.doctors.find((row) => row.id === order.doctorId);
              return (
                <li key={order.id} className="border-b border-line">
                  <Link to="/orders/$orderId" params={{ orderId: order.id }} className="block py-3 hover:bg-sunken/70">
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">
                        {order.number}
                        <span className="ml-2 font-normal text-muted">{doctor?.name}</span>
                      </span>
                      <StatusPill status={status} />
                    </span>
                    <span className="mt-1 block text-sm text-muted">{explain(order, data, today)}</span>
                    <span className="mt-1 block text-xs uppercase tracking-widest text-muted">
                      {CHANNEL_LABEL[order.channel]}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <section>
          <SectionTitle kicker={data.settings.company} title="The book" />
          <Ledger
            rows={[
              { label: `${month} out`, value: formatMoney(totals.salesMonth), hint: "Bills sent, minus returns" },
              { label: `${month} in`, value: formatMoney(totals.inMonth), hint: "Payments posted" },
              { label: "Open balance", value: formatMoney(totals.balance), hint: "Still owed, all open bills" },
              {
                label: "Of which overdue",
                value: formatMoney(totals.overdue),
                hint: `Older than ${data.settings.overdueDays} days`,
                tone: totals.overdue >= 1 ? "alert" : "plain",
              },
              { label: `${today.slice(0, 4)} sales`, value: formatMoney(totals.salesYear) },
              { label: "All sales", value: formatMoney(totals.salesTotal) },
            ]}
          />
          <p className="mt-3 text-sm text-muted">
            Orders still on hold are not sales yet. A bill starts when it goes to {data.settings.depotName}.
          </p>
        </section>
      </div>

      <section className="mt-10">
        <SectionTitle kicker="Floor" title="Goods" />
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-line shadow-card md:grid-cols-4">
          {[
            ["Ordered today", pulse.ordered],
            ["Received today", pulse.received],
            ["Backlog at depot", pulse.backlog],
            ["Packs on hand", pulse.onHand],
          ].map(([label, value]) => (
            <div key={String(label)} className="bg-card px-4 py-3">
              <dt className="text-sm text-muted">{label}</dt>
              <dd className="mt-1 font-display text-3xl tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-10">
        <SectionTitle kicker="Thirty days" title="Orders placed" />
        <div className="h-36 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fill: "var(--color-muted)", fontSize: 11 }} interval={4} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: "var(--color-sunken)" }}
                contentStyle={{
                  background: "var(--color-card)",
                  border: "1px solid var(--color-line)",
                  borderRadius: 8,
                  color: "var(--color-ink)",
                  fontSize: 12,
                }}
                formatter={(value) => [`${value ?? 0} orders`, "Placed"]}
              />
              <Bar dataKey="count" fill="var(--color-forest)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-sm text-muted">
          <Link to="/orders" className="font-medium text-forest">
            Open the month calendar
          </Link>
        </p>
      </section>

      <section className="mt-10">
        <SectionTitle kicker="Sample book" title="Three ways to test the loop" />
        <ul className="grid gap-3 md:grid-cols-3">
          {PATHS.map((path) => (
            <li key={path.id}>
              <Link
                to="/orders/$orderId"
                params={{ orderId: path.id }}
                className="block h-full rounded-xl bg-card p-4 shadow-card hover:bg-sunken/40"
              >
                <span className="font-medium">{path.title}</span>
                <span className="mt-1 block text-sm text-muted">{path.body}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
