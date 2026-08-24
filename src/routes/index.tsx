import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, RotateCcw, Wand2 } from "lucide-react";
import { AppShell } from "@/components/studio/AppShell";
import { WorkflowList } from "@/components/studio/WorkflowList";
import { useStudio } from "@/lib/studio/store";
import {
  LANGUAGE_OPTIONS,
  LENGTH_OPTIONS,
  MUSIC_OPTIONS,
  STYLE_OPTIONS,
  VOICE_OPTIONS,
  type VideoBrief,
} from "@/lib/studio/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AI YouTube Studio — vytvoř video z jednoho tématu" },
      {
        name: "description",
        content:
          "Zadej téma a AI YouTube Studio připraví scénář, scény, dabing, vizuály, hudbu i titulky pro hotové YouTube video.",
      },
      { property: "og:title", content: "AI YouTube Studio — vytvoř video z jednoho tématu" },
      {
        property: "og:description",
        content: "Kompletní YouTube video od scénáře po export. Stačí zadat téma.",
      },
    ],
  }),
  component: NewVideoPage,
});

const DEFAULT_BRIEF: VideoBrief = {
  topic: "",
  length: "5",
  customMinutes: 7,
  language: "Čeština",
  style: "Dokumentární",
  voice: "Mužský – hluboký",
  aspectRatio: "16:9",
  music: "Atmosférická",
};

function NewVideoPage() {
  const { steps, running, error, startWorkflow, resetWorkflow, retryFailedStep, lastProjectId } = useStudio();
  const [brief, setBrief] = useState<VideoBrief>(DEFAULT_BRIEF);
  const started = running || steps.some((s) => s.progress > 0);

  const set = <K extends keyof VideoBrief>(key: K, value: VideoBrief[K]) =>
    setBrief((b) => ({ ...b, [key]: value }));

  return (
    <AppShell title="Nové video">
      <div className="space-y-10">
        <section className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight lg:text-3xl">AI YouTube Studio</h2>
            <p className="text-sm text-muted-foreground">Vytvoř kompletní YouTube video pomocí AI</p>
          </div>

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              startWorkflow(brief);
            }}
          >
            <div className="space-y-2">
              <label className="field-label block" htmlFor="topic">
                Téma videa
              </label>
              <textarea
                id="topic"
                value={brief.topic}
                onChange={(e) => set("topic", e.target.value)}
                placeholder="Například: Tajemství Bermudského trojúhelníku"
                className="field-control min-h-[110px] resize-none text-base"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="field-label block" htmlFor="length">
                  Délka videa
                </label>
                <select
                  id="length"
                  value={brief.length}
                  onChange={(e) => set("length", e.target.value as VideoBrief["length"])}
                  className="field-control"
                >
                  {LENGTH_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {brief.length === "custom" && (
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={brief.customMinutes}
                    onChange={(e) => set("customMinutes", Number(e.target.value))}
                    className="field-control"
                    aria-label="Vlastní délka v minutách"
                  />
                )}
              </div>

              <div className="space-y-2">
                <label className="field-label block" htmlFor="language">
                  Jazyk videa
                </label>
                <select
                  id="language"
                  value={brief.language}
                  onChange={(e) => set("language", e.target.value)}
                  className="field-control"
                >
                  {LANGUAGE_OPTIONS.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <span className="field-label block">Styl videa</span>
              <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
                {STYLE_OPTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => set("style", s)}
                    className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition-colors ${
                      brief.style === s
                        ? "bg-brand text-brand-foreground"
                        : "border border-border bg-surface text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="field-label block" htmlFor="voice">
                  Typ hlasu
                </label>
                <select
                  id="voice"
                  value={brief.voice}
                  onChange={(e) => set("voice", e.target.value)}
                  className="field-control"
                >
                  {VOICE_OPTIONS.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="field-label block" htmlFor="music">
                  Hudba
                </label>
                <select
                  id="music"
                  value={brief.music}
                  onChange={(e) => set("music", e.target.value)}
                  className="field-control"
                >
                  {MUSIC_OPTIONS.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <span className="field-label block">Poměr stran</span>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { value: "16:9", label: "YouTube 16:9", w: "w-4 h-3" },
                    { value: "9:16", label: "YouTube Shorts 9:16", w: "w-3 h-4" },
                  ] as const
                ).map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => set("aspectRatio", o.value)}
                    className={`flex items-center justify-center gap-2 rounded-xl bg-surface p-3 text-xs font-medium transition-colors ${
                      brief.aspectRatio === o.value
                        ? "border-2 border-brand/60 text-foreground"
                        : "border border-border text-muted-foreground"
                    }`}
                  >
                    <span className={`${o.w} rounded-sm bg-foreground/20`} />
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={running}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-4 text-sm font-bold uppercase tracking-wider text-brand-foreground shadow-brand transition-all active:scale-[0.98] disabled:opacity-60"
            >
              <Wand2 className="size-4" />
              {running ? "Generuji…" : "Vytvořit video"}
            </button>
          </form>
        </section>

        {started && (
          <>
            <WorkflowList steps={steps} />

            {error && (
              <div className="space-y-3 rounded-xl border border-status-error/40 bg-status-error/10 p-4">
                <p className="text-sm font-semibold text-status-error">Generování selhalo</p>
                <p className="text-xs text-muted-foreground">{error}</p>
                <button
                  type="button"
                  onClick={retryFailedStep}
                  className="rounded-lg bg-brand px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-brand-foreground"
                >
                  Zkusit znovu
                </button>
              </div>
            )}


            <div className="flex flex-wrap gap-3">
              {lastProjectId && (
                <Link
                  to="/projekt/$id"
                  params={{ id: lastProjectId }}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-cyan py-3.5 text-sm font-bold uppercase tracking-wider text-cyan-foreground shadow-cyan"
                >
                  Otevřít projekt videa
                  <ArrowRight className="size-4" />
                </Link>
              )}
              <button
                type="button"
                onClick={resetWorkflow}
                className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-3.5 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="size-4" />
                Reset workflow
              </button>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
