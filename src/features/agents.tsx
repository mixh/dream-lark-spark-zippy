import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { todayIso } from "@/domain/dates";
import { formatBalance, formatMoney } from "@/domain/money";
import { agentTotals } from "@/domain/metrics";
import { useLedger } from "@/store/ledger";
import { Button, Field, TextInput } from "@/components/ui";
import { PageHeader } from "@/components/bits";

export function AgentsPage() {
  const data = useLedger();
  const addAgent = useLedger((state) => state.addAgent);
  const navigate = useNavigate();
  const today = todayIso();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [territory, setTerritory] = useState("");

  const rows = [...data.agents].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));

  return (
    <div>
      <PageHeader
        kicker="Agents"
        title="Who brings the orders"
        lede="Sales stay with the agent on the order. Balances follow the clients on their book today. When someone leaves, mark them inactive — don’t delete the history."
      />
      <ul>
        {rows.map((agent) => {
          const totals = agentTotals(data, agent.id, today);
          const clients = data.doctors.filter((doctor) => doctor.agentId === agent.id);
          return (
            <li key={agent.id} className="border-b border-line">
              <Link to="/agents/$agentId" params={{ agentId: agent.id }} className="grid gap-1 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <span>
                  <span className="font-medium">{agent.name}</span>
                  <span className="mt-0.5 block text-sm text-muted">
                    {agent.territory} · {clients.length} clients{agent.active ? "" : " · inactive"}
                  </span>
                </span>
                <span className="text-sm tabular-nums md:text-right">
                  <span className="block">{formatBalance(totals.balance)}</span>
                  {totals.overdue >= 1 ? <span className="text-copper">Overdue {formatMoney(totals.overdue)}</span> : <span className="text-muted">No overdue</span>}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <details className="mt-8 rounded-xl bg-card p-4 shadow-card">
        <summary className="min-h-11 font-medium">Add an agent</summary>
        <form
          className="mt-4 grid gap-3 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) return;
            const id = addAgent({
              name: name.trim(),
              phone: phone.trim(),
              territory: territory.trim() || "Unassigned",
              active: true,
              joinedOn: todayIso(),
            });
            void navigate({ to: "/agents/$agentId", params: { agentId: id } });
          }}
        >
          <Field label="Name">
            <TextInput value={name} onChange={(event) => setName(event.target.value)} required />
          </Field>
          <Field label="Phone">
            <TextInput value={phone} onChange={(event) => setPhone(event.target.value)} />
          </Field>
          <Field label="Territory">
            <TextInput value={territory} onChange={(event) => setTerritory(event.target.value)} />
          </Field>
          <div className="md:col-span-2">
            <Button type="submit">Save agent</Button>
          </div>
        </form>
      </details>
    </div>
  );
}
