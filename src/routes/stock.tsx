import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/shell";
import { StockPage } from "@/features/stock";

export const Route = createFileRoute("/stock")({
  head: () => ({ meta: [{ title: "Stock · Helix" }] }),
  component: () => (
    <Shell>
      <StockPage />
    </Shell>
  ),
});
