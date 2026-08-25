import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { validateRenderedMp4 } from "./mp4.server";
import {
  buildRenderSource,
  createRender,
  fetchRender,
  mapStatus,
  RENDER_STAGE_LABEL,
  type RenderScene,
} from "./creatomate.server";

const VISUALS_BUCKET = "scene-visuals";
const AUDIO_BUCKET = "scene-audio";
const RENDERS_BUCKET = "project-renders";
/** Podepsané odkazy musí Creatomate stihnout stáhnout i u dlouhého renderu. */
const SIGNED_URL_SECONDS = 60 * 60 * 24;
/** Nad tuto velikost necháváme MP4 na CDN render služby (limit paměti serveru). */
const MAX_COPY_BYTES = 90 * 1024 * 1024;

export interface RenderJobView {
  id: string;
  projectId: string;
  status: "pending" | "rendering" | "done" | "error";
  stage: string | null;
  progress: number | null;
  /** Odkaz na hotové MP4 — z vlastního úložiště, jinak z CDN render služby. */
  videoUrl: string | null;
  /** Stejný soubor s vynuceným stažením (Content-Disposition: attachment). */
  downloadUrl: string | null;
  storagePath: string | null;
  durationSeconds: number | null;
  sceneCount: number | null;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
}

type JobRow = {
  id: string;
  project_id: string;
  status: string;
  stage: string | null;
  progress: number | null;
  output_url: string | null;
  storage_path: string | null;
  duration_seconds: number | string | null;
  scene_count: number | null;
  error: string | null;
  created_at: string;
  finished_at: string | null;
};

const JOB_COLUMNS =
  "id, project_id, provider_render_id, status, stage, progress, output_url, storage_path, duration_seconds, scene_count, error, created_at, finished_at";

function toView(row: JobRow, videoUrl: string | null): RenderJobView {
  const status = (["pending", "rendering", "done", "error"] as const).includes(
    row.status as "pending",
  )
    ? (row.status as RenderJobView["status"])
    : "rendering";
  return {
    id: row.id,
    projectId: row.project_id,
    status,
    stage: row.stage,
    progress: row.progress,
    videoUrl,
    downloadUrl: videoUrl
      ? videoUrl.includes("/storage/v1/object/sign/")
        ? `${videoUrl}&download=video.mp4`
        : videoUrl
      : null,
    storagePath: row.storage_path,
    durationSeconds: row.duration_seconds === null ? null : Number(row.duration_seconds),
    sceneCount: row.scene_count,
    error: row.error,
    createdAt: row.created_at,
    finishedAt: row.finished_at,
  };
}

type Client = { storage: { from: (b: string) => { createSignedUrl: (p: string, s: number) => Promise<{ data: { signedUrl: string } | null; error: { message: string } | null }> } } };

async function signedUrl(supabase: Client, bucket: string, path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, SIGNED_URL_SECONDS);
  if (error || !data?.signedUrl) {
    throw new Error(`Soubor ${path} se nepodařilo zpřístupnit render službě: ${error?.message ?? "neznámá chyba"}`);
  }
  return data.signedUrl;
}

/** Ověří, že soubor je skutečně stažitelný — ne jen že existuje záznam v databázi. */
async function assertReachable(url: string, label: string): Promise<void> {
  const res = await fetch(url, { method: "GET", headers: { Range: "bytes=0-1" } });
  if (!res.ok && res.status !== 206) {
    throw new Error(`${label} není dostupný ke stažení (HTTP ${res.status}). Render nebyl spuštěn.`);
  }
  await res.arrayBuffer().catch(() => undefined);
}

const startSchema = z.object({ projectId: z.string().min(1) });

/**
 * Spustí skutečný render MP4 z už existujících vizuálů, dabingu a časové osy.
 * Nic negeneruje ani nemění — pouze čte uložená data projektu.
 */
export const startRenderFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => startSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    if (!process.env["CREATOMATE_API_KEY"]) {
      throw new Error("Chybí CREATOMATE_API_KEY. Ulož klíč mezi serverové Secrets a spusť render znovu.");
    }

    const { data: row, error: loadError } = await supabase
      .from("projects")
      .select("data")
      .eq("id", data.projectId)
      .maybeSingle();
    if (loadError) throw new Error(`Projekt se nepodařilo načíst: ${loadError.message}`);
    if (!row?.data) throw new Error("Projekt nebyl nalezen.");

    const project = row.data as unknown as {
      brief?: { aspectRatio?: string };
      scenes?: {
        id: string;
        index: number;
        title: string;
        imagePath?: string | null;
        audioPath?: string | null;
        audioDuration?: number | null;
        audioSeconds?: number | null;
        visualDuration?: number | null;
        startTime?: number | null;
        transitionSeconds?: number | null;
        transition?: string;
      }[];
    };

    const scenes = (project.scenes ?? []).slice().sort((a, b) => a.index - b.index);
    if (scenes.length === 0) throw new Error("Projekt neobsahuje žádné scény.");

    const missing: string[] = [];
    for (const s of scenes) {
      const label = `Scéna ${s.index + 1}`;
      if (!s.imagePath) missing.push(`${label}: chybí vizuál`);
      if (!s.audioPath) missing.push(`${label}: chybí dabing`);
      const audio = s.audioDuration ?? s.audioSeconds ?? null;
      if (!audio || !s.visualDuration || s.startTime === null || s.startTime === undefined) {
        missing.push(`${label}: chybí synchronizace (spusť záložku Synchronizace)`);
      }
    }
    if (missing.length > 0) {
      throw new Error(`Render nebyl spuštěn — nejdřív doplň:\n${missing.slice(0, 6).join("\n")}`);
    }

    const renderScenes: RenderScene[] = [];
    for (const s of scenes) {
      const imageUrl = await signedUrl(supabase as unknown as Client, VISUALS_BUCKET, s.imagePath!);
      const audioUrl = await signedUrl(supabase as unknown as Client, AUDIO_BUCKET, s.audioPath!);
      await assertReachable(imageUrl, `Vizuál scény ${s.index + 1}`);
      await assertReachable(audioUrl, `Dabing scény ${s.index + 1}`);
      renderScenes.push({
        index: s.index,
        title: s.title,
        imageUrl,
        audioUrl,
        audioDuration: (s.audioDuration ?? s.audioSeconds)!,
        visualDuration: s.visualDuration!,
        startTime: s.startTime!,
        transitionSeconds: s.transitionSeconds ?? 0,
        transition: s.transition ?? "",
      });
    }

    const totalSeconds = renderScenes.reduce(
      (max, s) => Math.max(max, s.startTime + s.visualDuration),
      0,
    );

    const source = buildRenderSource(renderScenes, project.brief?.aspectRatio ?? "16:9");
    const render = await createRender(source);

    const { data: inserted, error: insertError } = await supabase
      .from("render_jobs")
      .insert({
        user_id: userId,
        project_id: data.projectId,
        provider: "creatomate",
        provider_render_id: render.id,
        status: mapStatus(render.status),
        stage: RENDER_STAGE_LABEL[render.status.toLowerCase()] ?? "Renderování videa",
        duration_seconds: Math.round(totalSeconds * 100) / 100,
        scene_count: renderScenes.length,
      })
      .select(JOB_COLUMNS)
      .single();

    if (insertError || !inserted) {
      throw new Error(`Render byl spuštěn, ale nepodařilo se uložit úlohu: ${insertError?.message ?? ""}`);
    }

    return { job: toView(inserted as unknown as JobRow, null) };
  });

const statusSchema = z.object({ jobId: z.string().min(1) });

/**
 * Zkontroluje stav renderu u služby. Hotové MP4 zkusí uložit do vlastního
 * úložiště; teprve pak je render považovaný za dokončený.
 */
export const renderStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => statusSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: row, error } = await supabase
      .from("render_jobs")
      .select(JOB_COLUMNS)
      .eq("id", data.jobId)
      .maybeSingle();
    if (error) throw new Error(`Stav renderu se nepodařilo načíst: ${error.message}`);
    if (!row) throw new Error("Render úloha nebyla nalezena.");

    const job = row as unknown as JobRow & { provider_render_id: string | null };

    if (job.status === "done" || job.status === "error") {
      return { job: toView(job, await resolveVideoUrl(supabase, job)) };
    }
    if (!job.provider_render_id) {
      return { job: toView(job, null) };
    }

    let provider;
    try {
      provider = await fetchRender(job.provider_render_id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Neznámá chyba render služby.";
      const { data: updated } = await supabase
        .from("render_jobs")
        .update({ status: "error", stage: "Render selhal", error: message, finished_at: new Date().toISOString() })
        .eq("id", job.id)
        .select(JOB_COLUMNS)
        .single();
      return { job: toView((updated ?? { ...job, status: "error", error: message }) as unknown as JobRow, null) };
    }

    const status = mapStatus(provider.status);
    const stage = RENDER_STAGE_LABEL[provider.status.toLowerCase()] ?? "Renderování videa";

    if (status === "rendering") {
      const { data: updated } = await supabase
        .from("render_jobs")
        .update({ status: "rendering", stage })
        .eq("id", job.id)
        .select(JOB_COLUMNS)
        .single();
      return { job: toView((updated ?? job) as unknown as JobRow, null) };
    }

    if (status === "error") {
      const message =
        provider.error ?? "Render služba render neúspěšně ukončila. Zkus render spustit znovu.";
      const { data: updated } = await supabase
        .from("render_jobs")
        .update({ status: "error", stage: "Render selhal", error: message, finished_at: new Date().toISOString() })
        .eq("id", job.id)
        .select(JOB_COLUMNS)
        .single();
      return { job: toView((updated ?? job) as unknown as JobRow, null) };
    }

    if (!provider.url) {
      const message = "Render služba označila render za hotový, ale nevrátila soubor MP4.";
      const { data: updated } = await supabase
        .from("render_jobs")
        .update({ status: "error", stage: "Render selhal", error: message, finished_at: new Date().toISOString() })
        .eq("id", job.id)
        .select(JOB_COLUMNS)
        .single();
      return { job: toView((updated ?? job) as unknown as JobRow, null) };
    }

    // Hotové MP4 nejdřív skutečně stáhneme a ověříme — bez toho žádné „Video připraveno“.
    const failWith = async (message: string) => {
      const { data: updated } = await supabase
        .from("render_jobs")
        .update({
          status: "error",
          stage: "Render selhal",
          error: message,
          finished_at: new Date().toISOString(),
        })
        .eq("id", job.id)
        .select(JOB_COLUMNS)
        .single();
      return { job: toView((updated ?? { ...job, status: "error", error: message }) as unknown as JobRow, null) };
    };

    let bytes: Uint8Array;
    try {
      const file = await fetch(provider.url);
      if (!file.ok) {
        return await failWith(`Hotové MP4 není dostupné ke stažení (HTTP ${file.status}).`);
      }
      bytes = new Uint8Array(await file.arrayBuffer());
    } catch (err) {
      return await failWith(
        `Hotové MP4 se nepodařilo stáhnout z render služby: ${err instanceof Error ? err.message : "neznámá chyba"}`,
      );
    }

    if (bytes.byteLength > MAX_COPY_BYTES) {
      return await failWith(
        `Vyrenderované video je příliš velké (${Math.round(bytes.byteLength / 1024 / 1024)} MB) na uložení do úložiště.`,
      );
    }

    const expected = job.duration_seconds === null ? null : Number(job.duration_seconds);
    const { error: invalid, facts } = validateRenderedMp4(bytes, expected);
    if (invalid) {
      return await failWith(`Export neprošel kontrolou: ${invalid}`);
    }

    const path = `${userId}/${job.project_id}/${job.id}.mp4`;
    const { error: upErr } = await supabase.storage
      .from(RENDERS_BUCKET)
      .upload(path, bytes, { contentType: "video/mp4", upsert: true, cacheControl: "3600" });
    if (upErr) {
      return await failWith(`Hotové MP4 se nepodařilo uložit do úložiště: ${upErr.message}`);
    }

    // Kontrola, že uložený soubor je skutečně stažitelný a celý.
    try {
      const check = await signedUrl(supabase as unknown as Client, RENDERS_BUCKET, path);
      const res = await fetch(check, { headers: { Range: "bytes=0-1" } });
      const total = Number(res.headers.get("content-range")?.split("/")[1] ?? 0);
      await res.arrayBuffer().catch(() => undefined);
      if (total !== bytes.byteLength) {
        return await failWith(
          `Uložené MP4 v úložišti má jinou velikost (${total} B) než vyrenderovaný soubor (${bytes.byteLength} B).`,
        );
      }
    } catch (err) {
      return await failWith(
        `Uložené MP4 nelze z úložiště přehrát: ${err instanceof Error ? err.message : "neznámá chyba"}`,
      );
    }

    const { data: updated } = await supabase
      .from("render_jobs")
      .update({
        status: "done",
        stage: "Video připraveno",
        progress: 100,
        output_url: provider.url,
        storage_path: path,
        duration_seconds: facts.seconds ?? expected,
        error: null,
        finished_at: new Date().toISOString(),
      })
      .eq("id", job.id)
      .select(JOB_COLUMNS)
      .single();

    const finished = (updated ?? { ...job, status: "done", output_url: provider.url, storage_path: path }) as unknown as JobRow;
    return { job: toView(finished, await resolveVideoUrl(supabase, finished)) };
  });


async function resolveVideoUrl(supabase: unknown, job: JobRow): Promise<string | null> {
  if (job.storage_path) {
    try {
      return await signedUrl(supabase as Client, RENDERS_BUCKET, job.storage_path);
    } catch {
      /* fallback níž */
    }
  }
  return job.output_url ?? null;
}

const latestSchema = z.object({ projectId: z.string().min(1) });

/** Poslední render úloha projektu — zdroj pravdy pro stav exportu. */
export const latestRenderFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => latestSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("render_jobs")
      .select(JOB_COLUMNS)
      .eq("project_id", data.projectId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw new Error(`Stav exportu se nepodařilo načíst: ${error.message}`);
    const row = (rows ?? [])[0] as unknown as JobRow | undefined;
    if (!row) return { job: null as RenderJobView | null };
    return { job: toView(row, await resolveVideoUrl(supabase, row)) };
  });
