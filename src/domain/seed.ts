import { addDays } from "./dates";
import { linesTotal, rateFor, round2 } from "./money";
import type {
  Agent,
  Capture,
  Channel,
  DeliveryMode,
  Doctor,
  LedgerData,
  Order,
  OrderLine,
  OrderStatus,
  Payment,
  PayMethod,
  Product,
  ReturnOrder,
  StockMove,
} from "./types";

const products: Product[] = [
  { id: "p1", sku: "AUG-625", name: "Augmentin 625", pack: "10 tablets", mrp: 320, taxRate: 0.12, restricted: false, category: "Antibiotic" },
  { id: "p2", sku: "PND-500", name: "Panadol 500", pack: "200 tablets", mrp: 180, taxRate: 0.05, restricted: false, category: "Analgesic" },
  { id: "p3", sku: "AMX-250", name: "Amoxil 250 suspension", pack: "100 ml", mrp: 240, taxRate: 0.12, restricted: false, category: "Antibiotic" },
  { id: "p4", sku: "INS-PEN", name: "Glargine insulin pen", pack: "3 ml", mrp: 1450, taxRate: 0.05, restricted: true, category: "Diabetes" },
  { id: "p5", sku: "ORS-20", name: "ORS sachets", pack: "20 sachets", mrp: 160, taxRate: 0.05, restricted: false, category: "Rehydration" },
  { id: "p6", sku: "AZI-250", name: "Azithromycin 250", pack: "6 capsules", mrp: 210, taxRate: 0.12, restricted: false, category: "Antibiotic" },
  { id: "p7", sku: "MET-500", name: "Metformin 500", pack: "60 tablets", mrp: 95, taxRate: 0.05, restricted: false, category: "Diabetes" },
  { id: "p8", sku: "LOS-50", name: "Losartan 50", pack: "30 tablets", mrp: 140, taxRate: 0.05, restricted: false, category: "Cardiac" },
  { id: "p9", sku: "CFX-200", name: "Cefixime 200", pack: "10 tablets", mrp: 260, taxRate: 0.12, restricted: false, category: "Antibiotic" },
  { id: "p10", sku: "VTD-60", name: "Vitamin D 60k", pack: "4 sachets", mrp: 120, taxRate: 0.12, restricted: false, category: "Supplement" },
];

const agents: Agent[] = [
  { id: "a1", name: "Sana Qureshi", phone: "0300-555-0141", territory: "North ward", active: true, joinedOn: "2023-04-12" },
  { id: "a2", name: "Imran Dalal", phone: "0300-555-0142", territory: "Central", active: true, joinedOn: "2022-11-02" },
  { id: "a3", name: "Leena Varghese", phone: "0300-555-0143", territory: "Harbour", active: true, joinedOn: "2024-01-18" },
  { id: "a4", name: "Farooq Seth", phone: "0300-555-0144", territory: "Old East", active: false, joinedOn: "2021-02-01" },
];

const doctors: Doctor[] = [
  { id: "d1", kind: "doctor", name: "Dr. Anita Kapoor", clinic: "Kapoor Family Clinic", city: "North ward", phone: "0300-555-1001", agentId: "a1", active: true, discountRate: 0.18, discountOverrides: {}, approvedRestrictedIds: [], notes: "Pays within the week. Prefers WhatsApp." },
  { id: "d2", kind: "pharmacy", name: "City Care Pharmacy", clinic: "City Care Pharmacy", city: "Saddar", phone: "0300-555-1002", agentId: "a1", active: true, discountRate: 0.22, discountOverrides: { p5: 0.28 }, approvedRestrictedIds: [], notes: "Extra 28% on ORS only. Returns near-expiry stock quickly." },
  { id: "d3", kind: "doctor", name: "Dr. Rohan Mehta", clinic: "Mehta Medical", city: "Central", phone: "0300-555-1003", agentId: "a2", active: true, discountRate: 0.12, discountOverrides: {}, approvedRestrictedIds: [], notes: "Pays in lumps. The mandate is firm unless the owner signs an exception." },
  { id: "d4", kind: "doctor", name: "Hale Street Clinic", clinic: "Hale Street Clinic", city: "Central", phone: "0300-555-1004", agentId: "a2", active: true, discountRate: 0.15, discountOverrides: {}, approvedRestrictedIds: [], notes: "Balance is open but still inside the mandate." },
  { id: "d5", kind: "pharmacy", name: "Green Cross Pharmacy", clinic: "Green Cross Pharmacy", city: "Central", phone: "0300-555-1005", agentId: "a2", active: true, discountRate: 0.2, discountOverrides: {}, approvedRestrictedIds: [], notes: "No collection since the September bill." },
  { id: "d6", kind: "doctor", name: "Dr. Yusuf Rahman", clinic: "Rahman Chest Clinic", city: "Harbour", phone: "0300-555-1006", agentId: "a3", active: true, discountRate: 0.16, discountOverrides: {}, approvedRestrictedIds: ["p4"], notes: "Insulin is already approved for this clinic." },
  { id: "d7", kind: "pharmacy", name: "Riverside Pharmacy", clinic: "Riverside Pharmacy", city: "Harbour", phone: "0300-555-1007", agentId: "a3", active: true, discountRate: 0.21, discountOverrides: {}, approvedRestrictedIds: [], notes: "" },
  { id: "d8", kind: "pharmacy", name: "Nightingale Stores", clinic: "Nightingale Stores", city: "North ward", phone: "0300-555-1008", agentId: "a1", active: true, discountRate: 0.1, discountOverrides: {}, approvedRestrictedIds: [], notes: "Insulin is restricted here until someone signs an approval." },
  { id: "d9", kind: "doctor", name: "Dr. Maya Iyer", clinic: "Iyer Practice", city: "Old East", phone: "0300-555-1009", agentId: "a4", active: false, discountRate: 0.14, discountOverrides: {}, approvedRestrictedIds: [], notes: "Left the panel in June. Kept on the book so the history stays." },
];

interface Spec {
  id: string;
  number: string;
  doctorId: string;
  agentId: string;
  channel: Channel;
  capture: Capture;
  createdOn: string;
  status: OrderStatus;
  items: [string, number][];
  pay: "full" | "half" | "none" | number;
  payMethod?: PayMethod;
  payRef?: string;
  paidOn?: string;
  raw?: string;
  deliveryMode?: DeliveryMode;
  courierName?: string;
  receivedOn?: string;
  packedOn?: string;
  dispatchedOn?: string;
  deliveredOn?: string;
  holdNote?: string;
}

const specs: Spec[] = [
  {
    id: "o-maya",
    number: "NL-2204",
    doctorId: "d9",
    agentId: "a4",
    channel: "counter",
    capture: "spoken",
    createdOn: "2026-05-12",
    status: "delivered",
    items: [["p2", 10], ["p10", 4]],
    pay: "full",
    raw: "Counter slip. Dr. Maya Iyer. Panadol and Vitamin D.",
  },
  {
    id: "o-roh-1",
    number: "NL-2302",
    doctorId: "d3",
    agentId: "a2",
    channel: "gmail",
    capture: "email",
    createdOn: "2026-08-20",
    status: "delivered",
    items: [["p1", 40], ["p6", 30], ["p2", 24]],
    pay: 8000,
    payMethod: "cheque",
    payRef: "CHQ-4412",
    paidOn: "2026-09-02",
    raw: "Email from Imran. Dr. Rohan Mehta — Augmentin 625 x 40, Azithromycin 250 x 30, Panadol 500 x 24.",
  },
  {
    id: "o-gc-1",
    number: "NL-2330",
    doctorId: "d5",
    agentId: "a2",
    channel: "whatsapp",
    capture: "chat",
    createdOn: "2026-09-05",
    status: "delivered",
    items: [["p9", 30], ["p7", 40], ["p5", 20]],
    pay: "none",
    raw: "Green Cross Pharmacy\nCefixime 200 x 30\nMetformin 500 x 40\nORS sachets x 20",
  },
  {
    id: "o-hale-1",
    number: "NL-2344",
    doctorId: "d4",
    agentId: "a2",
    channel: "whatsapp",
    capture: "chat",
    createdOn: "2026-09-22",
    status: "delivered",
    items: [["p8", 36], ["p2", 15]],
    pay: "half",
    raw: "Hale Street Clinic\nLosartan 50 x 36\nPanadol 500 x 15",
  },
  {
    id: "o-fill-1",
    number: "NL-2401",
    doctorId: "d1",
    agentId: "a1",
    channel: "whatsapp",
    capture: "chat",
    createdOn: "2026-10-01",
    status: "delivered",
    items: [["p1", 6], ["p5", 10]],
    pay: "full",
  },
  {
    id: "o-fill-2",
    number: "NL-2403",
    doctorId: "d2",
    agentId: "a1",
    channel: "gmail",
    capture: "email",
    createdOn: "2026-10-03",
    status: "delivered",
    items: [["p2", 12], ["p7", 20]],
    pay: "full",
  },
  {
    id: "o-yus-1",
    number: "NL-2406",
    doctorId: "d6",
    agentId: "a3",
    channel: "gmail",
    capture: "email",
    createdOn: "2026-10-06",
    status: "delivered",
    items: [["p4", 8], ["p7", 20]],
    pay: "full",
    deliveryMode: "courier",
    courierName: "Swift Parcel",
    raw: "Dr. Yusuf Rahman\nGlargine insulin pen x 8\nMetformin 500 x 20",
  },
  {
    id: "o-fill-3",
    number: "NL-2408",
    doctorId: "d6",
    agentId: "a3",
    channel: "whatsapp",
    capture: "chat",
    createdOn: "2026-10-08",
    status: "delivered",
    items: [["p8", 15], ["p10", 10]],
    pay: "full",
  },
  {
    id: "o-cc-1",
    number: "NL-2410",
    doctorId: "d2",
    agentId: "a1",
    channel: "whatsapp",
    capture: "chat",
    createdOn: "2026-10-10",
    status: "delivered",
    items: [["p10", 24], ["p3", 16], ["p5", 10]],
    pay: "full",
    raw: "City Care Pharmacy\nVitamin D 60k x 24\nAmoxil 250 suspension x 16\nORS sachets x 10",
  },
  {
    id: "o-fill-4",
    number: "NL-2414",
    doctorId: "d7",
    agentId: "a3",
    channel: "gmail",
    capture: "email",
    createdOn: "2026-10-14",
    status: "delivered",
    items: [["p6", 8], ["p3", 6]],
    pay: "full",
  },
  {
    id: "o-fill-5",
    number: "NL-2416",
    doctorId: "d1",
    agentId: "a1",
    channel: "whatsapp",
    capture: "chat",
    createdOn: "2026-10-16",
    status: "delivered",
    items: [["p9", 10]],
    pay: "full",
  },
  {
    id: "o-yus-2",
    number: "NL-2418",
    doctorId: "d6",
    agentId: "a3",
    channel: "whatsapp",
    capture: "chat",
    createdOn: "2026-10-18",
    status: "delivered",
    items: [["p1", 12], ["p8", 10]],
    pay: "full",
  },
  {
    id: "o-cc-2",
    number: "NL-2421",
    doctorId: "d2",
    agentId: "a1",
    channel: "whatsapp",
    capture: "chat",
    createdOn: "2026-10-21",
    status: "delivered",
    items: [["p2", 20], ["p9", 12]],
    pay: "half",
    paidOn: "2026-10-24",
  },
  {
    id: "o-fill-6",
    number: "NL-2423",
    doctorId: "d2",
    agentId: "a1",
    channel: "whatsapp",
    capture: "photo",
    createdOn: "2026-10-23",
    status: "delivered",
    items: [["p5", 18], ["p2", 8]],
    pay: "full",
    raw: "Photo of a City Care shelf list. ORS x 18, Panadol x 8. Transcribed by hand.",
  },
  {
    id: "o-riv",
    number: "NL-2427",
    doctorId: "d7",
    agentId: "a3",
    channel: "whatsapp",
    capture: "chat",
    createdOn: "2026-10-27",
    status: "packed",
    items: [["p3", 10], ["p5", 12], ["p10", 8]],
    pay: "none",
    receivedOn: "2026-10-29",
    packedOn: "2026-10-29",
    raw: "Riverside Pharmacy\nAmoxil 250 suspension x 10\nORS sachets x 12\nVitamin D 60k x 8",
  },
  {
    id: "o-an-depot",
    number: "NL-2428",
    doctorId: "d1",
    agentId: "a1",
    channel: "gmail",
    capture: "email",
    createdOn: "2026-10-28",
    status: "at_depot",
    items: [["p1", 18], ["p6", 14]],
    pay: "none",
    raw: "Dr. Anita Kapoor\nAugmentin 625 x 18\nAzithromycin 250 x 14",
  },
  {
    id: "o-night",
    number: "NL-2429",
    doctorId: "d8",
    agentId: "a1",
    channel: "whatsapp",
    capture: "photo",
    createdOn: "2026-10-29",
    status: "approval_needed",
    items: [["p4", 5], ["p2", 6]],
    pay: "none",
    raw: "Nightingale Stores\n(photo of a handwritten slip — transcribed)\nGlargine insulin pen x 5\nPanadol 500 x 6",
    holdNote: "Held for product approval.",
  },
  {
    id: "o-roh-2",
    number: "NL-2430",
    doctorId: "d3",
    agentId: "a2",
    channel: "whatsapp",
    capture: "chat",
    createdOn: "2026-10-29",
    status: "credit_hold",
    items: [["p3", 14]],
    pay: "none",
    raw: "Dr. Rohan Mehta\nAmoxil 250 suspension x 14",
    holdNote: "Held on the overdue mandate.",
  },
  {
    id: "o-hale-ready",
    number: "NL-2431",
    doctorId: "d4",
    agentId: "a2",
    channel: "gmail",
    capture: "email",
    createdOn: "2026-10-29",
    status: "ready",
    items: [["p7", 20], ["p8", 10]],
    pay: "none",
    raw: "Hale Street Clinic\nMetformin 500 x 20\nLosartan 50 x 10",
    holdNote: "Checks cleared. Waiting on the depot bill.",
  },
];

function doctorOf(id: string): Doctor {
  const doctor = doctors.find((row) => row.id === id);
  if (!doctor) throw new Error(`missing doctor ${id}`);
  return doctor;
}

function productOf(id: string): Product {
  const product = products.find((row) => row.id === id);
  if (!product) throw new Error(`missing product ${id}`);
  return product;
}

function buildLines(spec: Spec): OrderLine[] {
  const doctor = doctorOf(spec.doctorId);
  return spec.items.map(([productId, qty], index) => {
    const product = productOf(productId);
    return {
      id: `${spec.id}-l${index + 1}`,
      productId,
      qty,
      mrp: product.mrp,
      discountRate: rateFor(doctor, productId),
      taxRate: product.taxRate,
    };
  });
}

const billed = new Set<OrderStatus>(["at_depot", "received", "packed", "dispatched", "delivered"]);
const received = new Set<OrderStatus>(["received", "packed", "dispatched", "delivered"]);
const packed = new Set<OrderStatus>(["packed", "dispatched", "delivered"]);
const dispatched = new Set<OrderStatus>(["dispatched", "delivered"]);

function buildOrder(spec: Spec): Order {
  const lines = buildLines(spec);
  const isBilled = billed.has(spec.status);
  const isReceived = received.has(spec.status);
  const isPacked = packed.has(spec.status);
  const isDispatched = dispatched.has(spec.status);
  const isDelivered = spec.status === "delivered";
  const billedOn = isBilled ? spec.createdOn : null;
  const receivedOn = spec.receivedOn ?? (isReceived ? addDays(spec.createdOn, 1) : null);
  const packedOn = spec.packedOn ?? (isPacked ? receivedOn : null);
  const dispatchedOn = spec.dispatchedOn ?? (isDispatched ? addDays(spec.createdOn, 2) : null);
  const deliveredOn = spec.deliveredOn ?? (isDelivered ? dispatchedOn : null);
  const depotBillNumber = isBilled ? `DB-${spec.number.replace(/^NL-/, "")}` : null;
  const deliveryBillNumber = isPacked ? `DL-${spec.number.replace(/^NL-/, "")}` : null;
  const deliveryMode = isDispatched ? spec.deliveryMode ?? "staff" : null;
  const courierName = deliveryMode === "courier" ? spec.courierName ?? "" : "";
  const events: Order["events"] = [{ at: spec.createdOn, message: "Captured." }];
  if (spec.holdNote && !isBilled) events.push({ at: spec.createdOn, message: spec.holdNote });
  if (billedOn && depotBillNumber) {
    events.push({ at: billedOn, message: `Depot bill ${depotBillNumber} sent to Central Depot.` });
  }
  if (receivedOn) events.push({ at: receivedOn, message: "Goods received in the office." });
  if (packedOn && deliveryBillNumber) {
    events.push({ at: packedOn, message: `Packed. Delivery bill ${deliveryBillNumber} cut.` });
  }
  if (dispatchedOn) {
    const who = deliveryMode === "courier" ? courierName || "the courier" : "office staff";
    events.push({ at: dispatchedOn, message: `Handed to ${who}.` });
  }
  if (deliveredOn) events.push({ at: deliveredOn, message: "Delivered to the client." });

  return {
    id: spec.id,
    number: spec.number,
    doctorId: spec.doctorId,
    agentId: spec.agentId,
    channel: spec.channel,
    capture: spec.capture,
    rawMessage: spec.raw ?? "",
    status: spec.status,
    createdOn: spec.createdOn,
    exceptionGranted: false,
    exceptionNote: "",
    approvalGranted: false,
    approvalNote: "",
    deliveryMode,
    courierName,
    lines,
    billedOn,
    depotBillNumber,
    receivedOn,
    packedOn,
    deliveryBillNumber,
    dispatchedOn,
    deliveredOn,
    events,
  };
}

function paymentFor(spec: Spec, order: Order, index: number): Payment | null {
  if (spec.pay === "none") return null;
  const total = linesTotal(order.lines);
  const amount = spec.pay === "full" ? total : spec.pay === "half" ? round2(total / 2) : spec.pay;
  if (amount <= 0) return null;
  const method = spec.payMethod ?? (index % 4 === 0 ? "cash" : "bank");
  return {
    id: `pay-${order.id}`,
    doctorId: order.doctorId,
    amount,
    paidOn: spec.paidOn ?? order.deliveredOn ?? order.billedOn ?? order.createdOn,
    method,
    reference: spec.payRef ?? (method === "cash" ? "Cash desk" : `NEFT-${order.number}`),
    note: "",
  };
}

function flowMoves(order: Order): StockMove[] {
  const moves: StockMove[] = [];
  if (order.receivedOn) {
    for (const line of order.lines) {
      moves.push({
        id: `mv-${order.id}-in-${line.id}`,
        productId: line.productId,
        qty: line.qty,
        kind: "receive",
        on: order.receivedOn,
        ref: order.number,
      });
    }
  }
  if (order.dispatchedOn) {
    for (const line of order.lines) {
      moves.push({
        id: `mv-${order.id}-out-${line.id}`,
        productId: line.productId,
        qty: -line.qty,
        kind: "dispatch",
        on: order.dispatchedOn,
        ref: order.number,
      });
    }
  }
  return moves;
}

export function seed(): LedgerData {
  const orders = specs.map(buildOrder);
  const payments = specs
    .map((spec, index) => paymentFor(spec, orders[index] as Order, index))
    .filter((row): row is Payment => row != null);

  const source = orders.find((order) => order.id === "o-cc-1") as Order;
  const vitamin = source.lines.find((line) => line.productId === "p10") as OrderLine;
  const ret: ReturnOrder = {
    id: "r-2410",
    number: "RN-2410",
    doctorId: "d2",
    sourceOrderId: "o-cc-1",
    reason: "near_expiry",
    status: "sent_to_depot",
    createdOn: "2026-10-25",
    sentOn: "2026-10-26",
    settledOn: null,
    note: "Eight packs dated for next month. City Care sent them back with the rider.",
    lines: [
      {
        id: "r-2410-l1",
        productId: "p10",
        qty: 8,
        mrp: vitamin.mrp,
        discountRate: vitamin.discountRate,
        taxRate: vitamin.taxRate,
      },
    ],
  };

  const ordersWithReturn = orders.map((order) =>
    order.id === "o-cc-1"
      ? {
          ...order,
          events: [
            ...order.events,
            { at: "2026-10-25", message: "Return RN-2410 recorded (8 packs). Client credited." },
            { at: "2026-10-26", message: "Return RN-2410 sent to Central Depot." },
          ],
        }
      : order,
  );

  const opening: StockMove[] = [
    ["p1", 24],
    ["p2", 48],
    ["p3", 18],
    ["p4", 8],
    ["p5", 30],
    ["p6", 16],
    ["p7", 36],
    ["p8", 20],
    ["p9", 14],
    ["p10", 22],
  ].map(([productId, qty]) => ({
    id: `mv-open-${productId}`,
    productId: String(productId),
    qty: Number(qty),
    kind: "adjust" as const,
    on: "2026-10-01",
    ref: "Opening count",
  }));

  const returnMoves: StockMove[] = [
    { id: "mv-r-2410-in-r-2410-l1", productId: "p10", qty: 8, kind: "return_in", on: "2026-10-25", ref: "RN-2410" },
    { id: "mv-r-2410-out-r-2410-l1", productId: "p10", qty: -8, kind: "return_out", on: "2026-10-26", ref: "RN-2410" },
  ];

  return {
    settings: { company: "Northline Pharma", depotName: "Central Depot", overdueDays: 45 },
    agents,
    doctors,
    products,
    orders: ordersWithReturn.sort((a, b) => b.createdOn.localeCompare(a.createdOn) || b.number.localeCompare(a.number)),
    payments,
    returns: [ret],
    moves: [...opening, ...orders.flatMap(flowMoves), ...returnMoves],
    seq: 2500,
  };
}
