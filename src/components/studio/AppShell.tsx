import { Link } from "@tanstack/react-router";
import {
  FolderOpen,
  LayoutDashboard,
  Music4,
  Settings,
  Sparkles,
  LayoutTemplate,
  Mic,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { useAuth } from "@/lib/auth/useAuth";

interface NavItem {
  to: string;
  label: string;
  short: string;
  icon: LucideIcon;
}

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", short: "Přehled", icon: LayoutDashboard },
  { to: "/", label: "Nové video", short: "Nové", icon: Sparkles },
  { to: "/projekty", label: "Moje projekty", short: "Projekty", icon: FolderOpen },
  { to: "/sablony", label: "Šablony", short: "Šablony", icon: LayoutTemplate },
  { to: "/hlasy", label: "Hlasy", short: "Hlasy", icon: Mic },
  { to: "/hudba", label: "Hudba", short: "Hudba", icon: Music4 },
  { to: "/nastaveni", label: "Nastavení", short: "Nastavení", icon: Settings },
];

const MOBILE_NAV = NAV.filter((n) => ["/", "/projekty", "/hlasy", "/nastaveni"].includes(n.to));

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const { email, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background text-foreground lg:flex">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-surface-2/60 px-3 py-5 lg:flex">
        <Link to="/" className="mb-8 flex items-center gap-2 px-2">
          <span className="grid size-8 place-items-center rounded-lg bg-brand/20 text-xs font-bold text-brand ring-1 ring-brand/40">
            AI
          </span>
          <span className="text-sm font-bold tracking-tight">
            AI <span className="text-brand">YouTube</span> Studio
          </span>
        </Link>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === "/" }}
              activeProps={{ className: "bg-accent text-accent-foreground" }}
              inactiveProps={{ className: "text-muted-foreground hover:bg-accent/60 hover:text-foreground" }}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto space-y-3 px-3">
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Scénář a scény generuje AI. Dabing, vizuály a render se doplní později.
          </p>
          {email && <p className="truncate text-[11px] font-medium text-foreground">{email}</p>}
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
          >
            <LogOut className="size-3.5" />
            Odhlásit se
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col pb-20 lg:pb-0">
        <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background/80 px-4 py-3.5 backdrop-blur-md lg:px-8">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold tracking-tight lg:hidden">
              AI <span className="text-brand">YouTube</span> Studio
            </h1>
            <p className="hidden text-sm font-semibold lg:block">{title}</p>
            <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground lg:hidden">
              {title}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            aria-label="Odhlásit se"
            className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-surface px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground lg:hidden"
          >
            <LogOut className="size-3.5" />
            Odhlásit
          </button>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 lg:px-8">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-between border-t border-border bg-background/95 px-6 py-2.5 backdrop-blur-xl lg:hidden">
        {MOBILE_NAV.map(({ to, short, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact: to === "/" }}
            activeProps={{ className: "text-brand" }}
            inactiveProps={{ className: "text-muted-foreground" }}
            className="flex flex-col items-center gap-1"
          >
            <Icon className="size-5" />
            <span className="text-[9px] font-bold uppercase tracking-wide">{short}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
