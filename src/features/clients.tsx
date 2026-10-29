import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { todayIso } from "@/domain/dates";
import { KIND_LABEL } from "@/domain/labels";
import { doctorAccounts } from "@/domain/aging";
import { formatBalance, formatMoney } from "@/domain/money";
import type { ClientKind } from "@/domain/types";
import { useLedger } from "@/store/ledger";
import { Button, Field, SelectInput, TextInput } from "@/components/ui";
import { EmptyNote, PageHeader } from "@/components/bits";
import { cn } from "@/lib/cn";

export function ClientsPage() {
  const data = useLedger();
  const addDoctor = useLedger((state) => state.addDoctor);
  const navigate = useNavigate();
  const today = todayIso();
  const [filter, setFilter] = useState<"all" | "mandate" | "inactive">("all");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<ClientKind>("doctor");
  const [name, setName] = useState("");
  const [clinic, setClinic] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [agentId, setAgentId] = useState(data.agents.find((agent) => agent.active)?.id ?? "");
  const [discount, setDiscount] = useState(15);
  const needle = query.trim().toLowerCase();

  const rows = data.doctors
    .map((doctor) => ({ doctor, account: doctorAccounts(data, doctor.id, today) }))
    .filter(({ doctor, account }) => {
      if (filter === "mandate" && account.overdue < 1) return false;
      if (filter === "inactive" && doctor.active) return false;
      if (!needle) return true;
      return `${doctor.name} ${doctor.clinic} ${doctor.city}`.toLowerCase().includes(needle);
    })
    .sort((a, b) => Number(b.account.overdue >= 1) - Number(a.account.overdue >= 1) || a.doctor.name.localeCompare(b.doctor.name));

  return (
    <div>
      <PageHeader
        kicker="Clients"
        title="Doctors and pharmacies"
        lede="Discount sits on the client, not the product. Leaving the panel marks them inactive — history stays."
      />
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", "All"],
            ["mandate", "On mandate"],
            ["inactive", "Inactive"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={cn("min-h-11 rounded-full px-3 text-sm font-medium", filter === id ? "bg-forest text-on-forest" : "bg-sunken")}
          >
            {label}
          </button>
        ))}
      </div>
      <label className="mt-4 block">
        <span className="sr-only">Search clients</span>
        <TextInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, clinic, city" />
      </label>
      <ul className="mt-4">
        {rows.map(({ doctor, account }) => {
          const agent = data.agents.find((row) => row.id === doctor.agentId);
          return (
            <li key={doctor.id} className="border-b border-line">
              <Link to="/clients/$clientId" params={{ clientId: doctor.id }} className="grid gap-1 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <span>
                  <span className="font-medium">{doctor.name}</span>
                  <span className="mt-0.5 block text-sm text-muted">
                    {KIND_LABEL[doctor.kind]} · {doctor.city} · {agent?.name}
                    {doctor.active ? "" : " · inactive"}
                  </span>
                </span>
                <span className="text-sm tabular-nums md:text-right">
                  <span className="block">{formatBalance(account.balance)}</span>
                  {account.overdue >= 1 ? <span className="text-copper">Overdue {formatMoney(account.overdue)}</span> : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {rows.length === 0 ? (
        <div className="mt-4">
          <EmptyNote title="No clients in this view" body="Clear the filter, or add someone new below." />
        </div>
      ) : null}

      <details className="mt-8 rounded-xl bg-card p-4 shadow-card">
        <summary className="min-h-11 font-medium">Add a client</summary>
        <form
          className="mt-4 grid gap-3 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim() || !clinic.trim() || !agentId) return;
            const id = addDoctor({
              kind,
              name: name.trim(),
              clinic: clinic.trim(),
              city: city.trim(),
              phone: phone.trim(),
              agentId,
              active: true,
              discountRate: Math.min(0.8, Math.max(0, discount / 100)),
              discountOverrides: {},
              approvedRestrictedIds: [],
              notes: "",
            });
            void navigate({ to: "/clients/$clientId", params: { clientId: id } });
          }}
        >
          <div className="flex gap-2 md:col-span-2">
            {(["doctor", "pharmacy"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setKind(item)}
                className={cn("min-h-11 rounded-full px-3 text-sm", kind === item ? "bg-forest text-on-forest" : "bg-sunken")}
              >
                {KIND_LABEL[item]}
              </button>
            ))}
          </div>
          <Field label="Name">
            <TextInput value={name} onChange={(event) => setName(event.target.value)} required />
          </Field>
          <Field label="Clinic or shop">
            <TextInput value={clinic} onChange={(event) => setClinic(event.target.value)} required />
          </Field>
          <Field label="City">
            <TextInput value={city} onChange={(event) => setCity(event.target.value)} />
          </Field>
          <Field label="Phone">
            <TextInput value={phone} onChange={(event) => setPhone(event.target.value)} />
          </Field>
          <Field label="Agent">
            <SelectInput value={agentId} onChange={(event) => setAgentId(event.target.value)} required>
              {data.agents.filter((agent) => agent.active).map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Discount %" hint="Off retail, before sales tax.">
            <TextInput
              type="number"
              min={0}
              max={80}
              step={0.5}
              value={discount}
              onChange={(event) => setDiscount(Number(event.target.value))}
            />
          </Field>
          <div className="md:col-span-2">
            <Button type="submit">Save client</Button>
          </div>
        </form>
      </details>
    </div>
  );
}
