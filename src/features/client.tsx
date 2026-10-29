import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { doctorAccounts } from "@/domain/aging";
import { formatDate, todayIso } from "@/domain/dates";
import { KIND_LABEL, PAY_LABEL, RETURN_REASON } from "@/domain/labels";
import { formatBalance, formatMoney, formatPct, linesTotal } from "@/domain/money";
import { displayStatus } from "@/domain/policy";
import { doctorTotals } from "@/domain/metrics";
import type { PayMethod } from "@/domain/types";
import { useLedger } from "@/store/ledger";
import { Button, Field, SelectInput, TextArea, TextInput } from "@/components/ui";
import { EmptyNote, Ledger, PageHeader, StatusPill } from "@/components/bits";

export function ClientPage({ clientId }: { clientId: string }) {
  const data = useLedger();
  const saveDoctor = useLedger((state) => state.saveDoctor);
  const recordPayment = useLedger((state) => state.recordPayment);
  const removePayment = useLedger((state) => state.removePayment);
  const doctor = data.doctors.find((row) => row.id === clientId);
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState(() => todayIso());
  const [method, setMethod] = useState<PayMethod>("bank");
  const [reference, setReference] = useState("");
  const [payNote, setPayNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [overrideProduct, setOverrideProduct] = useState("");
  const [overrideRate, setOverrideRate] = useState(10);

  if (!doctor) return <EmptyNote title="No such client" body="They are not on this book." />;

  const today = todayIso();
  const account = doctorAccounts(data, doctor.id, today);
  const totals = doctorTotals(data, doctor.id, today);
  const agent = data.agents.find((row) => row.id === doctor.agentId);
  const month = today.slice(0, 7);
  const orders = data.orders.filter((order) => order.doctorId === doctor.id);
  const payments = data.payments.filter((payment) => payment.doctorId === doctor.id).sort((a, b) => b.paidOn.localeCompare(a.paidOn));
  const returns = data.returns.filter((ret) => ret.doctorId === doctor.id && ret.status !== "void");
  const monthName = new Intl.DateTimeFormat("en", { month: "long" }).format(new Date(`${month}-01T00:00:00Z`));

  return (
    <div>
      <PageHeader
        kicker={KIND_LABEL[doctor.kind]}
        title={doctor.name}
        lede={`${doctor.clinic} · ${doctor.city || "No city"} · ${agent ? agent.name : "No agent"}`}
        action={
          <Button tone={doctor.active ? "quiet" : "primary"} onClick={() => saveDoctor({ ...doctor, active: !doctor.active })}>
            {doctor.active ? "Mark inactive" : "Reactivate"}
          </Button>
        }
      />

      {!doctor.active ? (
        <p className="mb-4 rounded-lg bg-copper-soft px-3 py-3 text-sm text-copper">
          Inactive. New orders will not pass the client check until you reactivate this file.
        </p>
      ) : null}
      {account.overdue >= 1 ? (
        <p className="mb-4 rounded-lg bg-copper-soft px-3 py-3 text-sm text-copper">
          Mandate. {formatMoney(account.overdue)} is older than {data.settings.overdueDays} days
          {account.oldestDays != null ? ` (oldest open bill ${account.oldestDays} days)` : ""}. New orders hold until this is
          cleared or an exception is signed on that order.
        </p>
      ) : null}

      <Ledger
        rows={[
          { label: "Balance", value: formatBalance(account.balance) },
          { label: "Overdue", value: formatMoney(account.overdue), tone: account.overdue >= 1 ? "alert" : "plain" },
          { label: `${monthName} sales`, value: formatMoney(totals.salesMonth) },
          { label: `${today.slice(0, 4)} sales`, value: formatMoney(totals.salesYear) },
          { label: "All sales", value: formatMoney(totals.salesTotal) },
          { label: `${monthName} collected`, value: formatMoney(totals.inMonth) },
          { label: "All collected", value: formatMoney(totals.inTotal) },
        ]}
      />

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <Field label="Agent on the book" hint="New orders still record whoever brought them.">
          <SelectInput
            value={doctor.agentId}
            onChange={(event) => saveDoctor({ ...doctor, agentId: event.target.value })}
          >
            {data.agents.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
                {row.active ? "" : " (inactive)"}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Default discount %" hint="Future orders only. Sent bills keep the old rate.">
          <TextInput
            type="number"
            min={0}
            max={80}
            step={0.5}
            value={Math.round(doctor.discountRate * 1000) / 10}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (!Number.isFinite(next)) return;
              saveDoctor({ ...doctor, discountRate: Math.min(0.8, Math.max(0, next / 100)) });
            }}
          />
        </Field>
        <Field label="Phone">
          <TextInput value={doctor.phone} onChange={(event) => saveDoctor({ ...doctor, phone: event.target.value })} />
        </Field>
        <Field label="City">
          <TextInput value={doctor.city} onChange={(event) => saveDoctor({ ...doctor, city: event.target.value })} />
        </Field>
        <div className="md:col-span-2">
          <Field label="Notes">
            <TextArea value={doctor.notes} onChange={(event) => saveDoctor({ ...doctor, notes: event.target.value })} />
          </Field>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-2xl">Special rates</h2>
        <p className="mt-1 text-sm text-muted">Use these when one item is discounted differently from the rest of the book.</p>
        <ul className="mt-2">
          {Object.entries(doctor.discountOverrides).map(([productId, rate]) => {
            const product = data.products.find((row) => row.id === productId);
            return (
              <li key={productId} className="flex items-center justify-between gap-3 border-b border-line py-2">
                <span>
                  {product?.name} · {formatPct(rate)}
                </span>
                <Button
                  tone="ghost"
                  onClick={() => {
                    const next = { ...doctor.discountOverrides };
                    delete next[productId];
                    saveDoctor({ ...doctor, discountOverrides: next });
                  }}
                >
                  Remove
                </Button>
              </li>
            );
          })}
        </ul>
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            if (!overrideProduct) return;
            saveDoctor({
              ...doctor,
              discountOverrides: {
                ...doctor.discountOverrides,
                [overrideProduct]: Math.min(0.8, Math.max(0, overrideRate / 100)),
              },
            });
            setOverrideProduct("");
          }}
        >
          <SelectInput value={overrideProduct} onChange={(event) => setOverrideProduct(event.target.value)} aria-label="Product for a special rate">
            <option value="">Product</option>
            {data.products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </SelectInput>
          <TextInput
            type="number"
            min={0}
            max={80}
            aria-label="Special discount percent"
            value={overrideRate}
            onChange={(event) => setOverrideRate(Number(event.target.value))}
            className="sm:w-28"
          />
          <Button type="submit" tone="quiet">
            Set rate
          </Button>
        </form>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-2xl">Restricted supply</h2>
        <ul className="mt-2">
          {data.products.filter((product) => product.restricted).map((product) => {
            const on = doctor.approvedRestrictedIds.includes(product.id);
            return (
              <li key={product.id}>
                <label className="flex min-h-11 items-center gap-3">
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={on}
                    onChange={(event) => {
                      const approvedRestrictedIds = event.target.checked
                        ? [...doctor.approvedRestrictedIds, product.id]
                        : doctor.approvedRestrictedIds.filter((id) => id !== product.id);
                      saveDoctor({ ...doctor, approvedRestrictedIds });
                    }}
                  />
                  <span>{product.name} may be supplied without a fresh approval</span>
                </label>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-2xl">Orders</h2>
        <ul>
          {orders.map((order) => (
            <li key={order.id} className="border-b border-line">
              <Link to="/orders/$orderId" params={{ orderId: order.id }} className="flex items-center justify-between gap-3 py-3">
                <span>
                  <span className="font-medium">{order.number}</span>
                  <span className="mt-0.5 block text-sm text-muted">{formatDate(order.createdOn)}</span>
                </span>
                <span className="flex items-center gap-3">
                  <StatusPill status={displayStatus(order, data, today)} />
                  <span className="tabular-nums">{formatMoney(linesTotal(order.lines))}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {orders.length === 0 ? <p className="mt-2 text-sm text-muted">No orders yet.</p> : null}
      </section>

      <section className="mt-8">
        <h2 className="font-display text-2xl">Payments</h2>
        <form
          className="mt-3 grid gap-3 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            const result = recordPayment({
              doctorId: doctor.id,
              amount: Number(amount),
              paidOn,
              method,
              reference,
              note: payNote,
            });
            setError(result);
            if (!result) {
              setAmount("");
              setReference("");
              setPayNote("");
            }
          }}
        >
          <Field label="Amount">
            <TextInput inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} required />
          </Field>
          <Field label="Date">
            <TextInput type="date" value={paidOn} onChange={(event) => setPaidOn(event.target.value)} required />
          </Field>
          <Field label="Method">
            <SelectInput value={method} onChange={(event) => setMethod(event.target.value as PayMethod)}>
              {Object.entries(PAY_LABEL).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Reference">
            <TextInput value={reference} onChange={(event) => setReference(event.target.value)} />
          </Field>
          <div className="md:col-span-2">
            <Button type="submit" tone="quiet">
              Record payment
            </Button>
          </div>
          {error ? <p className="text-sm text-copper md:col-span-2">{error}</p> : null}
        </form>
        <ul className="mt-4">
          {payments.map((payment) => (
            <li key={payment.id} className="flex items-center justify-between gap-3 border-b border-line py-3 text-sm">
              <span>
                <span className="font-medium tabular-nums">{formatMoney(payment.amount)}</span>
                <span className="mt-0.5 block text-muted">
                  {formatDate(payment.paidOn)} · {PAY_LABEL[payment.method]}
                  {payment.reference ? ` · ${payment.reference}` : ""}
                </span>
              </span>
              {pending === payment.id ? (
                <Button tone="danger" onClick={() => { removePayment(payment.id); setPending(null); }}>
                  Confirm remove
                </Button>
              ) : (
                <Button tone="ghost" onClick={() => setPending(payment.id)}>
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {returns.length ? (
        <section className="mt-8">
          <h2 className="font-display text-2xl">Returns</h2>
          <ul>
            {returns.map((ret) => (
              <li key={ret.id} className="border-b border-line py-3 text-sm">
                <span className="font-medium">{ret.number}</span>
                <span className="mt-0.5 block text-muted">
                  {formatDate(ret.createdOn)} · {RETURN_REASON[ret.reason]} · credit {formatMoney(linesTotal(ret.lines))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
