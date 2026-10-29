import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/shell";
import { OrderPage } from "@/features/order";

export const Route = createFileRoute("/orders/$orderId")({
  head: () => ({ meta: [{ title: "Order · Helix" }] }),
  component: function OrderRoute() {
    const { orderId } = Route.useParams();
    return (
      <Shell>
        <OrderPage orderId={orderId} />
      </Shell>
    );
  },
});
