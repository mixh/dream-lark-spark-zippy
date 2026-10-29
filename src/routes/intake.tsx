import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/shell";
import { IntakePage } from "@/features/intake";

export const Route = createFileRoute("/intake")({
  head: () => ({ meta: [{ title: "New order · Helix" }] }),
  component: () => (
    <Shell>
      <IntakePage />
    </Shell>
  ),
});
