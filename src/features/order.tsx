import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { formatDate, todayIso } from "@/domain/dates";
import { CAPTURE_LABEL, CHANNEL_LABEL, RETURN_REASON, RETURN_STATUS } from "@/domain/labels";
import { formatMoney, formatPct, lineAmounts, linesGross, linesTotal } from "@/domain/money";
import { displayStatus, explain, isOpenPolicy, productNeedsApproval, verdictFor } from "@/domain/policy";
import type { DeliveryMode, ReturnReason } from "@/domain/types";
import { useLedger } from "@/store/ledger";
import { Button, Field, SelectInput, TextArea, TextInput } from "@/components/ui";
import { EmptyNote, PageHeader, StatusPill } from "@/components/bits";

export function OrderPage({ orderId }: { orderId: string }) {
  const exists = useLedger((state) => state.orders.some((order) => order.id === orderId));
  if (!exists) {
    return (
      <EmptyNote title="No such order" body="It is not on this book." />
    );
  }
  return <OrderBody orderId={orderId} />;
}

function OrderBody({ orderId }: { orderId: string }) {
  const data = useLedger();
  const run = useLedger((state) => state.run);
  const order = data.orders.find((row) => row.id === orderId);
  const today = todayIso();

  const policyKey = order
    ? [
        order.status,
        order.exceptionGranted,
        order.approvalGranted,
        order.lines.map((line) => `${line.productId}:${line.qty}`).join(","),
        data.settings.overdueDays,
        data.payments
          .filter((payment) => payment.doctorId === order.doctorId)
          .map((payment) => `${payment.id}:${payment.amount}`)
          .join(","),
        data.returns
          .filter((ret) => ret.doctorId === order.doctorId)
          .map((ret) => `${ret.id}:${ret.status}`)
          .join(","),
        data.doctors.find((doctor) => doctor.id === order.doctorId)?.active,
        data.doctors.find((doctor) => doctor.id === order.doctorId)?.approvedRestrictedIds.join(","),
      ].join("|")
    : "";

  useEffect(() => {
    const current = useLedger.getState().orders.find((row) => row.id === orderId);
    if (!current || !isOpenPolicy(current.status)) return;
    run({ type: "run_checks", orderId, today: todayIso() });
  }, [policyKey, orderId, run]);

  if (!order) return null;
  const doctor = data.doctors.find((row) => row.id === order.doctorId);
  const agent = data.agents.find((row) => row.id === order.agentId);
  const status = displayStatus(order, data, today);
  const gross = linesGross(order.lines);
  const editable = isOpenPolicy(order.status);

  return (
    <div>
      <PageHeader
        kicker={order.number}
        title={doctor?.name ?? "Unknown client"}
        lede={explain(order, data, today)}
        action={<StatusPill status={status} />}
      />

      <p className="mb-6 text-sm text-muted">
        {formatDate(order.createdOn)} · {CHANNEL_LABEL[order.channel]} · {CAPTURE_LABEL[order.capture]} ·{" "}
        {agent ? (
          <Link to="/agents/$agentId" params={{ agentId: agent.id }} className="font-medium text-forest">
            {agent.name}
          </Link>
        ) : (
          "No agent"
        )}
        {doctor ? (
          <>
            {" · "}
            <Link to="/clients/$clientId" params={{ clientId: doctor.id }} className="font-medium text-forest">
              Client file
            </Link>
          </>
        ) : null}
      </p>

      {order.capture === "photo" ? (
        <p className="mb-4 rounded-lg bg-sunken px-3 py-3 text-sm">
          This arrived as a photo. The text is a person’s transcription. Reading the photo itself is not built yet — the desk does not pretend it did.
        </p>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div>
          <Receipt
            company={data.settings.company}
            title={
              order.deliveryBillNumber ? "Delivery bill" : order.depotBillNumber ? "Depot bill" : "Pro forma — not sent"
            }
            number={order.deliveryBillNumber ?? order.depotBillNumber ?? order.number}
            meta={[
              ["Client", doctor?.clinic ?? "—"],
              ["Agent", agent?.name ?? "—"],
              ["Depot bill", order.depotBillNumber ?? "—"],
              ["Delivery bill", order.deliveryBillNumber ?? "—"],
            ]}
          />
          <ul className="mt-2">
            {order.lines.map((line) => {
              const product = data.products.find((row) => row.id === line.productId);
              const amounts = lineAmounts(line);
              const blocked = doctor && product ? productNeedsApproval(doctor, product) && !order.approvalGranted : false;
              return (
                <li key={line.id} className="border-b border-line py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {product?.name ?? "Removed product"}
                        {blocked ? <span className="ml-2 text-xs font-medium text-copper">Needs approval</span> : null}
                      </p>
                      <p className="text-sm text-muted">
                        {product?.pack} · {line.qty} × {formatMoney(line.mrp)} · less {formatPct(line.discountRate)} · tax{" "}
                        {formatPct(line.taxRate)}
                      </p>
                    </div>
                    <p className="shrink-0 tabular-nums">{formatMoney(amounts.total)}</p>
                  </div>
                  {editable ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <label className="text-sm text-muted">
                        Qty
                        <input
                          type="number"
                          min={1}
                          max={9999}
                          value={line.qty}
                          onChange={(event) => {
                            const qty = Number(event.target.value);
                            if (!Number.isInteger(qty) || qty < 1 || qty > 9999) return;
                            const lines = order.lines.map((row) =>
                              row.productId === line.productId ? { productId: row.productId, qty } : { productId: row.productId, qty: row.qty },
                            );
                            run({ type: "set_lines", orderId: order.id, today: todayIso(), lines });
                          }}
                          className="ml-2 h-11 w-20 rounded-lg border border-line bg-card px-2 tabular-nums"
                        />
                      </label>
                      {order.lines.length > 1 ? (
                        <Button
                          tone="ghost"
                          onClick={() =>
                            run({
                              type: "set_lines",
                              orderId: order.id,
                              today: todayIso(),
                              lines: order.lines
                                .filter((row) => row.id !== line.id)
                                .map((row) => ({ productId: row.productId, qty: row.qty })),
                            })
                          }
                        >
                          Remove
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {editable ? <AddLine orderId={order.id} existing={order.lines.map((line) => line.productId)} /> : null}
          <dl className="mt-4 max-w-sm">
            {[
              ["Retail", formatMoney(gross.gross)],
              ["Discount", formatMoney(-gross.discount)],
              ["Net", formatMoney(gross.net)],
              ["Sales tax", formatMoney(gross.tax)],
              ["Total", formatMoney(gross.total)],
            ].map(([label, value], index) => (
              <div key={label} className="flex items-baseline justify-between gap-4 border-b border-line py-2">
                <dt className={index === 4 ? "font-medium" : "text-muted"}>{label}</dt>
                <dd className="tabular-nums font-medium">{value}</dd>
              </div>
            ))}
          </dl>

          {order.rawMessage ? (
            <section className="mt-8">
              <h2 className="font-display text-2xl">As it came in</h2>
              <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-sunken p-4 font-sans text-sm">{order.rawMessage}</pre>
            </section>
          ) : null}

          <section className="mt-8">
            <h2 className="font-display text-2xl">Trail</h2>
            <ol className="mt-2">
              {order.events.map((event, index) => (
                <li key={`${event.at}-${index}`} className="flex gap-4 border-b border-line py-3 text-sm">
                  <time className="w-28 shrink-0 text-muted tabular-nums">{formatDate(event.at)}</time>
                  <span>{event.message}</span>
                </li>
              ))}
            </ol>
          </section>

          {order.status === "delivered" ? <ReturnPanel orderId={order.id} /> : null}
        </div>
        <ActionPanel orderId={order.id} />
      </div>
    </div>
  );
}

function Receipt({
  company,
  title,
  number,
  meta,
}: {
  company: string;
  title: string;
  number: string;
  meta: [string, string][];
}) {
  return (
    <div className="rounded-xl bg-card px-4 py-4 shadow-card md:px-5">
      <p className="text-xs font-medium uppercase tracking-widest text-muted">{company}</p>
      <p className="mt-1 font-display text-2xl">{title}</p>
      <p className="tabular-nums text-sm text-muted">{number}</p>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
        {meta.map(([label, value]) => (
          <div key={label}>
            <dt className="text-muted">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function AddLine({ orderId, existing }: { orderId: string; existing: string[] }) {
  const products = useLedger((state) => state.products);
  const run = useLedger((state) => state.run);
  const [productId, setProductId] = useState("");
  return (
    <form
      className="mt-3 flex flex-col gap-2 sm:flex-row"
      onSubmit={(event) => {
        event.preventDefault();
        if (!productId) return;
        const order = useLedger.getState().orders.find((row) => row.id === orderId);
        if (!order) return;
        const lines = order.lines.map((line) => ({ productId: line.productId, qty: line.qty }));
        const found = lines.find((line) => line.productId === productId);
        const next = found
          ? lines.map((line) => (line.productId === productId ? { ...line, qty: line.qty + 1 } : line))
          : [...lines, { productId, qty: 1 }];
        run({ type: "set_lines", orderId, today: todayIso(), lines: next });
        setProductId("");
      }}
    >
      <SelectInput value={productId} onChange={(event) => setProductId(event.target.value)} aria-label="Add a product">
        <option value="">Add a product</option>
        {products.map((product) => (
          <option key={product.id} value={product.id}>
            {product.name}
            {existing.includes(product.id) ? " (add one)" : ""}
          </option>
        ))}
      </SelectInput>
      <Button type="submit" tone="quiet">
        Add
      </Button>
    </form>
  );
}

function ActionPanel({ orderId }: { orderId: string }) {
  const data = useLedger();
  const run = useLedger((state) => state.run);
  const order = data.orders.find((row) => row.id === orderId);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<DeliveryMode | null>(null);
  const [courier, setCourier] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  if (!order) return null;
  const today = todayIso();
  const status = displayStatus(order, data, today);
  const verdict = verdictFor(order, data, today);

  function go(result: string | null) {
    setError(result);
    if (!result) {
      setNote("");
      setConfirmCancel(false);
    }
  }

  return (
    <aside className="h-fit rounded-xl bg-card p-4 shadow-card lg:sticky lg:top-6">
      <h2 className="font-display text-xl">Next step</h2>
      <div className="mt-4 flex flex-col gap-3">
        {status === "credit_hold" && verdict.kind === "credit_hold" && verdict.reason === "overdue" ? (
          <>
            <Field label="Exception note" hint="Who signed it, and why this one order may pass.">
              <TextArea value={note} onChange={(event) => setNote(event.target.value)} />
            </Field>
            <Button onClick={() => go(run({ type: "grant_exception", orderId, today, note }))}>Sign exception</Button>
          </>
        ) : null}
        {status === "credit_hold" && verdict.kind === "credit_hold" && verdict.reason !== "overdue" ? (
          <Link
            to="/clients/$clientId"
            params={{ clientId: order.doctorId }}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-forest px-4 text-sm font-medium text-on-forest"
          >
            Open the client file
          </Link>
        ) : null}
        {status === "approval_needed" ? (
          <>
            <Field label="Approval note" hint="Who allowed this supply.">
              <TextArea value={note} onChange={(event) => setNote(event.target.value)} />
            </Field>
            <Button onClick={() => go(run({ type: "grant_approval", orderId, today, note }))}>Record approval</Button>
          </>
        ) : null}
        {status === "ready" ? (
          <Button onClick={() => go(run({ type: "send_to_depot", orderId, today }))}>Send bill to depot</Button>
        ) : null}
        {status === "at_depot" ? (
          <Button onClick={() => go(run({ type: "mark_received", orderId, today }))}>Goods arrived</Button>
        ) : null}
        {status === "received" ? (
          <Button onClick={() => go(run({ type: "mark_packed", orderId, today }))}>Pack and cut delivery bill</Button>
        ) : null}
        {status === "packed" ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Button tone={mode === "staff" ? "primary" : "quiet"} onClick={() => setMode("staff")}>
                Office staff
              </Button>
              <Button tone={mode === "courier" ? "primary" : "quiet"} onClick={() => setMode("courier")}>
                Courier
              </Button>
            </div>
            {mode === "courier" ? (
              <Field label="Courier">
                <TextInput value={courier} onChange={(event) => setCourier(event.target.value)} />
              </Field>
            ) : null}
            <Button
              disabled={!mode}
              onClick={() => {
                if (!mode) return;
                go(run({ type: "dispatch", orderId, today, mode, courierName: courier }));
              }}
            >
              Hand over
            </Button>
          </>
        ) : null}
        {status === "dispatched" ? (
          <Button onClick={() => go(run({ type: "mark_delivered", orderId, today }))}>Mark delivered</Button>
        ) : null}
        {isOpenPolicy(order.status) ? (
          confirmCancel ? (
            <Button tone="danger" onClick={() => go(run({ type: "cancel", orderId, today }))}>
              Confirm cancel
            </Button>
          ) : (
            <Button tone="ghost" onClick={() => setConfirmCancel(true)}>
              Cancel order
            </Button>
          )
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-copper">
            {error}
          </p>
        ) : null}
        {order.exceptionNote ? <p className="text-sm text-muted">Exception: {order.exceptionNote}</p> : null}
        {order.approvalNote ? <p className="text-sm text-muted">Approval: {order.approvalNote}</p> : null}
      </div>
    </aside>
  );
}

function ReturnPanel({ orderId }: { orderId: string }) {
  const data = useLedger();
  const run = useLedger((state) => state.run);
  const order = data.orders.find((row) => row.id === orderId);
  const [reason, setReason] = useState<ReturnReason>("near_expiry");
  const [note, setNote] = useState("");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  if (!order) return null;
  const related = data.returns.filter((ret) => ret.sourceOrderId === order.id && ret.status !== "void");

  return (
    <section className="mt-8">
      <h2 className="font-display text-2xl">Returns</h2>
      <p className="mt-1 text-sm text-muted">
        Recording a return credits the client and puts the packs back on the shelf. Sending it to the depot takes them off the shelf again.
      </p>
      <ul className="mt-3">
        {related.map((ret) => (
          <li key={ret.id} className="border-b border-line py-3 text-sm">
            <span className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">
                {ret.number} · {RETURN_REASON[ret.reason]}
              </span>
              <span className="text-muted">{RETURN_STATUS[ret.status]}</span>
            </span>
            <span className="mt-1 block text-muted">
              {ret.lines
                .map((line) => {
                  const product = data.products.find((row) => row.id === line.productId);
                  return `${line.qty} × ${product?.name ?? "Item"}`;
                })
                .join(", ")}{" "}
              · credit {formatMoney(linesTotal(ret.lines))}
            </span>
            <span className="mt-2 flex flex-wrap gap-2">
              {ret.status === "draft" ? (
                <>
                  <Button tone="quiet" onClick={() => setError(run({ type: "send_return", returnId: ret.id, today: todayIso() }))}>
                    Send to depot
                  </Button>
                  <Button tone="ghost" onClick={() => setError(run({ type: "void_return", returnId: ret.id, today: todayIso() }))}>
                    Void
                  </Button>
                </>
              ) : null}
              {ret.status === "sent_to_depot" ? (
                <Button tone="quiet" onClick={() => setError(run({ type: "settle_return", returnId: ret.id, today: todayIso() }))}>
                  Mark settled
                </Button>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      <form
        className="mt-4 flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const lines = order.lines
            .map((line) => ({ productId: line.productId, qty: qty[line.productId] ?? 0 }))
            .filter((line) => line.qty > 0);
          const result = run({
            type: "create_return",
            orderId: order.id,
            today: todayIso(),
            reason,
            note,
            lines,
          });
          setError(result);
          if (!result) {
            setQty({});
            setNote("");
          }
        }}
      >
        <Field label="Reason">
          <SelectInput value={reason} onChange={(event) => setReason(event.target.value as ReturnReason)}>
            {Object.entries(RETURN_REASON).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </SelectInput>
        </Field>
        {order.lines.map((line) => {
          const product = data.products.find((row) => row.id === line.productId);
          const used = related
            .flatMap((ret) => ret.lines)
            .filter((retLine) => retLine.productId === line.productId)
            .reduce((sum, retLine) => sum + retLine.qty, 0);
          const left = line.qty - used;
          if (left <= 0) return null;
          return (
            <Field key={line.id} label={`${product?.name ?? "Item"} coming back`} hint={`${left} still out`}>
              <TextInput
                type="number"
                min={0}
                max={left}
                value={qty[line.productId] ?? 0}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  if (!Number.isFinite(next)) return;
                  setQty((current) => ({ ...current, [line.productId]: Math.max(0, Math.min(left, Math.floor(next))) }));
                }}
              />
            </Field>
          );
        })}
        <Field label="Note">
          <TextInput value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>
        <Button type="submit" tone="quiet">
          Record return
        </Button>
        {error ? (
          <p role="alert" className="text-sm text-copper">
            {error}
          </p>
        ) : null}
      </form>
    </section>
  );
}
