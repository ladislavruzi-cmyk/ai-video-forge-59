import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, KeyRound, LogOut, ShieldCheck, X } from "lucide-react";
import { useAuth } from "@/lib/auth/useAuth";
import { AppShell } from "@/components/studio/AppShell";
import { getIntegrationStatus } from "@/lib/ai/pipeline.functions";

export const Route = createFileRoute("/_authenticated/nastaveni")({
  head: () => ({
    meta: [
      { title: "Nastavení integrací — AI YouTube Studio" },
      {
        name: "description",
        content: "Stav připojení AI integrací: scénář, obrázky, video, dabing, hudba, titulky, rendering a YouTube.",
      },
      { property: "og:title", content: "Nastavení integrací — AI YouTube Studio" },
      { property: "og:description", content: "Přehled serverových integrací pro generování videa." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { email, signOut } = useAuth();
  const fetchStatus = useServerFn(getIntegrationStatus);
  const { data, isLoading } = useQuery({
    queryKey: ["integration-status"],
    queryFn: () => fetchStatus(),
  });

  return (
    <AppShell title="Nastavení">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Nastavení</h2>
          <p className="text-sm text-muted-foreground">
            Klíče se ukládají výhradně na serveru. Frontend je nikdy nevidí.
          </p>
        </div>

        <section className="rounded-2xl border border-border bg-surface p-5">
          <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            <ShieldCheck className="size-4 text-cyan" />
            Účet
          </h3>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Přihlášen jako</dt>
              <dd className="truncate font-medium">{email ?? "—"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Veřejná registrace</dt>
              <dd className="font-medium text-status-done">Zakázána</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Projekty</dt>
              <dd className="font-medium">Soukromé, chráněné RLS</dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-5 flex items-center gap-2 rounded-xl border border-border px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
          >
            <LogOut className="size-3.5" />
            Odhlásit se
          </button>
        </section>

        <div className="rounded-2xl border border-border bg-surface p-5">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <KeyRound className="size-4 text-brand" />
            AI integrace
          </h3>
          {isLoading && <p className="mt-4 text-xs text-muted-foreground">Zjišťuji stav…</p>}
          <ul className="mt-4 divide-y divide-border">
            {(data ?? []).map((item) => (
              <li key={item.id} className="flex items-center gap-3 py-3">
                <span
                  className={`grid size-6 shrink-0 place-items-center rounded-full ${
                    item.configured ? "bg-status-done/20" : "bg-muted"
                  }`}
                >
                  {item.configured ? (
                    <Check className="size-3.5 text-status-done" />
                  ) : (
                    <X className="size-3.5 text-muted-foreground" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{item.purpose}</p>
                </div>
                <code className="shrink-0 rounded border border-border px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                  {item.envVar}
                </code>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
            Dokud není integrace připojená, běží studio v simulačním režimu — celé UI i workflow jsou plně
            funkční, jen se negenerují skutečné soubory.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
