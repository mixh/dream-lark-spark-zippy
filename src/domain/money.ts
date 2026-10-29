import type { Doctor, PricedLine } from "./types";

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function rateFor(doctor: Doctor, productId: string): number {
  const override = doctor.discountOverrides[productId];
  return override == null ? doctor.discountRate : override;
}

export function lineAmounts(line: PricedLine) {
  const gross = round2(line.mrp * line.qty);
  const discount = round2(gross * line.discountRate);
  const net = round2(gross - discount);
  const tax = round2(net * line.taxRate);
  const total = round2(net + tax);
  return { gross, discount, net, tax, total };
}

export function linesTotal(lines: PricedLine[]): number {
  return round2(lines.reduce((sum, line) => sum + lineAmounts(line).total, 0));
}

export function linesGross(lines: PricedLine[]) {
  return lines.reduce(
    (acc, line) => {
      const a = lineAmounts(line);
      return {
        gross: round2(acc.gross + a.gross),
        discount: round2(acc.discount + a.discount),
        net: round2(acc.net + a.net),
        tax: round2(acc.tax + a.tax),
        total: round2(acc.total + a.total),
      };
    },
    { gross: 0, discount: 0, net: 0, tax: 0, total: 0 },
  );
}

export function formatMoney(n: number): string {
  const neg = n < -0.004;
  const v = Math.abs(n);
  const cents = Math.round(v * 100) % 100;
  const body = v.toLocaleString("en-IN", {
    minimumFractionDigits: cents === 0 ? 0 : 2,
    maximumFractionDigits: cents === 0 ? 0 : 2,
  });
  return `${neg ? "−" : ""}Rs ${body}`;
}

export function formatBalance(n: number): string {
  if (n < -0.5) return `Credit ${formatMoney(-n)}`;
  return formatMoney(n);
}

export function formatPct(rate: number): string {
  const pct = Math.round(rate * 1000) / 10;
  return Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(1)}%`;
}
