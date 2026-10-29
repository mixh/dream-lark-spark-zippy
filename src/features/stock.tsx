import { useState } from "react";
import { formatDate, todayIso } from "@/domain/dates";
import { MOVE_LABEL } from "@/domain/labels";
import { formatMoney, formatPct } from "@/domain/money";
import { stockRows } from "@/domain/metrics";
import { useLedger } from "@/store/ledger";
import { Button, Field, SelectInput, TextInput } from "@/components/ui";
import { PageHeader, SectionTitle } from "@/components/bits";
import { cn } from "@/lib/cn";

const TAXES = [0, 0.05, 0.12, 0.18];

export function StockPage() {
  const data = useLedger();
  const saveProduct = useLedger((state) => state.saveProduct);
  const today = todayIso();
  const rows = stockRows(data, today);
  const [openId, setOpenId] = useState<string | null>(null);
  const moves = [...data.moves].sort((a, b) => b.on.localeCompare(a.on) || b.id.localeCompare(a.id)).slice(0, 14);
  const totals = rows.reduce(
    (acc, row) => ({
      ordered: acc.ordered + row.orderedToday,
      received: acc.received + row.receivedToday,
      backlog: acc.backlog + row.backlog,
      onHand: acc.onHand + row.onHand,
      returned: acc.returned + row.returnedMonth,
    }),
    { ordered: 0, received: 0, backlog: 0, onHand: 0, returned: 0 },
  );

  return (
    <div>
      <PageHeader
        kicker="Stock"
        title="What is here, waiting, and coming back"
        lede="Ordered is demand placed today. Backlog is billed to the depot and not yet in the office. On hand moves when goods arrive, leave with a delivery, or go back to the depot."
      />
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-line shadow-card md:grid-cols-5">
        {[
          ["Ordered today", totals.ordered],
          ["Received today", totals.received],
          ["Backlog", totals.backlog],
          ["On hand", totals.onHand],
          ["Returned this month", totals.returned],
        ].map(([label, value]) => (
          <div key={String(label)} className="bg-card px-4 py-3">
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="mt-1 font-display text-3xl tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <section className="mt-8">
        <SectionTitle title="By item" />
        <ul>
          {rows.map((row) => {
            const product = data.products.find((item) => item.id === row.productId);
            if (!product) return null;
            const open = openId === product.id;
            return (
              <li key={product.id} className="border-b border-line py-3">
                <button type="button" className="flex w-full items-start justify-between gap-3 text-left" onClick={() => setOpenId(open ? null : product.id)}>
                  <span>
                    <span className="font-medium">{product.name}</span>
                    <span className="mt-0.5 block text-sm text-muted">
                      {product.pack} · retail {formatMoney(product.mrp)} · tax {formatPct(product.taxRate)}
                      {product.restricted ? " · restricted" : ""}
                    </span>
                  </span>
                  <span className={cn("shrink-0 text-right text-sm tabular-nums", row.onHand < 0 && "text-copper")}>
                    <span className="block">{row.onHand} on hand</span>
                    <span className="text-muted">{row.backlog} backlog</span>
                  </span>
                </button>
                <p className="mt-1 text-sm text-muted tabular-nums">
                  Today {row.orderedToday} ordered · {row.receivedToday} received · {row.returnedMonth} returned this month
                </p>
                {open ? (
                  <form
                    className="mt-3 grid gap-3 rounded-xl bg-sunken p-3 md:grid-cols-3"
                    onSubmit={(event) => event.preventDefault()}
                  >
                    <Field label="Retail price" hint="Next order only.">
                      <TextInput
                        type="number"
                        min={0}
                        value={product.mrp}
                        onChange={(event) => {
                          const mrp = Number(event.target.value);
                          if (!Number.isFinite(mrp) || mrp < 0) return;
                          saveProduct({ ...product, mrp: Math.round(mrp * 100) / 100 });
                        }}
                      />
                    </Field>
                    <Field label="Sales tax">
                      <SelectInput
                        value={String(product.taxRate)}
                        onChange={(event) => saveProduct({ ...product, taxRate: Number(event.target.value) })}
                      >
                        {TAXES.map((rate) => (
                          <option key={rate} value={rate}>
                            {formatPct(rate)}
                          </option>
                        ))}
                      </SelectInput>
                    </Field>
                    <div className="flex items-end">
                      <Button
                        tone={product.restricted ? "danger" : "quiet"}
                        onClick={() => saveProduct({ ...product, restricted: !product.restricted })}
                      >
                        {product.restricted ? "Restricted" : "Open supply"}
                      </Button>
                    </div>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-sm text-muted">Tap an item to change retail, tax, or whether it needs an approval. Sent bills are not rewritten.</p>
      </section>

      <section className="mt-8">
        <SectionTitle title="Recent movements" />
        <ul>
          {moves.map((move) => {
            const product = data.products.find((item) => item.id === move.productId);
            return (
              <li key={move.id} className="grid grid-cols-[7rem_minmax(0,1fr)_auto] gap-3 border-b border-line py-3 text-sm">
                <time className="text-muted tabular-nums">{formatDate(move.on)}</time>
                <span>
                  <span className="block">{product?.name}</span>
                  <span className="text-muted">
                    {MOVE_LABEL[move.kind]} · {move.ref}
                  </span>
                </span>
                <span className={cn("tabular-nums", move.qty < 0 && "text-copper")}>{move.qty > 0 ? `+${move.qty}` : move.qty}</span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
