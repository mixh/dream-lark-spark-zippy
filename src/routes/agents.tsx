import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/shell";
import { AgentsPage } from "@/features/agents";

export const Route = createFileRoute("/agents")({
  head: () => ({ meta: [{ title: "Agents · Helix" }] }),
  component: () => (
    <Shell>
      <AgentsPage />
    </Shell>
  ),
});
