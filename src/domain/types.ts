export type Id = string;

export type Channel = "whatsapp" | "gmail" | "phone" | "counter";
export type Capture = "photo" | "chat" | "email" | "spoken";

export type OrderStatus =
  | "intake"
  | "credit_hold"
  | "approval_needed"
  | "ready"
  | "at_depot"
  | "received"
  | "packed"
  | "dispatched"
  | "delivered"
  | "cancelled";

export type DeliveryMode = "staff" | "courier";
export type PayMethod = "cash" | "bank" | "cheque";
export type ReturnReason = "damage" | "near_expiry" | "wrong_item" | "other";
export type ReturnStatus = "draft" | "sent_to_depot" | "settled" | "void";
export type MoveKind = "receive" | "dispatch" | "return_in" | "return_out" | "adjust";
export type ClientKind = "doctor" | "pharmacy";
export type Period = "month" | "year" | "all";

export interface Settings {
  company: string;
  depotName: string;
  overdueDays: number;
}

export interface Agent {
  id: Id;
  name: string;
  phone: string;
  territory: string;
  active: boolean;
  joinedOn: string;
}

export interface Doctor {
  id: Id;
  kind: ClientKind;
  name: string;
  clinic: string;
  city: string;
  phone: string;
  agentId: Id;
  active: boolean;
  /** 0–1, off retail. Applies to future lines only. */
  discountRate: number;
  discountOverrides: Record<string, number>;
  /** Restricted products this client may receive without a fresh approval. */
  approvedRestrictedIds: Id[];
  notes: string;
}

export interface Product {
  id: Id;
  sku: string;
  name: string;
  pack: string;
  mrp: number;
  /** Sales tax rate, 0–1, applied after discount. */
  taxRate: number;
  restricted: boolean;
  category: string;
}

export interface PricedLine {
  qty: number;
  mrp: number;
  discountRate: number;
  taxRate: number;
}

export interface OrderLine extends PricedLine {
  id: Id;
  productId: Id;
}

export interface OrderEvent {
  at: string;
  message: string;
}

export interface Order {
  id: Id;
  number: string;
  doctorId: Id;
  agentId: Id;
  channel: Channel;
  capture: Capture;
  rawMessage: string;
  status: OrderStatus;
  createdOn: string;
  exceptionGranted: boolean;
  exceptionNote: string;
  approvalGranted: boolean;
  approvalNote: string;
  deliveryMode: DeliveryMode | null;
  courierName: string;
  lines: OrderLine[];
  billedOn: string | null;
  depotBillNumber: string | null;
  receivedOn: string | null;
  packedOn: string | null;
  deliveryBillNumber: string | null;
  dispatchedOn: string | null;
  deliveredOn: string | null;
  events: OrderEvent[];
}

export interface Payment {
  id: Id;
  doctorId: Id;
  amount: number;
  paidOn: string;
  method: PayMethod;
  reference: string;
  note: string;
}

export interface ReturnLine extends PricedLine {
  id: Id;
  productId: Id;
}

export interface ReturnOrder {
  id: Id;
  number: string;
  doctorId: Id;
  sourceOrderId: Id;
  reason: ReturnReason;
  status: ReturnStatus;
  createdOn: string;
  sentOn: string | null;
  settledOn: string | null;
  lines: ReturnLine[];
  note: string;
}

export interface StockMove {
  id: Id;
  productId: Id;
  qty: number;
  kind: MoveKind;
  on: string;
  ref: string;
}

export interface LedgerData {
  settings: Settings;
  agents: Agent[];
  doctors: Doctor[];
  products: Product[];
  orders: Order[];
  payments: Payment[];
  returns: ReturnOrder[];
  moves: StockMove[];
  seq: number;
}
