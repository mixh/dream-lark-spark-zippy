import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/shell";
import { ClientsPage } from "@/features/clients";

export const Route = createFileRoute("/clients")({
  head: () => ({ meta: [{ title: "Clients · Helix" }] }),
  component: () => (
    <Shell>
      <ClientsPage />
    </Shell>
  ),
});
