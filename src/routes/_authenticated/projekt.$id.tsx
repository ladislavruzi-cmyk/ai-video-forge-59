import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Captions,
  Download,
  ImagePlus,
  Music4,
  Play,
  RefreshCw,
  Upload,
  Youtube,
} from "lucide-react";
import { AppShell } from "@/components/studio/AppShell";
import { SceneImage } from "@/components/studio/SceneImage";
import { SceneAudio } from "@/components/studio/SceneAudio";
import { useStudio } from "@/lib/studio/store";
import {
  STEP_STATUS_LABEL,
  VISUAL_STATUS_LABEL,
  countWords,
  formatDuration,
  type Scene,
} from "@/lib/studio/types";
import scenePreview from "@/assets/scene-preview.jpg";


export const Route = createFileRoute("/_authenticated/projekt/$id")({
  head: () => ({
    meta: [
      { title: "Projekt videa — AI YouTube Studio" },
      {
        name: "description",
        content: "Scénář, scény, dabing, vizuály, hudba, titulky a export jednoho video projektu.",
      },
      { property: "og:title", content: "Projekt videa — AI YouTube Studio" },
      { property: "og:description", content: "Detail vygenerovaného video projektu a export pro YouTube." },
    ],
  }),
  component: ProjectPage,
});

const TABS = [
  { id: "scenar", label: "Scénář" },
  { id: "sceny", label: "Scény" },
  { id: "dabing", label: "Dabing" },
  { id: "vizualy", label: "Vizuály" },
  { id: "hudba", label: "Hudba a efekty" },
  { id: "titulky", label: "Titulky" },
  { id: "export", label: "Export" },
] as const;

function ProjectPage() {
  const { id } = Route.useParams();
  const {
    getProject,
    updateProject,
    regenerateScript,
    regenerateScene,
    generateVisual,
    generateVoice,
    visualBatch,
    generateVisualsBatch,
    cancelVisualBatch,
  } = useStudio();
  const project = getProject(id);
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("scenar");
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [editScript, setEditScript] = useState(false);
  const [editScene, setEditScene] = useState<string | null>(null);

  if (!project) {
    return (
      <AppShell title="Projekt videa">
        <div className="rounded-2xl border border-border bg-surface p-8 text-center">
          <h2 className="text-lg font-bold">Projekt nenalezen</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Projekt neexistuje nebo byl smazán. Vytvoř nové video.
          </p>
          <Link
            to="/"
            className="mt-5 inline-flex rounded-xl bg-brand px-5 py-3 text-sm font-bold uppercase tracking-wider text-brand-foreground"
          >
            Nové video
          </Link>
        </div>
      </AppShell>
    );
  }

  const patchScene = (sceneId: string, patch: Partial<Scene>) =>
    updateProject(project.id, {
      scenes: project.scenes.map((s) => (s.id === sceneId ? { ...s, ...patch } : s)),
    });

  const coverPath = project.scenes.find((s) => s.imagePath)?.imagePath ?? null;


  return (
    <AppShell title="Projekt videa">
      <div className="space-y-8">
        <section className="overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="relative aspect-video w-full bg-surface-2">
            {coverPath ? (
              <SceneImage path={coverPath} alt={`Náhled videa: ${project.title}`} />
            ) : (
              <img
                src={scenePreview}
                alt={`Náhled videa: ${project.title}`}
                width={1280}
                height={720}
                className="size-full object-cover opacity-80"
              />
            )}

            <div className="absolute inset-0 grid place-items-center">
              <span className="grid size-14 place-items-center rounded-full bg-brand/80 backdrop-blur">
                <Play className="size-6 text-brand-foreground" />
              </span>
            </div>
            <span className="absolute bottom-3 right-3 rounded bg-background/70 px-2 py-1 font-mono text-[10px]">
              {formatDuration(project.totalSeconds)}
            </span>
          </div>
          <div className="space-y-3 p-4">
            <h2 className="text-lg font-bold tracking-tight lg:text-xl">{project.title}</h2>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <Meta label="Celková délka" value={formatDuration(project.totalSeconds)} />
              <Meta label="Počet scén" value={`${project.scenes.length}`} />
              <Meta label="Hlas" value={project.brief.voice} />
              <Meta label="Hudba" value={project.brief.music} />
              <Meta label="Stav projektu" value={project.state} accent />
            </dl>
          </div>
        </section>

        <div className="no-scrollbar flex gap-2 overflow-x-auto border-b border-border pb-px">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`shrink-0 border-b-2 px-3 pb-2 text-xs font-bold uppercase tracking-wider transition-colors ${
                tab === t.id ? "border-brand text-foreground" : "border-transparent text-muted-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {note && (
          <p className="rounded-xl border border-cyan/30 bg-cyan/10 px-4 py-3 text-xs text-cyan">{note}</p>
        )}

        {err && (
          <div className="space-y-2 rounded-xl border border-status-error/40 bg-status-error/10 px-4 py-3">
            <p className="text-xs font-semibold text-status-error">Generování selhalo</p>
            <p className="text-xs text-muted-foreground">{err}</p>
            <p className="text-[11px] text-muted-foreground">
              Původní data zůstala zachována — klikni znovu na tlačítko regenerace.
            </p>
          </div>
        )}

        {tab === "scenar" && (
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Scénář</h3>
              <span className="font-mono text-[11px] text-muted-foreground">
                {project.wordCount ?? countWords(project.script)} slov •{" "}
                {formatDuration(project.totalSeconds)}
              </span>
            </div>
            <p className="text-sm font-semibold">{project.title}</p>

            {editScript ? (
              <textarea
                value={project.script}
                onChange={(e) =>
                  updateProject(project.id, {
                    script: e.target.value,
                    wordCount: countWords(e.target.value),
                  })
                }
                className="field-control min-h-[320px] whitespace-pre-wrap font-mono text-[13px] leading-relaxed"
              />
            ) : (
              <div className="max-h-[420px] overflow-y-auto whitespace-pre-wrap rounded-xl border border-border bg-surface p-4 text-[13px] leading-relaxed">
                {project.script}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setEditScript((v) => !v)}
                className="rounded-xl border border-border bg-surface px-4 py-2.5 text-xs font-bold uppercase tracking-wider"
              >
                {editScript ? "Uložit scénář" : "Upravit scénář"}
              </button>
              <button
                disabled={busy !== null}
                onClick={async () => {
                  setNote(null);
                  setErr(null);
                  setBusy("script");
                  const message = await regenerateScript(project.id);
                  setBusy(null);
                  if (message) setErr(message);
                  else setNote("Scénář i scény byly znovu vygenerovány.");
                }}
                className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-brand-foreground disabled:opacity-60"
              >
                <RefreshCw className={`size-4 ${busy === "script" ? "animate-spin" : ""}`} />
                {busy === "script" ? "Generuji…" : "Regenerovat scénář"}
              </button>
            </div>
          </section>
        )}

        {tab === "sceny" && (
          <section className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Scény</h3>
            {project.scenes.map((scene) => {
              const open = editScene === scene.id;
              return (
                <article key={scene.id} className="space-y-3 rounded-r-xl border-l-2 border-brand bg-surface p-4">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    <span>
                      Scéna {scene.index} • {formatDuration(scene.seconds)}
                    </span>
                    <span className="text-status-done">{STEP_STATUS_LABEL[scene.status]}</span>
                  </div>

                  {open ? (
                    <input
                      value={scene.title}
                      onChange={(e) => patchScene(scene.id, { title: e.target.value })}
                      className="field-control font-semibold"
                      aria-label={`Název scény ${scene.index}`}
                    />
                  ) : (
                    <p className="text-sm font-semibold">{scene.title}</p>
                  )}

                  <div className="space-y-1">
                    <span className="field-label block">Text dabingu</span>
                    {open ? (
                      <textarea
                        value={scene.narration}
                        onChange={(e) => patchScene(scene.id, { narration: e.target.value })}
                        className="field-control min-h-[110px] text-[13px] leading-relaxed"
                      />
                    ) : (
                      <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{scene.narration}</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <span className="field-label block">Vizuální prompt</span>
                    {open ? (
                      <textarea
                        value={scene.visualPrompt}
                        onChange={(e) => patchScene(scene.id, { visualPrompt: e.target.value })}
                        className="field-control min-h-[90px] font-mono text-[12px]"
                      />
                    ) : (
                      <p className="font-mono text-[11px] text-muted-foreground">{scene.visualPrompt}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <span className="field-label block">Délka (s)</span>
                      {open ? (
                        <input
                          type="number"
                          min={1}
                          value={scene.seconds}
                          onChange={(e) => patchScene(scene.id, { seconds: Number(e.target.value) })}
                          className="field-control text-[13px]"
                        />
                      ) : (
                        <p className="text-[13px]">{scene.seconds}</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <span className="field-label block">Nálada</span>
                      {open ? (
                        <input
                          value={scene.mood}
                          onChange={(e) => patchScene(scene.id, { mood: e.target.value })}
                          className="field-control text-[13px]"
                        />
                      ) : (
                        <p className="text-[13px]">{scene.mood}</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <span className="field-label block">Přechod</span>
                      {open ? (
                        <input
                          value={scene.transition}
                          onChange={(e) => patchScene(scene.id, { transition: e.target.value })}
                          className="field-control text-[13px]"
                        />
                      ) : (
                        <p className="text-[13px]">{scene.transition}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setEditScene(open ? null : scene.id)}
                      className="rounded-lg border border-border px-3 py-2 text-[10px] font-bold uppercase tracking-wider"
                    >
                      {open ? "Uložit scénu" : "Upravit scénu"}
                    </button>
                    <button
                      disabled={busy !== null}
                      onClick={async () => {
                        setNote(null);
                        setErr(null);
                        setBusy(scene.id);
                        const message = await regenerateScene(project.id, scene.id);
                        setBusy(null);
                        if (message) setErr(message);
                        else setNote(`Scéna ${scene.index} byla regenerována.`);
                      }}
                      className="flex items-center gap-1.5 rounded-lg bg-cyan/15 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-cyan disabled:opacity-60"
                    >
                      <RefreshCw className={`size-3 ${busy === scene.id ? "animate-spin" : ""}`} />
                      {busy === scene.id ? "Generuji…" : "Regenerovat scénu"}
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        )}


        {tab === "dabing" && (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Dabing</h3>
              <button
                disabled={busy !== null}
                onClick={async () => {
                  setNote(null);
                  setErr(null);
                  let failed = 0;
                  for (const scene of project.scenes) {
                    setBusy(`aud-${scene.id}`);
                    const message = await generateVoice(project.id, scene.id);
                    if (message) failed += 1;
                  }
                  setBusy(null);
                  if (failed > 0) setErr(`${failed} scén(y) se nepodařilo namluvit. Zkus je znovu jednotlivě.`);
                  else setNote("Dabing všech scén byl vygenerován.");
                }}
                className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-brand-foreground disabled:opacity-60"
              >
                <Play className="size-4" />
                Vygenerovat všechen dabing
              </button>
            </div>

            <div className="rounded-2xl border border-border bg-surface p-5">
              <p className="text-sm font-semibold">{project.brief.voice}</p>
              <p className="text-xs text-muted-foreground">
                Jazyk: {project.brief.language} • cílová stopa {formatDuration(project.totalSeconds)}
              </p>
            </div>

            <div className="space-y-3">
              {project.scenes.map((scene) => {
                const status = scene.audioStatus ?? "waiting";
                const generating = busy === `aud-${scene.id}` || status === "running";
                return (
                  <article key={scene.id} className="space-y-3 rounded-2xl border border-border bg-surface p-4">
                    <div className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wider">
                      <span className="text-muted-foreground">Scéna {scene.index}</span>
                      <span
                        className={
                          status === "done"
                            ? "text-status-done"
                            : status === "error"
                              ? "text-status-error"
                              : status === "running"
                                ? "text-cyan"
                                : "text-muted-foreground"
                        }
                      >
                        {VISUAL_STATUS_LABEL[generating ? "running" : status]}
                      </span>
                    </div>
                    <p className="text-xs font-semibold">{scene.title}</p>
                    <p className="line-clamp-2 text-[11px] text-muted-foreground">{scene.narration}</p>
                    {scene.audioSeconds ? (
                      <p className="text-[11px] text-muted-foreground">
                        Délka audia: {formatDuration(scene.audioSeconds)}
                      </p>
                    ) : null}
                    {status === "done" && scene.audioPath && (
                      <SceneAudio path={scene.audioPath} label={`Dabing scény ${scene.index}`} />
                    )}
                    {scene.audioError && <p className="text-[11px] text-status-error">{scene.audioError}</p>}
                    <button
                      disabled={busy !== null}
                      onClick={async () => {
                        setNote(null);
                        setErr(null);
                        setBusy(`aud-${scene.id}`);
                        const message = await generateVoice(project.id, scene.id);
                        setBusy(null);
                        if (message) setErr(message);
                        else setNote(`Dabing scény ${scene.index} je hotový.`);
                      }}
                      className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-cyan disabled:opacity-60"
                    >
                      <RefreshCw className={`size-3 ${generating ? "animate-spin" : ""}`} />
                      {generating
                        ? "Generuji…"
                        : scene.audioPath
                          ? "Regenerovat dabing"
                          : "Vygenerovat dabing"}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        )}


        {tab === "vizualy" && (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Vizuály</h3>
              <button
                disabled={busy !== null}
                onClick={async () => {
                  setNote(null);
                  setErr(null);
                  let failed = 0;
                  for (const scene of project.scenes) {
                    setBusy(`vis-${scene.id}`);
                    const message = await generateVisual(project.id, scene.id);
                    if (message) failed += 1;
                  }
                  setBusy(null);
                  if (failed > 0) setErr(`${failed} scén(y) se nepodařilo vygenerovat. Zkus je znovu jednotlivě.`);
                  else setNote("Vizuály všech scén byly vygenerovány.");
                }}
                className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-brand-foreground disabled:opacity-60"
              >
                <ImagePlus className="size-4" />
                Vygenerovat všechny vizuály
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {project.scenes.map((scene) => {
                const status = scene.visualStatus ?? "waiting";
                const generating = busy === `vis-${scene.id}` || status === "running";
                return (
                  <figure key={scene.id} className="overflow-hidden rounded-xl border border-border bg-surface">
                    <SceneImage
                      path={scene.imagePath}
                      alt={`Náhled scény ${scene.index}: ${scene.title}`}
                    />
                    <figcaption className="space-y-2 p-3">
                      <div className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wider">
                        <span className="text-muted-foreground">Scéna {scene.index}</span>
                        <span
                          className={
                            status === "done"
                              ? "text-status-done"
                              : status === "error"
                                ? "text-status-error"
                                : status === "running"
                                  ? "text-cyan"
                                  : "text-muted-foreground"
                          }
                        >
                          {VISUAL_STATUS_LABEL[generating ? "running" : status]}
                        </span>
                      </div>
                      <p className="text-xs font-semibold">{scene.title}</p>
                      <p className="line-clamp-2 font-mono text-[11px] text-muted-foreground">
                        {scene.visualPrompt}
                      </p>
                      {scene.visualError && (
                        <p className="text-[11px] text-status-error">{scene.visualError}</p>
                      )}
                      <button
                        disabled={busy !== null}
                        onClick={async () => {
                          setNote(null);
                          setErr(null);
                          setBusy(`vis-${scene.id}`);
                          const message = await generateVisual(project.id, scene.id);
                          setBusy(null);
                          if (message) setErr(message);
                          else setNote(`Vizuál scény ${scene.index} je hotový.`);
                        }}
                        className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-cyan disabled:opacity-60"
                      >
                        <RefreshCw className={`size-3 ${generating ? "animate-spin" : ""}`} />
                        {generating
                          ? "Generuji…"
                          : scene.imagePath
                            ? "Regenerovat vizuál"
                            : "Vygenerovat vizuál"}
                      </button>
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          </section>
        )}


        {tab === "hudba" && (
          <section className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Hudba a efekty</h3>
            <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
              {project.tracks.map((t) => (
                <li key={t.id} className="flex items-center gap-3 p-4">
                  <Music4 className="size-4 shrink-0 text-cyan" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{t.name}</p>
                    <p className="text-[11px] text-muted-foreground">{t.note}</p>
                  </div>
                  <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                    {t.kind}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {tab === "titulky" && (
          <section className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Titulky</h3>
            <label className="flex items-center justify-between rounded-2xl border border-border bg-surface p-5">
              <span className="flex items-center gap-2 text-sm font-medium">
                <Captions className="size-4 text-cyan" />
                Titulky zapnuté
              </span>
              <input
                type="checkbox"
                checked={project.subtitlesEnabled}
                onChange={(e) => updateProject(project.id, { subtitlesEnabled: e.target.checked })}
                className="size-5 accent-[var(--brand)]"
              />
            </label>
            {project.subtitlesEnabled && (
              <div className="space-y-2 rounded-2xl border border-border bg-surface p-4 font-mono text-[12px] leading-relaxed text-muted-foreground">
                {project.scenes.slice(0, 6).map((s, i) => (
                  <p key={s.id}>
                    <span className="text-cyan">
                      {formatDuration(i * s.seconds)} → {formatDuration((i + 1) * s.seconds)}
                    </span>{" "}
                    {s.narration.slice(0, 90)}…
                  </p>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === "export" && (
          <section className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Export</h3>
            <button
              onClick={() => {
                updateProject(project.id, { state: "Exportováno" });
                setNote("Export byl zařazen do fronty. Skutečný rendering proběhne po připojení render API.");
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan py-4 text-sm font-bold uppercase tracking-wider text-cyan-foreground shadow-cyan"
            >
              <Upload className="size-4" />
              Exportovat video
            </button>
            <button
              onClick={() => setNote("Stažení bude dostupné po dokončení renderingu na serveru.")}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface py-3.5 text-sm font-medium"
            >
              <Download className="size-4" />
              Stáhnout video
            </button>
            <button
              onClick={() => setNote("Metadata pro YouTube se vygenerují po připojení YouTube API.")}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface py-3.5 text-sm font-medium"
            >
              <Youtube className="size-4" />
              Připravit pro YouTube
            </button>
          </section>
        )}
      </div>
    </AppShell>
  );
}

function Meta({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-border/60 bg-surface-2 p-3">
      <dt className="field-label">{label}</dt>
      <dd className={`mt-1 truncate text-xs font-semibold ${accent ? "text-status-done" : ""}`}>{value}</dd>
    </div>
  );
}
