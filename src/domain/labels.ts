import type {
  Capture,
  Channel,
  ClientKind,
  MoveKind,
  OrderStatus,
  PayMethod,
  ReturnReason,
  ReturnStatus,
} from "./types";

export const STATUS_LABEL: Record<OrderStatus, string> = {
  intake: "Just captured",
  credit_hold: "Credit hold",
  approval_needed: "Needs approval",
  ready: "Ready to bill",
  at_depot: "With depot",
  received: "In the office",
  packed: "Packed",
  dispatched: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const CHANNEL_LABEL: Record<Channel, string> = {
  whatsapp: "WhatsApp",
  gmail: "Gmail",
  phone: "Phone",
  counter: "Counter",
};

export const CAPTURE_LABEL: Record<Capture, string> = {
  photo: "Photo of a slip",
  chat: "Chat message",
  email: "Email",
  spoken: "Spoken",
};

export const KIND_LABEL: Record<ClientKind, string> = {
  doctor: "Doctor",
  pharmacy: "Pharmacy",
};

export const PAY_LABEL: Record<PayMethod, string> = {
  cash: "Cash",
  bank: "Bank",
  cheque: "Cheque",
};

export const RETURN_REASON: Record<ReturnReason, string> = {
  damage: "Damaged",
  near_expiry: "Near expiry",
  wrong_item: "Wrong item",
  other: "Other",
};

export const RETURN_STATUS: Record<ReturnStatus, string> = {
  draft: "In the office",
  sent_to_depot: "Sent to depot",
  settled: "Settled with depot",
  void: "Void",
};

export const MOVE_LABEL: Record<MoveKind, string> = {
  receive: "Received from depot",
  dispatch: "Left with delivery",
  return_in: "Return from client",
  return_out: "Return to depot",
  adjust: "Count",
};
