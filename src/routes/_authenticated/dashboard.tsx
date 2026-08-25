import { createFileRoute, Link } from "@tanstack/react-router";
import { Film, Clock, Layers, Sparkles } from "lucide-react";
import { AppShell } from "@/components/studio/AppShell";
import { useStudio } from "@/lib/studio/store";
import { formatDuration } from "@/lib/studio/types";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — AI YouTube Studio" },
      { name: "description", content: "Přehled projektů, celkové délky videí a počtu scén ve tvém AI video studiu." },
      { property: "og:title", content: "Dashboard — AI YouTube Studio" },
      { property: "og:description", content: "Statistiky a rychlý start nového AI videa." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { projects } = useStudio();
  const totalSeconds = projects.reduce((a, p) => a + p.totalSeconds, 0);
  const scenes = projects.reduce((a, p) => a + p.scenes.length, 0);

  return (
    <AppShell title="Dashboard">
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-sm text-muted-foreground">Přehled tvého AI video studia</p>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat icon={Film} label="Projekty" value={`${projects.length}`} />
          <Stat icon={Clock} label="Celková délka" value={formatDuration(totalSeconds)} />
          <Stat icon={Layers} label="Scény" value={`${scenes}`} />
          <Stat icon={Sparkles} label="Režim" value="Simulace" />
        </div>

        <section className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Poslední projekty</h3>
          {projects.length === 0 ? (
            <p className="rounded-2xl border border-border bg-surface p-6 text-sm text-muted-foreground">
              Zatím nic nevygenerováno.
            </p>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
              {projects.slice(0, 5).map((p) => (
                <li key={p.id}>
                  <Link to="/projekt/$id" params={{ id: p.id }} className="flex items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {p.brief.style} • {p.brief.language} • {formatDuration(p.totalSeconds)}
                      </p>
                    </div>
                    <span className="shrink-0 text-[10px] font-bold uppercase text-status-done">{p.state}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Link
          to="/"
          className="flex items-center justify-center gap-2 rounded-xl bg-brand py-4 text-sm font-bold uppercase tracking-wider text-brand-foreground shadow-brand"
        >
          <Sparkles className="size-4" />
          Nové video
        </Link>
      </div>
    </AppShell>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Film;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <Icon className="size-4 text-brand" />
      <p className="mt-3 text-xl font-bold tracking-tight">{value}</p>
      <p className="field-label">{label}</p>
    </div>
  );
}
