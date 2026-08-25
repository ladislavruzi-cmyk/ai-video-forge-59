/**
 * Serverová fronta pro generování vizuálů.
 *
 * Úlohy žijí v tabulce `visual_jobs`, takže běh NENÍ vázaný na otevřenou
 * kartu prohlížeče. Frontu posouvá dopředu buď naplánovaná serverová úloha
 * (každou minutu), nebo přihlášený uživatel z aplikace. Jedna úloha = jedna
 * scéna, takže selhání jedné scény nikdy nezastaví ostatní.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { base64ToBytes, generateSceneImage } from "./image.server";

export const VISUALS_BUCKET = "scene-visuals";

/** Po tolika minutách považujeme běžící úlohu za mrtvou (spadlý běh). */
const STALE_MINUTES = 6;
const MAX_ATTEMPTS = 3;

type Db = SupabaseClient<any, any, any>;

interface JobRow {
  id: string;
  user_id: string;
  project_id: string;
  scene_id: string;
  prompt: string;
  aspect_ratio: string;
  attempts: number;
}

/** Uvolní úlohy, které zůstaly "running" po spadlém běhu. */
export async function releaseStaleJobs(db: Db): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_MINUTES * 60_000).toISOString();
  const { data } = await db
    .from("visual_jobs")
    .select("id, attempts")
    .eq("status", "running")
    .lt("started_at", cutoff);

  for (const job of (data ?? []) as { id: string; attempts: number }[]) {
    if (job.attempts >= MAX_ATTEMPTS) {
      await db
        .from("visual_jobs")
        .update({
          status: "error",
          error: "Generování se opakovaně nedokončilo. Zkus scénu spustit znovu.",
          finished_at: new Date().toISOString(),
        })
        .eq("id", job.id);
    } else {
      await db.from("visual_jobs").update({ status: "pending", started_at: null }).eq("id", job.id);
    }
  }
}

/** Zapíše výsledek do projektu (JSONB) — jen do jedné scény. */
async function patchProjectScene(
  db: Db,
  projectId: string,
  sceneId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { data } = await db.from("projects").select("data").eq("id", projectId).maybeSingle();
  const project = (data?.data ?? null) as { scenes?: Record<string, unknown>[] } | null;
  if (!project?.scenes) return;
  const scenes = project.scenes.map((s) => (s["id"] === sceneId ? { ...s, ...patch } : s));
  await db.from("projects").update({ data: { ...project, scenes } }).eq("id", projectId);
}

/**
 * Vyzvedne jednu čekající úlohu a zpracuje ji.
 * `userId` omezí frontu na jednoho uživatele (volání z aplikace).
 * Vrací false, pokud už není co zpracovat.
 */
export async function processNextVisualJob(db: Db, userId?: string): Promise<boolean> {
  let query = db
    .from("visual_jobs")
    .select("id, user_id, project_id, scene_id, prompt, aspect_ratio, attempts")
    .eq("status", "pending")
    .order("scene_index", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(5);
  if (userId) query = query.eq("user_id", userId);

  const { data: candidates } = await query;
  const rows = (candidates ?? []) as JobRow[];
  if (rows.length === 0) return false;

  // Atomické "zabrání" úlohy — kdo přepne pending → running, ten ji zpracuje.
  let job: JobRow | null = null;
  for (const candidate of rows) {
    const { data: claimed } = await db
      .from("visual_jobs")
      .update({
        status: "running",
        started_at: new Date().toISOString(),
        attempts: candidate.attempts + 1,
        error: null,
      })
      .eq("id", candidate.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (claimed) {
      job = candidate;
      break;
    }
  }
  if (!job) return false;

  await patchProjectScene(db, job.project_id, job.scene_id, {
    visualStatus: "running",
    visualError: null,
  });

  try {
    const b64 = await generateSceneImage(job.prompt, job.aspect_ratio);
    const bytes = base64ToBytes(b64);
    const path = `${job.user_id}/${job.project_id}/${job.scene_id}-${Date.now().toString(36)}.png`;

    const { error: uploadError } = await db.storage
      .from(VISUALS_BUCKET)
      .upload(path, bytes, { contentType: "image/png", upsert: true });
    if (uploadError) {
      throw new Error(`Obrázek se nepodařilo uložit do úložiště: ${uploadError.message}`);
    }

    await patchProjectScene(db, job.project_id, job.scene_id, {
      visualStatus: "done",
      imagePath: path,
      visualError: null,
    });
    await db
      .from("visual_jobs")
      .update({ status: "done", image_path: path, finished_at: new Date().toISOString(), error: null })
      .eq("id", job.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generování vizuálu selhalo.";
    await patchProjectScene(db, job.project_id, job.scene_id, {
      visualStatus: "error",
      visualError: message,
    });
    await db
      .from("visual_jobs")
      .update({ status: "error", error: message, finished_at: new Date().toISOString() })
      .eq("id", job.id);
  }

  return true;
}
