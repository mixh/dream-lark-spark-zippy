import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/shell";
import { ClientPage } from "@/features/client";

export const Route = createFileRoute("/clients/$clientId")({
  head: () => ({ meta: [{ title: "Client · Helix" }] }),
  component: function ClientRoute() {
    const { clientId } = Route.useParams();
    return (
      <Shell>
        <ClientPage clientId={clientId} />
      </Shell>
    );
  },
});
