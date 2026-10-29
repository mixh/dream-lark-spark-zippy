import { useState } from "react";
import { useLedger } from "@/store/ledger";
import { Button, Field, TextInput } from "@/components/ui";
import { PageHeader, SectionTitle } from "@/components/bits";

const LIVE = [
  "Paste a WhatsApp chat, an email, or a transcribed photo and turn it into lines.",
  "Match the client. If they are missing, add them. If they left, the order holds.",
  "Hold anything past the mandate unless someone signs a named exception.",
  "Hold restricted products until that client is approved, or the order is.",
  "Send a depot bill, receive the goods, pack, cut a delivery bill, hand to staff or a courier.",
  "Record a return, credit the client, and send the packs back to the depot.",
  "Read the company, each client, and each agent: in, out, balance, overdue, sales.",
  "Calendar of orders placed, rankings, stock, backlog.",
];

const NEXT = [
  "Photo OCR that suggests lines. A person still confirms. The photo capture on intake is the slot.",
  "Gmail and WhatsApp connectors that drop messages into the same intake, instead of paste.",
  "Partial receipts from the depot, instead of the whole order at once.",
  "Batch and expiry on each pack, so near-expiry returns are not a free-text reason.",
  "Invoice-by-invoice allocation you can override. Today, money clears the oldest bill first and you don’t pick which one.",
];

const LATER = [
  "Sign-in and roles: owner, office, agent. This pilot is one shared book on purpose.",
  "A real database so two desks see the same orders. The commands stay the same.",
  "Courier tracking after handover.",
  "An export for the accountant.",
  "The machine proposes each step. A person confirms. The trail keeps both.",
];

export function SystemPage() {
  const settings = useLedger((state) => state.settings);
  const saveSettings = useLedger((state) => state.saveSettings);
  const resetDemo = useLedger((state) => state.resetDemo);
  const [armed, setArmed] = useState(false);

  return (
    <div>
      <PageHeader
        kicker="System"
        title="How this desk is put together"
        lede="The screens are a view. The rules live underneath, as commands. That is what lets you add Gmail, photos, or a second user later without rewriting the mandate."
      />

      <section className="grid gap-4 md:grid-cols-3">
        <Field label="Company">
          <TextInput
            value={settings.company}
            onChange={(event) => {
              if (event.target.value.trim()) saveSettings({ company: event.target.value });
            }}
          />
        </Field>
        <Field label="Depot">
          <TextInput
            value={settings.depotName}
            onChange={(event) => {
              if (event.target.value.trim()) saveSettings({ depotName: event.target.value });
            }}
          />
        </Field>
        <Field label="Mandate, days" hint="Overdue means older than this. Try 30 or 90 and watch the holds move.">
          <TextInput
            type="number"
            min={1}
            max={365}
            value={settings.overdueDays}
            onChange={(event) => {
              const days = Number(event.target.value);
              if (!Number.isInteger(days) || days < 1 || days > 365) return;
              saveSettings({ overdueDays: days });
            }}
          />
        </Field>
      </section>

      <section className="mt-10">
        <SectionTitle kicker="In this pilot" title="Already real" />
        <ul className="flex flex-col gap-2">
          {LIVE.map((item) => (
            <li key={item} className="border-b border-line py-2 text-sm">
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <SectionTitle kicker="Next" title="Designed, not wired" />
        <ul className="flex flex-col gap-2">
          {NEXT.map((item) => (
            <li key={item} className="border-b border-line py-2 text-sm">
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <SectionTitle kicker="When it leaves the office" title="Later" />
        <ul className="flex flex-col gap-2">
          {LATER.map((item) => (
            <li key={item} className="border-b border-line py-2 text-sm">
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <SectionTitle kicker="For when you code again" title="Where a change goes" />
        <dl className="text-sm">
          {[
            ["Money", "Retail, discount, tax. A bill snapshots all three so history never moves."],
            ["Policy", "The mandate, inactive clients, and which products need approval."],
            ["Commands", "Send to depot, grant exception, pack, dispatch, return. Screens only call these."],
            ["Aging", "Who owes what. Oldest bill is cleared first."],
            ["Metrics", "The desk, rankings, and stock. They read the book. They don’t own rules."],
            ["The book", "Saved in this browser so you can test. Swap it for a database later. Don’t put the rules in the database layer."],
          ].map(([title, body]) => (
            <div key={title} className="grid gap-1 border-b border-line py-3 md:grid-cols-[9rem_minmax(0,1fr)]">
              <dt className="font-medium">{title}</dt>
              <dd className="text-muted">{body}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-10">
        <SectionTitle title="Sample book" />
        <p className="max-w-xl text-sm text-muted">
          Northline Pharma is invented data so you can click the whole loop: a mandated doctor, a clean bill, a packed order, a near-expiry return, and an agent who already left. Restoring it throws away changes you made in this browser.
        </p>
        <div className="mt-3">
          {armed ? (
            <Button
              tone="danger"
              onClick={() => {
                resetDemo();
                setArmed(false);
              }}
            >
              Yes, restore the sample book
            </Button>
          ) : (
            <Button tone="quiet" onClick={() => setArmed(true)}>
              Restore the sample book
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
