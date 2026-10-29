import { doctorAccounts } from "./aging";
import { formatMoney } from "./money";
import type { Doctor, LedgerData, Order, OrderStatus, Product } from "./types";

export function isOpenPolicy(status: OrderStatus): boolean {
  return (
    status === "intake" ||
    status === "credit_hold" ||
    status === "approval_needed" ||
    status === "ready"
  );
}

export function productNeedsApproval(doctor: Doctor, product: Product): boolean {
  if (!product.restricted) return false;
  return !doctor.approvedRestrictedIds.includes(product.id);
}

export type Verdict =
  | {
      kind: "credit_hold";
      reason: "missing" | "inactive" | "overdue";
      days: number | null;
      overdue: number;
    }
  | { kind: "approval_needed"; productIds: string[] }
  | { kind: "ready" };

export function verdictFor(order: Order, data: LedgerData, today: string): Verdict {
  const doctor = data.doctors.find((d) => d.id === order.doctorId);
  if (!doctor) return { kind: "credit_hold", reason: "missing", days: null, overdue: 0 };
  if (!doctor.active) return { kind: "credit_hold", reason: "inactive", days: null, overdue: 0 };

  const account = doctorAccounts(data, doctor.id, today);
  if (account.overdue >= 1 && !order.exceptionGranted) {
    return {
      kind: "credit_hold",
      reason: "overdue",
      days: account.oldestDays,
      overdue: account.overdue,
    };
  }

  if (!order.approvalGranted) {
    const productIds = [
      ...new Set(
        order.lines
          .map((line) => line.productId)
          .filter((id) => {
            const product = data.products.find((p) => p.id === id);
            return product ? productNeedsApproval(doctor, product) : false;
          }),
      ),
    ];
    if (productIds.length) return { kind: "approval_needed", productIds };
  }

  return { kind: "ready" };
}

export function displayStatus(order: Order, data: LedgerData, today: string): OrderStatus {
  if (!isOpenPolicy(order.status)) return order.status;
  const verdict = verdictFor(order, data, today);
  if (verdict.kind === "credit_hold") return "credit_hold";
  if (verdict.kind === "approval_needed") return "approval_needed";
  return "ready";
}

export function explain(order: Order, data: LedgerData, today: string): string {
  const status = displayStatus(order, data, today);
  const doctor = data.doctors.find((d) => d.id === order.doctorId);
  const name = doctor?.name ?? "This client";
  const mandate = data.settings.overdueDays;

  if (status === "credit_hold") {
    const verdict = verdictFor(order, data, today);
    if (verdict.kind === "credit_hold" && verdict.reason === "inactive") {
      return `${name} is inactive. Reactivate the file before supplying.`;
    }
    if (verdict.kind === "credit_hold" && verdict.reason === "missing") {
      return "This client is not on the book.";
    }
    if (verdict.kind === "credit_hold") {
      const age = verdict.days != null ? `${verdict.days} days open` : "past the line";
      return `${name} is on the ${mandate}-day mandate — ${formatMoney(verdict.overdue)}, ${age}. Sign an exception to move this order.`;
    }
  }

  if (status === "approval_needed") {
    const verdict = verdictFor(order, data, today);
    const names =
      verdict.kind === "approval_needed"
        ? verdict.productIds.map((id) => data.products.find((p) => p.id === id)?.name ?? "A product").join(", ")
        : "A product";
    return `${names} is not approved for ${name}. Record an approval, or take the line off.`;
  }

  if (status === "ready") return "Checks are clear. Send the depot bill when you want it picked.";
  if (status === "at_depot") {
    return `${order.depotBillNumber ?? "Depot bill"} is with ${data.settings.depotName}. Mark it when the goods arrive.`;
  }
  if (status === "received") return "Goods are in the office. Pack them and cut the delivery bill.";
  if (status === "packed") return `${order.deliveryBillNumber ?? "Delivery bill"} is ready. Hand it to staff or a courier.`;
  if (status === "dispatched") {
    const who = order.deliveryMode === "courier" ? order.courierName || "the courier" : "office staff";
    return `Out with ${who}. Mark delivered when the client has it.`;
  }
  if (status === "delivered") return "Delivered. Record a return here if anything comes back.";
  if (status === "cancelled") return "Cancelled before it was billed.";
  return "Captured. The checks run as soon as the lines are in.";
}
