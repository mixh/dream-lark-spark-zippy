import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/shell";
import { RankingsPage } from "@/features/rankings";

export const Route = createFileRoute("/rankings")({
  head: () => ({ meta: [{ title: "Rankings · Helix" }] }),
  component: () => (
    <Shell>
      <RankingsPage />
    </Shell>
  ),
});
