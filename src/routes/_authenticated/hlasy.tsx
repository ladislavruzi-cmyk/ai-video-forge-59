import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Mic, Play } from "lucide-react";
import { AppShell } from "@/components/studio/AppShell";
import { VOICE_OPTIONS } from "@/lib/studio/types";

export const Route = createFileRoute("/_authenticated/hlasy")({
  head: () => ({
    meta: [
      { title: "Hlasy pro dabing — AI YouTube Studio" },
      { name: "description", content: "Knihovna AI hlasů pro dabing videí: mužské i ženské, přirozené i dramatické." },
      { property: "og:title", content: "Hlasy pro dabing — AI YouTube Studio" },
      { property: "og:description", content: "Vyber hlas, kterým bude tvé video vyprávěno." },
    ],
  }),
  component: VoicesPage,
});

const DETAIL: Record<string, string> = {
  "Mužský – hluboký": "Vhodný pro dokumenty a záhady. Tempo 0.95×.",
  "Mužský – přirozený": "Univerzální vyprávěč pro vzdělávací obsah.",
  "Ženský – přirozený": "Jasná artikulace, ideální pro vysvětlování.",
  "Ženský – dramatický": "Výrazná intonace pro napínavé příběhy.",
};

function VoicesPage() {
  const [note, setNote] = useState<string | null>(null);

  return (
    <AppShell title="Hlasy">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Hlasy</h2>
          <p className="text-sm text-muted-foreground">Knihovna hlasů pro AI dabing</p>
        </div>
        {note && (
          <p className="rounded-xl border border-cyan/30 bg-cyan/10 px-4 py-3 text-xs text-cyan">{note}</p>
        )}
        <ul className="grid gap-3 sm:grid-cols-2">
          {VOICE_OPTIONS.map((v) => (
            <li key={v} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand/20 ring-1 ring-brand/40">
                <Mic className="size-4 text-brand" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{v}</p>
                <p className="text-[11px] text-muted-foreground">{DETAIL[v]}</p>
              </div>
              <button
                onClick={() => setNote(`Ukázka „${v}“ bude dostupná po připojení text-to-speech API.`)}
                aria-label={`Přehrát ukázku hlasu ${v}`}
                className="shrink-0 rounded-lg border border-border p-2 text-cyan"
              >
                <Play className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </AppShell>
  );
}
