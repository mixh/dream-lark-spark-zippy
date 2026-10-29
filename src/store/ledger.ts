import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { seed } from "@/domain/seed";
import type { Agent, Doctor, LedgerData, Payment, Product, Settings } from "@/domain/types";
import { applyCommand, placeOrder, type Command, type NewOrderInput } from "@/domain/workflow";

const storage = {
  getItem: (name: string) => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(name);
  },
  setItem: (name: string, value: string) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(name, value);
  },
  removeItem: (name: string) => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(name);
  },
};

export type LedgerState = LedgerData & {
  hydrated: boolean;
  run: (cmd: Command) => string | null;
  createOrder: (input: NewOrderInput) => { id: string | null; error: string | null };
  recordPayment: (input: Omit<Payment, "id">) => string | null;
  removePayment: (id: string) => void;
  saveDoctor: (doctor: Doctor) => void;
  addDoctor: (input: Omit<Doctor, "id">) => string;
  saveAgent: (agent: Agent) => void;
  addAgent: (input: Omit<Agent, "id">) => string;
  saveProduct: (product: Product) => void;
  saveSettings: (patch: Partial<Settings>) => void;
  resetDemo: () => void;
};

function dataOf(state: LedgerState): LedgerData {
  return {
    settings: state.settings,
    agents: state.agents,
    doctors: state.doctors,
    products: state.products,
    orders: state.orders,
    payments: state.payments,
    returns: state.returns,
    moves: state.moves,
    seq: state.seq,
  };
}

export const useLedger = create<LedgerState>()(
  persist(
    (set, get) => ({
      ...seed(),
      hydrated: false,
      run: (cmd) => {
        const current = dataOf(get());
        const result = applyCommand(current, cmd);
        if (result.error) return result.error;
        if (result.data !== current) set(result.data);
        return null;
      },
      createOrder: (input) => {
        const placed = placeOrder(dataOf(get()), input);
        if (placed.error || !placed.id) {
          return { id: null, error: placed.error ?? "Could not create the order." };
        }
        const checked = applyCommand(placed.data, {
          type: "run_checks",
          orderId: placed.id,
          today: input.today,
        });
        set({ ...checked.data, hydrated: true });
        return { id: placed.id, error: null };
      },
      recordPayment: (input) => {
        if (!Number.isFinite(input.amount) || input.amount <= 0) return "Enter an amount greater than zero.";
        if (!input.paidOn) return "Enter the date the money came in.";
        const doctor = get().doctors.find((row) => row.id === input.doctorId);
        if (!doctor) return "That client is not on the book.";
        const seq = get().seq + 1;
        const payment: Payment = {
          ...input,
          id: `pay-${seq}`,
          amount: Math.round(input.amount * 100) / 100,
          reference: input.reference.trim(),
          note: input.note.trim(),
        };
        set({ payments: [payment, ...get().payments], seq });
        return null;
      },
      removePayment: (id) => set({ payments: get().payments.filter((row) => row.id !== id) }),
      saveDoctor: (doctor) =>
        set({ doctors: get().doctors.map((row) => (row.id === doctor.id ? doctor : row)) }),
      addDoctor: (input) => {
        const seq = get().seq + 1;
        const id = `d-${seq}`;
        set({ doctors: [...get().doctors, { ...input, id }], seq });
        return id;
      },
      saveAgent: (agent) => set({ agents: get().agents.map((row) => (row.id === agent.id ? agent : row)) }),
      addAgent: (input) => {
        const seq = get().seq + 1;
        const id = `a-${seq}`;
        set({ agents: [...get().agents, { ...input, id }], seq });
        return id;
      },
      saveProduct: (product) =>
        set({ products: get().products.map((row) => (row.id === product.id ? product : row)) }),
      saveSettings: (patch) => set({ settings: { ...get().settings, ...patch } }),
      resetDemo: () => set({ ...seed(), hydrated: true }),
    }),
    {
      name: "helix-ledger-v1",
      version: 1,
      skipHydration: true,
      storage: createJSONStorage(() => storage),
      partialize: (state) => dataOf(state),
      merge: (persisted, current) => {
        const saved = persisted as Partial<LedgerData> | undefined;
        if (!saved?.orders || !saved.doctors || !saved.products || !saved.settings || !saved.agents) {
          return current;
        }
        return { ...current, ...saved };
      },
    },
  ),
);
