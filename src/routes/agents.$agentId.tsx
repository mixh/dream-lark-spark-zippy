import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/shell";
import { AgentPage } from "@/features/agent";

export const Route = createFileRoute("/agents/$agentId")({
  head: () => ({ meta: [{ title: "Agent · Helix" }] }),
  component: function AgentRoute() {
    const { agentId } = Route.useParams();
    return (
      <Shell>
        <AgentPage agentId={agentId} />
      </Shell>
    );
  },
});
