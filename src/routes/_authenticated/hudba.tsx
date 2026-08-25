import { createFileRoute } from "@tanstack/react-router";
import { Music4 } from "lucide-react";
import { AppShell } from "@/components/studio/AppShell";
import { MUSIC_OPTIONS } from "@/lib/studio/types";

export const Route = createFileRoute("/_authenticated/hudba")({
  head: () => ({
    meta: [
      { title: "Hudba a zvuky — AI YouTube Studio" },
      { name: "description", content: "Atmosférická, filmová, napínavá i motivující hudba a zvukové efekty pro AI videa." },
      { property: "og:title", content: "Hudba a zvuky — AI YouTube Studio" },
      { property: "og:description", content: "Vyber podkres a efekty pro své video." },
    ],
  }),
  component: MusicPage,
});

const DETAIL: Record<string, string> = {
  "Bez hudby": "Pouze dabing a ambientní ruch.",
  Atmosférická: "Klidné plochy, ideální pro dokument.",
  Filmová: "Orchestrální dynamika a velké přechody.",
  Napínavá: "Rytmický pulz a stoupající tenze.",
  Tajemná: "Temné textury a nízké frekvence.",
  Motivující: "Energický beat a stoupající melodie.",
};

function MusicPage() {
  return (
    <AppShell title="Hudba">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Hudba a efekty</h2>
          <p className="text-sm text-muted-foreground">Knihovna podkresů generovaných AI</p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MUSIC_OPTIONS.map((m) => (
            <li key={m} className="rounded-2xl border border-border bg-surface p-4">
              <Music4 className="size-4 text-cyan" />
              <p className="mt-3 text-sm font-semibold">{m}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{DETAIL[m]}</p>
            </li>
          ))}
        </ul>
      </div>
    </AppShell>
  );
}
