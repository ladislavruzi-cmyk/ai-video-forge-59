import { createFileRoute, Link } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { AppShell } from "@/components/studio/AppShell";
import { useStudio } from "@/lib/studio/store";
import { formatDuration } from "@/lib/studio/types";

export const Route = createFileRoute("/projekty")({
  head: () => ({
    meta: [
      { title: "Moje projekty — AI YouTube Studio" },
      { name: "description", content: "Přehled všech vygenerovaných video projektů, jejich délky, scén a stavu." },
      { property: "og:title", content: "Moje projekty — AI YouTube Studio" },
      { property: "og:description", content: "Spravuj své AI video projekty na jednom místě." },
    ],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const { projects, deleteProject } = useStudio();

  return (
    <AppShell title="Moje projekty">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Moje projekty</h2>
          <p className="text-sm text-muted-foreground">{projects.length} projektů v tomto prohlížeči</p>
        </div>

        {projects.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface p-8 text-center">
            <p className="text-sm text-muted-foreground">Zatím žádné projekty.</p>
            <Link
              to="/"
              className="mt-5 inline-flex rounded-xl bg-brand px-5 py-3 text-sm font-bold uppercase tracking-wider text-brand-foreground"
            >
              Vytvořit první video
            </Link>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {projects.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4">
                <Link to="/projekt/$id" params={{ id: p.id }} className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{p.title}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                    {formatDuration(p.totalSeconds)} • {p.scenes.length} scén • {p.brief.aspectRatio}
                  </p>
                  <p className="mt-1 text-[11px] font-bold text-status-done">{p.state}</p>
                </Link>
                <button
                  onClick={() => deleteProject(p.id)}
                  aria-label={`Smazat projekt ${p.title}`}
                  className="shrink-0 rounded-lg border border-border p-2 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
