import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/shell";
import { DeskPage } from "@/features/desk";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Desk · Helix" }] }),
  component: () => (
    <Shell>
      <DeskPage />
    </Shell>
  ),
});
