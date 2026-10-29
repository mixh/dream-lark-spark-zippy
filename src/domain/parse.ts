import type { Doctor, Product } from "./types";

export interface ParsedLine {
  productId: string;
  qty: number;
  raw: string;
}

export interface ParsedIntake {
  doctor: Doctor | null;
  lines: ParsedLine[];
  unmatched: string[];
}

function norm(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function matchDoctor(text: string, doctors: Doctor[]): Doctor | null {
  const hay = norm(text);
  let best: { doctor: Doctor; score: number } | null = null;
  for (const doctor of doctors) {
    for (const label of [doctor.name, doctor.clinic]) {
      const needle = norm(label);
      if (needle.length < 3 || !hay.includes(needle)) continue;
      if (!best || needle.length > best.score) best = { doctor, score: needle.length };
    }
  }
  return best?.doctor ?? null;
}

function extractQty(row: string): { qty: number | null; namePart: string } {
  const marked = row.match(/[x×]\s*(\d+)\s*$/i);
  if (marked && marked.index != null) {
    return { qty: Number(marked[1]), namePart: row.slice(0, marked.index).trim() };
  }
  const tail = row.match(/(?:\s+|[-–])(\d+)\s*$/);
  if (tail && tail.index != null) {
    return { qty: Number(tail[1]), namePart: row.slice(0, tail.index).trim() };
  }
  return { qty: null, namePart: row };
}

function matchProduct(namePart: string, products: Product[]): Product | null {
  const np = norm(namePart);
  if (np.length < 3) return null;
  let best: { product: Product; score: number } | null = null;
  for (const product of products) {
    const pn = norm(product.name);
    const sn = norm(product.sku);
    if (np.includes(pn) || pn.includes(np) || (sn.length > 2 && np.includes(sn))) {
      if (!best || pn.length > best.score) best = { product, score: pn.length + 10 };
    }
  }
  if (best) return best.product;
  const tokens = np.split(" ").filter((token) => token.length > 3 && !/^\d+$/.test(token));
  for (const product of products) {
    const pn = norm(product.name);
    const hits = tokens.filter((token) => pn.includes(token)).length;
    if (hits > 0 && (!best || hits > best.score)) best = { product, score: hits };
  }
  return best?.product ?? null;
}

export function parseIntake(text: string, doctors: Doctor[], products: Product[]): ParsedIntake {
  const doctor = matchDoctor(text, doctors);
  const doctorNeedles = doctor ? [norm(doctor.name), norm(doctor.clinic)].filter((n) => n.length > 3) : [];
  const lines: ParsedLine[] = [];
  const unmatched: string[] = [];

  for (const raw of text.split(/\n/).map((line) => line.trim()).filter(Boolean)) {
    const n = norm(raw);
    if (doctorNeedles.some((needle) => n.includes(needle))) continue;
    const { qty, namePart } = extractQty(raw);
    const product = matchProduct(namePart, products);
    if (product && qty && qty > 0) {
      const existing = lines.find((line) => line.productId === product.id);
      if (existing) existing.qty += qty;
      else lines.push({ productId: product.id, qty, raw });
    } else {
      unmatched.push(raw);
    }
  }

  return { doctor, lines, unmatched };
}

export const INTAKE_SAMPLES = [
  {
    id: "clean",
    label: "Clean clinic order",
    channel: "whatsapp" as const,
    capture: "chat" as const,
    text: "Dr. Anita Kapoor\nAugmentin 625 x 10\nPanadol 500 x 8",
  },
  {
    id: "overdue",
    label: "Overdue doctor",
    channel: "whatsapp" as const,
    capture: "chat" as const,
    text: "Dr. Rohan Mehta\nAmoxil 250 suspension x 12\nCefixime 200 x 6",
  },
  {
    id: "restricted",
    label: "Needs approval",
    channel: "whatsapp" as const,
    capture: "photo" as const,
    text: "Nightingale Stores\nGlargine insulin pen x 4\nMetformin 500 x 10",
  },
];
