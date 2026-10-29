import { rateFor } from "./money";
import { displayStatus, isOpenPolicy, verdictFor } from "./policy";
import type {
  Capture,
  Channel,
  DeliveryMode,
  LedgerData,
  Order,
  OrderLine,
  ReturnLine,
  ReturnReason,
  StockMove,
} from "./types";

/**
 * Commands are the only way the book moves.
 * Screens — and later mail, WhatsApp, or OCR workers — call these.
 * They do not reimplement credit, approval, or stock rules.
 */

export interface NewOrderInput {
  today: string;
  doctorId: string;
  agentId: string;
  channel: Channel;
  capture: Capture;
  rawMessage: string;
  lines: { productId: string; qty: number }[];
}

export type Command =
  | { type: "run_checks"; orderId: string; today: string }
  | { type: "grant_exception"; orderId: string; today: string; note: string }
  | { type: "grant_approval"; orderId: string; today: string; note: string }
  | { type: "send_to_depot"; orderId: string; today: string }
  | { type: "mark_received"; orderId: string; today: string }
  | { type: "mark_packed"; orderId: string; today: string }
  | { type: "dispatch"; orderId: string; today: string; mode: DeliveryMode; courierName: string }
  | { type: "mark_delivered"; orderId: string; today: string }
  | { type: "cancel"; orderId: string; today: string }
  | { type: "set_lines"; orderId: string; today: string; lines: { productId: string; qty: number }[] }
  | {
      type: "create_return";
      orderId: string;
      today: string;
      reason: ReturnReason;
      note: string;
      lines: { productId: string; qty: number }[];
    }
  | { type: "send_return"; returnId: string; today: string }
  | { type: "settle_return"; returnId: string; today: string }
  | { type: "void_return"; returnId: string; today: string };

export interface CommandResult {
  data: LedgerData;
  error?: string;
  id?: string;
}

function replaceOrder(data: LedgerData, order: Order): LedgerData {
  return { ...data, orders: data.orders.map((row) => (row.id === order.id ? order : row)) };
}

function addMoves(data: LedgerData, moves: StockMove[]): LedgerData {
  const have = new Set(data.moves.map((move) => move.id));
  const extra = moves.filter((move) => !have.has(move.id));
  if (!extra.length) return data;
  return { ...data, moves: [...data.moves, ...extra] };
}

function findOrder(data: LedgerData, orderId: string) {
  return data.orders.find((order) => order.id === orderId);
}

function snapshotLines(
  data: LedgerData,
  order: Order,
  next: { productId: string; qty: number }[],
): { lines: OrderLine[] } | { error: string } {
  const doctor = data.doctors.find((row) => row.id === order.doctorId);
  if (!doctor) return { error: "Client is missing from the book." };
  if (!next.length) return { error: "An order needs at least one line." };
  const merged = new Map<string, number>();
  for (const line of next) {
    if (!Number.isInteger(line.qty) || line.qty < 1 || line.qty > 9999) {
      return { error: "Quantity has to be a whole number from 1 to 9999." };
    }
    merged.set(line.productId, (merged.get(line.productId) ?? 0) + line.qty);
  }
  const lines: OrderLine[] = [];
  for (const [productId, qty] of merged) {
    const product = data.products.find((row) => row.id === productId);
    if (!product) return { error: "One of the products is not on the catalog." };
    const prev = order.lines.find((row) => row.productId === productId);
    lines.push(
      prev
        ? { ...prev, qty }
        : {
            id: `ln-${order.id}-${productId}`,
            productId,
            qty,
            mrp: product.mrp,
            discountRate: rateFor(doctor, productId),
            taxRate: product.taxRate,
          },
    );
  }
  return { lines };
}

function lineKey(lines: { productId: string; qty: number }[]) {
  return lines
    .map((line) => `${line.productId}:${line.qty}`)
    .sort()
    .join("|");
}

export function placeOrder(data: LedgerData, input: NewOrderInput): CommandResult {
  const doctor = data.doctors.find((row) => row.id === input.doctorId);
  if (!doctor) return { data, error: "Choose a client who is on the book." };
  const agent = data.agents.find((row) => row.id === input.agentId);
  if (!agent) return { data, error: "Choose the agent who brought this order." };
  if (!input.lines.length) return { data, error: "Add at least one product." };

  const seq = data.seq + 1;
  const id = `o-${seq}`;
  const number = `NL-${seq}`;
  const draft: Order = {
    id,
    number,
    doctorId: doctor.id,
    agentId: agent.id,
    channel: input.channel,
    capture: input.capture,
    rawMessage: input.rawMessage.trim().slice(0, 4000),
    status: "intake",
    createdOn: input.today,
    exceptionGranted: false,
    exceptionNote: "",
    approvalGranted: false,
    approvalNote: "",
    deliveryMode: null,
    courierName: "",
    lines: [],
    billedOn: null,
    depotBillNumber: null,
    receivedOn: null,
    packedOn: null,
    deliveryBillNumber: null,
    dispatchedOn: null,
    deliveredOn: null,
    events: [{ at: input.today, message: "Captured." }],
  };
  const snapped = snapshotLines(data, draft, input.lines);
  if ("error" in snapped) return { data, error: snapped.error };
  const order: Order = { ...draft, lines: snapped.lines };
  return {
    data: { ...data, seq, orders: [order, ...data.orders] },
    id,
  };
}

function returnedQty(data: LedgerData, orderId: string, productId: string) {
  return data.returns
    .filter((ret) => ret.sourceOrderId === orderId && ret.status !== "void")
    .flatMap((ret) => ret.lines)
    .filter((line) => line.productId === productId)
    .reduce((sum, line) => sum + line.qty, 0);
}

export function applyCommand(data: LedgerData, cmd: Command): CommandResult {
  if (cmd.type === "create_return" || cmd.type === "send_return" || cmd.type === "settle_return" || cmd.type === "void_return") {
    return applyReturn(data, cmd);
  }

  const order = findOrder(data, cmd.orderId);
  if (!order) return { data, error: "That order is not on the book." };

  switch (cmd.type) {
    case "run_checks": {
      if (!isOpenPolicy(order.status)) return { data };
      const next = displayStatus(order, data, cmd.today);
      if (next === order.status) return { data };
      const message =
        next === "credit_hold"
          ? "Held on the client check."
          : next === "approval_needed"
            ? "Held for product approval."
            : "Checks cleared.";
      return {
        data: replaceOrder(data, {
          ...order,
          status: next,
          events: [...order.events, { at: cmd.today, message }],
        }),
      };
    }
    case "grant_exception": {
      const note = cmd.note.trim();
      if (note.length < 3) return { data, error: "Write who signed the exception, and why." };
      const verdict = verdictFor(order, data, cmd.today);
      if (!(verdict.kind === "credit_hold" && verdict.reason === "overdue")) {
        return { data, error: "This order is not on an overdue hold." };
      }
      const flagged: Order = {
        ...order,
        exceptionGranted: true,
        exceptionNote: note,
        events: [...order.events, { at: cmd.today, message: `Exception signed. ${note}` }],
      };
      const withFlag = replaceOrder(data, flagged);
      const status = displayStatus(flagged, withFlag, cmd.today);
      return { data: replaceOrder(withFlag, { ...flagged, status }) };
    }
    case "grant_approval": {
      const note = cmd.note.trim();
      if (note.length < 3) return { data, error: "Write who approved the supply, and why." };
      const verdict = verdictFor(order, data, cmd.today);
      if (verdict.kind !== "approval_needed") {
        return { data, error: "This order is not waiting on a product approval." };
      }
      const flagged: Order = {
        ...order,
        approvalGranted: true,
        approvalNote: note,
        events: [...order.events, { at: cmd.today, message: `Approval recorded. ${note}` }],
      };
      const withFlag = replaceOrder(data, flagged);
      const status = displayStatus(flagged, withFlag, cmd.today);
      return { data: replaceOrder(withFlag, { ...flagged, status }) };
    }
    case "send_to_depot": {
      if (!isOpenPolicy(order.status)) return { data, error: "This order has already moved on." };
      if (verdictFor(order, data, cmd.today).kind !== "ready") {
        return { data, error: "Checks are not clear yet." };
      }
      const depotBillNumber = `DB-${order.number.replace(/^NL-/, "")}`;
      return {
        data: replaceOrder(data, {
          ...order,
          status: "at_depot",
          billedOn: cmd.today,
          depotBillNumber,
          events: [
            ...order.events,
            { at: cmd.today, message: `Depot bill ${depotBillNumber} sent to ${data.settings.depotName}.` },
          ],
        }),
      };
    }
    case "mark_received": {
      if (order.status !== "at_depot") return { data, error: "Goods can only be received against a depot bill." };
      const moves: StockMove[] = order.lines.map((line) => ({
        id: `mv-${order.id}-in-${line.id}`,
        productId: line.productId,
        qty: line.qty,
        kind: "receive",
        on: cmd.today,
        ref: order.number,
      }));
      const next = replaceOrder(data, {
        ...order,
        status: "received",
        receivedOn: cmd.today,
        events: [...order.events, { at: cmd.today, message: "Goods received in the office." }],
      });
      return { data: addMoves(next, moves) };
    }
    case "mark_packed": {
      if (order.status !== "received") return { data, error: "Pack the order after the goods are in the office." };
      const deliveryBillNumber = `DL-${order.number.replace(/^NL-/, "")}`;
      return {
        data: replaceOrder(data, {
          ...order,
          status: "packed",
          packedOn: cmd.today,
          deliveryBillNumber,
          events: [...order.events, { at: cmd.today, message: `Packed. Delivery bill ${deliveryBillNumber} cut.` }],
        }),
      };
    }
    case "dispatch": {
      if (order.status !== "packed") return { data, error: "Hand over only a packed order." };
      const courierName = cmd.courierName.trim();
      if (cmd.mode === "courier" && courierName.length < 2) {
        return { data, error: "Name the courier who is picking this up." };
      }
      const moves: StockMove[] = order.lines.map((line) => ({
        id: `mv-${order.id}-out-${line.id}`,
        productId: line.productId,
        qty: -line.qty,
        kind: "dispatch",
        on: cmd.today,
        ref: order.number,
      }));
      const who = cmd.mode === "courier" ? courierName : "office staff";
      const next = replaceOrder(data, {
        ...order,
        status: "dispatched",
        dispatchedOn: cmd.today,
        deliveryMode: cmd.mode,
        courierName: cmd.mode === "courier" ? courierName : "",
        events: [...order.events, { at: cmd.today, message: `Handed to ${who}.` }],
      });
      return { data: addMoves(next, moves) };
    }
    case "mark_delivered": {
      if (order.status !== "dispatched") return { data, error: "This order is not out for delivery." };
      return {
        data: replaceOrder(data, {
          ...order,
          status: "delivered",
          deliveredOn: cmd.today,
          events: [...order.events, { at: cmd.today, message: "Delivered to the client." }],
        }),
      };
    }
    case "cancel": {
      if (!isOpenPolicy(order.status)) {
        return { data, error: "After the depot bill, use a return — don’t cancel the order." };
      }
      return {
        data: replaceOrder(data, {
          ...order,
          status: "cancelled",
          events: [...order.events, { at: cmd.today, message: "Cancelled before billing." }],
        }),
      };
    }
    case "set_lines": {
      if (!isOpenPolicy(order.status)) return { data, error: "Lines lock once the depot bill is sent." };
      const snapped = snapshotLines(data, order, cmd.lines);
      if ("error" in snapped) return { data, error: snapped.error };
      if (lineKey(snapped.lines) === lineKey(order.lines)) return { data };
      const edited: Order = {
        ...order,
        lines: snapped.lines,
        approvalGranted: false,
        approvalNote: order.approvalGranted ? "" : order.approvalNote,
        events: [...order.events, { at: cmd.today, message: "Lines changed. Supply check will run again." }],
      };
      const withLines = replaceOrder(data, edited);
      const status = displayStatus(edited, withLines, cmd.today);
      return { data: replaceOrder(withLines, { ...edited, status }) };
    }
    default:
      return { data, error: "Unknown command." };
  }
}

function applyReturn(data: LedgerData, cmd: Extract<Command, { type: "create_return" | "send_return" | "settle_return" | "void_return" }>): CommandResult {
  if (cmd.type === "create_return") {
    const order = findOrder(data, cmd.orderId);
    if (!order) return { data, error: "That order is not on the book." };
    if (order.status !== "delivered") return { data, error: "Returns start from a delivered order." };
    const requested = cmd.lines.filter((line) => line.qty > 0);
    if (!requested.length) return { data, error: "Enter a quantity coming back." };
    const lines: ReturnLine[] = [];
    for (const ask of requested) {
      if (!Number.isInteger(ask.qty) || ask.qty < 1) return { data, error: "Return quantity has to be a whole number." };
      const source = order.lines.find((line) => line.productId === ask.productId);
      if (!source) return { data, error: "That product was not on the delivery." };
      const already = returnedQty(data, order.id, ask.productId);
      if (ask.qty + already > source.qty) {
        return { data, error: "Return quantity is higher than what was delivered." };
      }
      lines.push({
        id: `rl-${data.seq + 1}-${ask.productId}`,
        productId: ask.productId,
        qty: ask.qty,
        mrp: source.mrp,
        discountRate: source.discountRate,
        taxRate: source.taxRate,
      });
    }
    const seq = data.seq + 1;
    const id = `r-${seq}`;
    const number = `RN-${seq}`;
    const moves: StockMove[] = lines.map((line) => ({
      id: `mv-${id}-in-${line.id}`,
      productId: line.productId,
      qty: line.qty,
      kind: "return_in",
      on: cmd.today,
      ref: number,
    }));
    const note = cmd.note.trim();
    const ret = {
      id,
      number,
      doctorId: order.doctorId,
      sourceOrderId: order.id,
      reason: cmd.reason,
      status: "draft" as const,
      createdOn: cmd.today,
      sentOn: null,
      settledOn: null,
      lines,
      note,
    };
    const withReturn = {
      ...data,
      seq,
      returns: [ret, ...data.returns],
      orders: data.orders.map((row) =>
        row.id === order.id
          ? {
              ...row,
              events: [
                ...row.events,
                {
                  at: cmd.today,
                  message: `Return ${number} recorded (${lines.reduce((s, l) => s + l.qty, 0)} packs). Client credited.`,
                },
              ],
            }
          : row,
      ),
    };
    return { data: addMoves(withReturn, moves), id };
  }

  const ret = data.returns.find((row) => row.id === cmd.returnId);
  if (!ret) return { data, error: "That return is not on the book." };

  if (cmd.type === "void_return") {
    if (ret.status !== "draft") return { data, error: "Only a return still in the office can be voided." };
    return {
      data: {
        ...data,
        returns: data.returns.map((row) => (row.id === ret.id ? { ...row, status: "void" } : row)),
        moves: data.moves.filter((move) => !move.id.startsWith(`mv-${ret.id}-`)),
        orders: data.orders.map((row) =>
          row.id === ret.sourceOrderId
            ? {
                ...row,
                events: [...row.events, { at: cmd.today, message: `Return ${ret.number} voided.` }],
              }
            : row,
        ),
      },
    };
  }

  if (cmd.type === "send_return") {
    if (ret.status !== "draft") return { data, error: "This return has already left the office." };
    const moves: StockMove[] = ret.lines.map((line) => ({
      id: `mv-${ret.id}-out-${line.id}`,
      productId: line.productId,
      qty: -line.qty,
      kind: "return_out",
      on: cmd.today,
      ref: ret.number,
    }));
    const next: LedgerData = {
      ...data,
      returns: data.returns.map((row) =>
        row.id === ret.id ? { ...row, status: "sent_to_depot", sentOn: cmd.today } : row,
      ),
      orders: data.orders.map((row) =>
        row.id === ret.sourceOrderId
          ? {
              ...row,
              events: [
                ...row.events,
                { at: cmd.today, message: `Return ${ret.number} sent to ${data.settings.depotName}.` },
              ],
            }
          : row,
      ),
    };
    return { data: addMoves(next, moves) };
  }

  if (ret.status !== "sent_to_depot") return { data, error: "Settle a return only after it has gone to the depot." };
  return {
    data: {
      ...data,
      returns: data.returns.map((row) =>
        row.id === ret.id ? { ...row, status: "settled", settledOn: cmd.today } : row,
      ),
      orders: data.orders.map((row) =>
        row.id === ret.sourceOrderId
          ? {
              ...row,
              events: [...row.events, { at: cmd.today, message: `Return ${ret.number} settled with the depot.` }],
            }
          : row,
      ),
    },
  };
}
