import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/shell";
import { OverduePage } from "@/features/overdue";

export const Route = createFileRoute("/overdue")({
  head: () => ({ meta: [{ title: "Overdue · Helix" }] }),
  component: () => (
    <Shell>
      <OverduePage />
    </Shell>
  ),
});
