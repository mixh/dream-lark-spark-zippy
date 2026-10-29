import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/shell";
import { OrdersPage } from "@/features/orders";

export const Route = createFileRoute("/orders")({
  head: () => ({ meta: [{ title: "Orders · Helix" }] }),
  component: () => (
    <Shell>
      <OrdersPage />
    </Shell>
  ),
});
