import { createFileRoute, Link } from "@tanstack/react-router";
import { LayoutTemplate } from "lucide-react";
import { AppShell } from "@/components/studio/AppShell";

export const Route = createFileRoute("/sablony")({
  head: () => ({
    meta: [
      { title: "Šablony videí — AI YouTube Studio" },
      { name: "description", content: "Předpřipravené šablony pro dokumentární, tajemná, vzdělávací a motivační videa." },
      { property: "og:title", content: "Šablony videí — AI YouTube Studio" },
      { property: "og:description", content: "Začni s hotovou šablonou a uprav jen téma." },
    ],
  }),
  component: TemplatesPage,
});

const TEMPLATES = [
  { name: "Záhady a nevysvětlené", style: "Tajemný", length: "10 minut", music: "Napínavá" },
  { name: "Historický dokument", style: "Historický", length: "20 minut", music: "Filmová" },
  { name: "Vědecké vysvětlení", style: "Vědecký", length: "5 minut", music: "Atmosférická" },
  { name: "Shorts hook", style: "Filmový", length: "1–3 minuty", music: "Napínavá" },
  { name: "Motivační příběh", style: "Motivující", length: "5 minut", music: "Motivující" },
  { name: "Vzdělávací lekce", style: "Vzdělávací", length: "10 minut", music: "Bez hudby" },
];

function TemplatesPage() {
  return (
    <AppShell title="Šablony">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Šablony</h2>
          <p className="text-sm text-muted-foreground">Rychlý start s předvolenými parametry</p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TEMPLATES.map((t) => (
            <li key={t.name} className="rounded-2xl border border-border bg-surface p-4">
              <LayoutTemplate className="size-4 text-brand" />
              <p className="mt-3 text-sm font-semibold">{t.name}</p>
              <p className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                {t.style} • {t.length} • {t.music}
              </p>
              <Link to="/" className="mt-4 inline-flex text-[10px] font-bold uppercase tracking-wider text-cyan">
                Použít šablonu
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </AppShell>
  );
}
