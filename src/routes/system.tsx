import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/shell";
import { SystemPage } from "@/features/system";

export const Route = createFileRoute("/system")({
  head: () => ({ meta: [{ title: "System · Helix" }] }),
  component: () => (
    <Shell>
      <SystemPage />
    </Shell>
  ),
});
