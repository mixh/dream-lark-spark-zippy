import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { todayIso } from "@/domain/dates";
import { CAPTURE_LABEL, CHANNEL_LABEL } from "@/domain/labels";
import { formatMoney, formatPct, lineAmounts, linesTotal, rateFor } from "@/domain/money";
import { INTAKE_SAMPLES, parseIntake } from "@/domain/parse";
import type { Capture, Channel } from "@/domain/types";
import { useLedger } from "@/store/ledger";
import { Button, Field, SelectInput, TextArea, TextInput } from "@/components/ui";
import { PageHeader } from "@/components/bits";
import { cn } from "@/lib/cn";

interface DraftLine {
  productId: string;
  qty: number;
}

const CHANNELS: Channel[] = ["whatsapp", "gmail", "phone", "counter"];

function captureFor(channel: Channel, current: Capture): Capture {
  if (channel === "gmail") return "email";
  if (channel === "phone" || channel === "counter") return "spoken";
  return current === "photo" ? "photo" : "chat";
}

export function IntakePage() {
  const data = useLedger();
  const createOrder = useLedger((state) => state.createOrder);
  const navigate = useNavigate();
  const [channel, setChannel] = useState<Channel>("whatsapp");
  const [capture, setCapture] = useState<Capture>("chat");
  const [agentId, setAgentId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [raw, setRaw] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [productId, setProductId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const doctor = data.doctors.find((row) => row.id === doctorId);
  const activeAgents = data.agents.filter((agent) => agent.active);

  function readMessage(text: string) {
    const parsed = parseIntake(text, data.doctors, data.products);
    setUnmatched(parsed.unmatched);
    if (parsed.doctor) {
      setDoctorId(parsed.doctor.id);
      setAgentId(parsed.doctor.agentId);
    }
    if (parsed.lines.length) setLines(parsed.lines.map((line) => ({ productId: line.productId, qty: line.qty })));
  }

  function addLine(id: string) {
    if (!id) return;
    setLines((current) => {
      const found = current.find((line) => line.productId === id);
      if (found) return current.map((line) => (line.productId === id ? { ...line, qty: line.qty + 1 } : line));
      return [...current, { productId: id, qty: 1 }];
    });
  }

  return (
    <div>
      <PageHeader
        kicker="Intake"
        title="New order"
        lede="Paste a WhatsApp chat, an email, or the transcription of a photo. The desk matches the client and the products, then runs the same checks a person would."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {INTAKE_SAMPLES.map((sample) => (
          <button
            key={sample.id}
            type="button"
            className="min-h-11 rounded-full bg-sunken px-3 text-sm font-medium"
            onClick={() => {
              setChannel(sample.channel);
              setCapture(sample.capture);
              setRaw(sample.text);
              readMessage(sample.text);
              setError(null);
            }}
          >
            {sample.label}
          </button>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const result = createOrder({
              today: todayIso(),
              doctorId,
              agentId,
              channel,
              capture,
              rawMessage: raw,
              lines,
            });
            if (result.error || !result.id) {
              setError(result.error ?? "Could not create the order.");
              return;
            }
            void navigate({ to: "/orders/$orderId", params: { orderId: result.id } });
          }}
        >
          <div className="flex flex-wrap gap-2">
            {CHANNELS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setChannel(item);
                  setCapture((current) => captureFor(item, current));
                }}
                className={cn(
                  "min-h-11 rounded-full px-3 text-sm font-medium",
                  channel === item ? "bg-forest text-on-forest" : "bg-sunken text-ink",
                )}
              >
                {CHANNEL_LABEL[item]}
              </button>
            ))}
          </div>
          {channel === "whatsapp" ? (
            <div className="flex flex-wrap gap-2">
              {(["chat", "photo"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCapture(item)}
                  className={cn(
                    "min-h-11 rounded-full px-3 text-sm",
                    capture === item ? "bg-ink text-paper" : "bg-card text-ink shadow-card",
                  )}
                >
                  {CAPTURE_LABEL[item]}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">Recorded as {CAPTURE_LABEL[capture].toLowerCase()}.</p>
          )}
          {capture === "photo" ? (
            <p className="rounded-lg bg-sunken px-3 py-3 text-sm">
              Photo reading is not connected. Type what the slip says. A later module can suggest the lines; a person still confirms them.
            </p>
          ) : null}

          <Field label="Message">
            <TextArea
              value={raw}
              onChange={(event) => setRaw(event.target.value)}
              placeholder={"Client name\nAugmentin 625 x 10\nPanadol 500 x 8"}
            />
          </Field>
          <Button
            type="button"
            tone="quiet"
            onClick={() => {
              readMessage(raw);
              setError(null);
            }}
          >
            Read the message
          </Button>
          {unmatched.length ? (
            <p className="text-sm text-copper">Not read: {unmatched.join(" · ")}. Add those lines yourself if they are products.</p>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Client">
              <SelectInput value={doctorId} onChange={(event) => {
                const id = event.target.value;
                setDoctorId(id);
                const next = data.doctors.find((row) => row.id === id);
                if (next && !agentId) setAgentId(next.agentId);
              }}>
                <option value="">Choose</option>
                {data.doctors.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                    {row.active ? "" : " (inactive)"}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Agent who brought it">
              <SelectInput value={agentId} onChange={(event) => setAgentId(event.target.value)}>
                <option value="">Choose</option>
                {activeAgents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name} · {agent.territory}
                  </option>
                ))}
              </SelectInput>
            </Field>
          </div>

          <div>
            <h2 className="font-display text-2xl">Lines</h2>
            <ul className="mt-2">
              {lines.map((line) => {
                const product = data.products.find((row) => row.id === line.productId);
                const rate = doctor && product ? rateFor(doctor, product.id) : 0;
                const preview = product
                  ? lineAmounts({ qty: line.qty, mrp: product.mrp, discountRate: rate, taxRate: product.taxRate })
                  : null;
                return (
                  <li key={line.productId} className="flex flex-wrap items-center gap-3 border-b border-line py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{product?.name}</span>
                      <span className="text-sm text-muted">
                        {product ? `${formatMoney(product.mrp)} retail · ${formatPct(rate)} off` : ""}
                        {product?.restricted ? " · restricted" : ""}
                      </span>
                    </span>
                    <TextInput
                      type="number"
                      min={1}
                      max={9999}
                      value={line.qty}
                      aria-label={`Quantity for ${product?.name ?? "product"}`}
                      className="w-24"
                      onChange={(event) => {
                        const qty = Number(event.target.value);
                        if (!Number.isInteger(qty) || qty < 1) return;
                        setLines((current) => current.map((row) => (row.productId === line.productId ? { ...row, qty } : row)));
                      }}
                    />
                    <span className="w-24 text-right tabular-nums">{preview ? formatMoney(preview.total) : ""}</span>
                    <Button
                      tone="ghost"
                      onClick={() => setLines((current) => current.filter((row) => row.productId !== line.productId))}
                    >
                      Remove
                    </Button>
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <SelectInput value={productId} onChange={(event) => setProductId(event.target.value)} aria-label="Product to add">
                <option value="">Add a product</option>
                {data.products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </SelectInput>
              <Button
                type="button"
                tone="quiet"
                onClick={() => {
                  addLine(productId);
                  setProductId("");
                }}
              >
                Add
              </Button>
            </div>
          </div>

          {error ? (
            <p role="alert" className="text-sm text-copper">
              {error}
            </p>
          ) : null}
          <Button type="submit">Create order and run checks</Button>
        </form>

        <aside className="h-fit rounded-xl bg-card p-4 shadow-card">
          <p className="text-xs font-medium uppercase tracking-widest text-muted">Pro forma</p>
          <p className="mt-2 font-display text-3xl tabular-nums">
            {doctor
              ? formatMoney(
                  linesTotal(
                    lines.map((line) => {
                      const product = data.products.find((row) => row.id === line.productId);
                      return {
                        qty: line.qty,
                        mrp: product?.mrp ?? 0,
                        discountRate: product ? rateFor(doctor, product.id) : 0,
                        taxRate: product?.taxRate ?? 0,
                      };
                    }),
                  ),
                )
              : "—"}
          </p>
          <p className="mt-2 text-sm text-muted">
            Retail, then this client’s discount, then sales tax. The figure locks onto the bill when you send it to the depot.
          </p>
          {doctor && !doctor.active ? (
            <p className="mt-3 text-sm text-copper">This client is inactive. The order will hold.</p>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
