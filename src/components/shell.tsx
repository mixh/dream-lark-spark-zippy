import { useEffect, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  AlarmClock,
  Blocks,
  ClipboardList,
  LayoutDashboard,
  Menu,
  PenLine,
  Stethoscope,
  Trophy,
  Users,
  Warehouse,
  X,
} from "lucide-react";
import { attentionCount, overdueClients } from "@/domain/metrics";
import { formatPretty, todayIso } from "@/domain/dates";
import { cn } from "@/lib/cn";
import { useLedger } from "@/store/ledger";

const NAV = [
  { to: "/", label: "Desk", icon: LayoutDashboard },
  { to: "/orders", label: "Orders", icon: ClipboardList },
  { to: "/intake", label: "New order", icon: PenLine },
  { to: "/clients", label: "Clients", icon: Stethoscope },
  { to: "/agents", label: "Agents", icon: Users },
  { to: "/overdue", label: "Overdue", icon: AlarmClock },
  { to: "/rankings", label: "Rankings", icon: Trophy },
  { to: "/stock", label: "Stock", icon: Warehouse },
  { to: "/system", label: "System", icon: Blocks },
] as const;

function isActive(pathname: string, to: string) {
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(`${to}/`);
}

function NavLinks({ onNavigate, hydrated }: { onNavigate?: () => void; hydrated: boolean }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const attention = useLedger((state) => (hydrated ? attentionCount(state, todayIso()) : 0));
  const overdue = useLedger((state) => (hydrated ? overdueClients(state, todayIso()).length : 0));
  const badges: Record<string, number> = { "/orders": attention, "/overdue": overdue };

  return (
    <nav className="flex flex-col gap-1" aria-label="Desk">
      {NAV.map((item) => {
        const active = isActive(pathname, item.to);
        const badge = badges[item.to] ?? 0;
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium",
              active ? "bg-forest text-on-forest" : "text-ink hover:bg-paper",
            )}
            aria-current={active ? "page" : undefined}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="flex-1">{item.label}</span>
            {badge > 0 ? (
              <span className={cn("tabular-nums text-xs", active ? "text-on-forest" : "text-copper")}>{badge}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const hydrated = useLedger((state) => state.hydrated);
  const company = useLedger((state) => state.settings.company);
  const mandate = useLedger((state) => state.settings.overdueDays);
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => {
    if (useLedger.getState().hydrated) return;
    let live = true;
    void Promise.resolve(useLedger.persist.rehydrate())
      .catch(() => undefined)
      .finally(() => {
        if (live) useLedger.setState({ hydrated: true });
      });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const footer = hydrated ? `${mandate}-day mandate` : "Sample book";

  return (
    <div className="min-h-screen bg-paper text-ink lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="hidden border-r border-line bg-sunken lg:flex lg:sticky lg:top-0 lg:h-screen lg:flex-col lg:px-3 lg:py-5">
        <Brand />
        <div className="mt-6 flex-1 overflow-y-auto">
          <NavLinks hydrated={hydrated} />
        </div>
        <div className="mt-4 border-t border-line pt-4 text-sm">
          <p className="font-medium">{hydrated ? company : "Helix"}</p>
          <p className="mt-1 text-muted">{footer}</p>
        </div>
      </aside>

      <div className="min-w-0">
        <div className="flex items-center gap-2 border-b border-line px-3 py-2 lg:hidden">
          <button
            type="button"
            className="grid size-11 place-items-center rounded-lg hover:bg-sunken"
            aria-label="Open menu"
            onClick={() => setOpen(true)}
          >
            <Menu className="size-5" aria-hidden />
          </button>
          <Brand compact />
        </div>
        {open ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button type="button" className="absolute inset-0 bg-ink/40" aria-label="Close menu" onClick={() => setOpen(false)} />
            <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-sunken px-3 py-4 shadow-card">
              <div className="mb-4 flex items-center justify-between">
                <Brand />
                <button
                  type="button"
                  className="grid size-11 place-items-center rounded-lg hover:bg-paper"
                  aria-label="Close menu"
                  onClick={() => setOpen(false)}
                >
                  <X className="size-5" aria-hidden />
                </button>
              </div>
              <NavLinks hydrated={hydrated} onNavigate={() => setOpen(false)} />
              <p className="mt-auto pt-6 text-sm text-muted">{hydrated ? company : "Helix"} · {footer}</p>
            </div>
          </div>
        ) : null}
        <main className="px-4 py-5 md:px-8 md:py-8">
          <div className="mx-auto max-w-6xl">{hydrated ? children : <Opening />}</div>
        </main>
      </div>
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-3 rounded-lg px-1">
      <span className="grid size-9 place-items-center rounded-lg bg-forest font-display text-lg text-on-forest">H</span>
      {compact ? (
        <span className="font-display text-xl">Helix</span>
      ) : (
        <span>
          <span className="block font-display text-xl leading-none">Helix</span>
          <span className="mt-1 block text-xs uppercase tracking-widest text-muted">Order desk</span>
        </span>
      )}
    </Link>
  );
}

function Opening() {
  return (
    <div className="max-w-lg py-10">
      <p className="text-xs font-medium uppercase tracking-widest text-muted">Helix</p>
      <h1 className="mt-2 font-display text-4xl">Opening the book</h1>
      <p className="mt-3 text-muted">Loading the Northline order desk.</p>
    </div>
  );
}
