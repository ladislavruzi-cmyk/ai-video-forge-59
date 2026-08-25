import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Check, Download, Loader2, Play, RefreshCw, Upload } from "lucide-react";
import { latestRenderFn, refreshRenderUrlFn, renderStatusFn, startRenderFn, type RenderJobView } from "@/lib/ai/render.functions";
import { formatSeconds } from "@/lib/studio/timeline";
import type { VideoProject } from "@/lib/studio/types";

/** Fáze renderu tak, jak je uživatel vidí. Nic se nedopočítává dopředu. */
const STAGES = [
  "Příprava scén",
  "Načítání vizuálů a dabingu",
  "Sestavení časové osy",
  "Renderování videa",
  "Finalizace MP4",
  "Video připraveno",
] as const;

function stageIndex(job: RenderJobView | null): number {
  if (!job) return -1;
  if (job.status === "done") return STAGES.length - 1;
  const stage = job.stage ?? "";
  if (stage.includes("Příprava")) return 0;
  if (stage.includes("frontě") || stage.includes("Načítání")) return 1;
  if (stage.includes("Finalizace")) return 4;
  if (stage.includes("Renderování")) return 3;
  return 2;
}

const CODEC_LABEL: Record<string, string> = {
  avc1: "H.264 (avc1)",
  avc3: "H.264 (avc3)",
  hvc1: "H.265 (hvc1)",
  hev1: "H.265 (hev1)",
  mp4a: "AAC (mp4a)",
};

function codec(value: string | null): string {
  if (!value) return "neurčeno";
  return CODEC_LABEL[value] ?? value;
}

function megabytes(bytes: number | null): string {
  if (!bytes) return "neurčeno";
  return `${(bytes / 1024 / 1024).toFixed(2)} MB (${bytes.toLocaleString("cs-CZ")} B)`;
}

const STATUS_LABEL: Record<RenderJobView["status"], string> = {
  pending: "Render čeká",
  rendering: "Renderování videa…",
  done: "Video připraveno",
  error: "Render selhal",
};

export function RenderPanel({
  project,
  onStateChange,
}: {
  project: VideoProject;
  onStateChange: (state: VideoProject["state"]) => void;
}) {
  const callStart = useServerFn(startRenderFn);
  const callStatus = useServerFn(renderStatusFn);
  const callLatest = useServerFn(latestRenderFn);
  const callRefresh = useServerFn(refreshRenderUrlFn);

  const [job, setJob] = useState<RenderJobView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const projectId = project.id;

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const poll = useCallback(
    async (jobId: string) => {
      try {
        const { job: fresh } = (await callStatus({ data: { jobId } })) as { job: RenderJobView };
        setJob(fresh);
        if (fresh.status === "done") onStateChange("Exportováno");
        if (fresh.status === "rendering" || fresh.status === "pending") {
          clearTimer();
          timer.current = setTimeout(() => void poll(jobId), 8000);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Stav renderu se nepodařilo zjistit.");
        clearTimer();
        timer.current = setTimeout(() => void poll(jobId), 15000);
      }
    },
    [callStatus, onStateChange],
  );

  /** Obnoví podepsaný odkaz — po expiraci by přehrávač zůstal černý. */
  const refreshUrl = useCallback(
    async (jobId: string) => {
      try {
        const { job: fresh } = (await callRefresh({ data: { jobId } })) as { job: RenderJobView };
        setJob(fresh);
      } catch {
        setError("Odkaz na video vypršel a nepodařilo se ho obnovit. Zkus stránku načíst znovu.");
      }
    },
    [callRefresh],
  );

  useEffect(() => {
    if (job?.status !== "done") return;
    const id = job.id;
    const interval = setInterval(() => void refreshUrl(id), 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [job?.status, job?.id, refreshUrl]);

  useEffect(() => {
    let alive = true;
    void callLatest({ data: { projectId } })
      .then((res) => {
        const fresh = (res as { job: RenderJobView | null }).job;
        if (!alive) return;
        setJob(fresh);
        if (fresh && (fresh.status === "rendering" || fresh.status === "pending")) void poll(fresh.id);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
      clearTimer();
    };
  }, [callLatest, poll, projectId]);

  const start = async () => {
    setError(null);
    setStarting(true);
    try {
      const { job: fresh } = (await callStart({ data: { projectId } })) as { job: RenderJobView };
      setJob(fresh);
      void poll(fresh.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Render se nepodařilo spustit.");
    } finally {
      setStarting(false);
    }
  };

  const active = job?.status === "rendering" || job?.status === "pending" || starting;
  const ready = job?.status === "done" && !!job.videoUrl;
  const current = stageIndex(job);

  const targetLabel = project.brief.aspectRatio === "9:16" ? "1080×1920" : "1920×1080";
  const targetShort = project.brief.aspectRatio === "9:16" ? 1080 : 1920;
  const belowFullHd =
    job?.status === "done" && !!job.width && !!job.height && Math.max(job.width, job.height) < targetShort;

  const scenesReady = project.scenes.filter((s) => s.imagePath && s.audioPath && s.visualDuration).length;
  const allReady = scenesReady === project.scenes.length && project.scenes.length > 0;

  return (
    <section className="space-y-4">
      <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Export</h3>

      <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold">
            {job ? STATUS_LABEL[job.status] : "Render čeká"}
          </span>
          <span className="text-xs text-muted-foreground">
            {project.scenes.length} scén · {formatSeconds(project.timeline?.totalSeconds ?? project.totalSeconds)}
          </span>
        </div>

        <p className="text-xs text-muted-foreground">
          Render skládá MP4 (H.264/AAC, požadováno {targetLabel})
          z už hotových vizuálů, dabingu a synchronizované časové osy. Nic se negeneruje znovu.
        </p>

        {!allReady && (
          <p className="rounded-xl border border-status-error/40 bg-status-error/10 p-3 text-xs text-status-error">
            Připraveno {scenesReady} z {project.scenes.length} scén. Doplň chybějící vizuály, dabing
            a spusť Synchronizaci — bez toho render nespustím.
          </p>
        )}

        {(active || job) && (
          <ol className="space-y-1.5 text-xs">
            {STAGES.map((label, i) => {
              const done = current > i || job?.status === "done";
              const running = active && current === i;
              return (
                <li key={label} className="flex items-center gap-2">
                  {done ? (
                    <Check className="size-3.5 text-status-done" />
                  ) : running ? (
                    <Loader2 className="size-3.5 animate-spin text-cyan" />
                  ) : (
                    <span className="size-3.5 rounded-full border border-border" />
                  )}
                  <span className={done ? "text-status-done" : running ? "" : "text-muted-foreground"}>
                    {label}
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        {job?.status === "error" && (
          <p className="flex items-start gap-2 rounded-xl border border-status-error/40 bg-status-error/10 p-3 text-xs text-status-error">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <span className="whitespace-pre-line">{job.error ?? "Render selhal."}</span>
          </p>
        )}

        {error && (
          <p className="whitespace-pre-line rounded-xl border border-status-error/40 bg-status-error/10 p-3 text-xs text-status-error">
            {error}
          </p>
        )}

        {ready && job.videoUrl && (
          <video
            key={job.videoUrl}
            src={job.videoUrl}
            controls
            playsInline
            preload="metadata"
            onError={() => void refreshUrl(job.id)}
            className="w-full rounded-xl border border-border bg-black"
          />
        )}

        {ready && (
          <div className="space-y-2 rounded-xl border border-border bg-surface-2 p-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Ověřeno z výsledného souboru
            </p>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
              <dt className="text-muted-foreground">Rozlišení</dt>
              <dd className="font-medium">
                {job.width && job.height ? `${job.width}×${job.height}` : "neurčeno"}
              </dd>
              <dt className="text-muted-foreground">Video kodek</dt>
              <dd className="font-medium">{codec(job.videoCodec)}</dd>
              <dt className="text-muted-foreground">Audio kodek</dt>
              <dd className="font-medium">{codec(job.audioCodec)}</dd>
              <dt className="text-muted-foreground">Délka</dt>
              <dd className="font-medium">
                {job.durationSeconds ? formatSeconds(job.durationSeconds) : "neurčeno"}
              </dd>
              <dt className="text-muted-foreground">Velikost souboru</dt>
              <dd className="font-medium">{megabytes(job.fileBytes)}</dd>
            </dl>
          </div>
        )}

        {ready && belowFullHd && (
          <p className="flex items-start gap-2 rounded-xl border border-status-running/40 bg-status-running/10 p-3 text-xs">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Export je dokončen, ale aktuální renderovací služba poskytuje pouze{" "}
              {job.width}×{job.height}. Pro Full HD {targetLabel} je nutný tarif/služba s podporou
              Full HD. Vizuály, dabing ani synchronizace se nemažou — po navýšení tarifu stačí
              spustit render znovu.
            </span>
          </p>
        )}

        {ready && (
          <button
            onClick={() => void refreshUrl(job.id)}
            className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-2 py-2 text-xs font-medium"
          >
            <RefreshCw className="size-3.5" />
            Obnovit odkaz na video
          </button>
        )}

      </div>

      <button
        onClick={() => void start()}
        disabled={active || !allReady}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan py-4 text-sm font-bold uppercase tracking-wider text-cyan-foreground shadow-cyan disabled:opacity-50"
      >
        {active ? <Loader2 className="size-4 animate-spin" /> : job?.status === "error" ? <RefreshCw className="size-4" /> : <Upload className="size-4" />}
        {active ? "Renderování videa…" : job?.status === "error" ? "Zkusit render znovu" : job?.status === "done" ? "Renderovat znovu" : "Exportovat video"}
      </button>

      {ready && job.videoUrl && (
        <div className="grid grid-cols-2 gap-3">
          <a
            href={job.videoUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface py-3.5 text-sm font-medium"
          >
            <Play className="size-4" />
            Přehrát video
          </a>
          <a
            href={job.downloadUrl ?? job.videoUrl}
            download={`${project.title || "video"}.mp4`}
            className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface py-3.5 text-sm font-medium"
          >
            <Download className="size-4" />
            Stáhnout video
          </a>

        </div>
      )}
    </section>
  );
}
