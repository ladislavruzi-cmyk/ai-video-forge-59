import { supabase } from "@/integrations/supabase/client";
import type { VideoProject } from "./types";

/**
 * Projekty jsou v databázi vázané na ID přihlášeného uživatele.
 * Row Level Security zajišťuje, že uživatel vidí a mění pouze své projekty.
 */

const STALE_VISUAL_MSG =
  "Generování vizuálu bylo přerušeno (zavření nebo obnovení stránky během běhu). Spusť generování této scény znovu.";
const STALE_AUDIO_MSG =
  "Generování dabingu bylo přerušeno (zavření nebo obnovení stránky během běhu). Spusť generování této scény znovu.";

/**
 * Stav "running" žije jen v běžící kartě prohlížeče. Pokud se stránka obnoví
 * nebo zavře, požadavek se zruší a v databázi zůstane zaseknuté "Generuje se".
 * Při načtení proto takové scény označíme jako Chybu — hotové scény necháme být.
 */
function healStaleScenes(project: VideoProject, activeVisualScenes: Set<string>): VideoProject {
  return {
    ...project,
    scenes: (project.scenes ?? []).map((s) => ({
      ...s,
      ...(s.visualStatus === "running" && !s.imagePath && !activeVisualScenes.has(s.id)
        ? { visualStatus: "error" as const, visualError: s.visualError ?? STALE_VISUAL_MSG }
        : {}),
      ...(s.audioStatus === "running" && !s.audioPath
        ? { audioStatus: "error" as const, audioError: s.audioError ?? STALE_AUDIO_MSG }
        : {}),
    })),
  };
}

/** Scény, které právě čekají nebo běží v serverové frontě — ty neléčíme. */
export async function fetchActiveVisualJobs(): Promise<
  { projectId: string; sceneId: string; status: string }[]
> {
  const { data, error } = await supabase
    .from("visual_jobs")
    .select("project_id, scene_id, status")
    .in("status", ["pending", "running"]);
  if (error) return [];
  return (data ?? []).map((r) => ({
    projectId: r.project_id as string,
    sceneId: r.scene_id as string,
    status: r.status as string,
  }));
}

export async function fetchProjects(): Promise<VideoProject[]> {
  const active = new Set((await fetchActiveVisualJobs()).map((j) => `${j.projectId}:${j.sceneId}`));
  const { data, error } = await supabase
    .from("projects")
    .select("id, data")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const project = { ...(row.data as unknown as VideoProject), id: row.id };
    const activeScenes = new Set(
      [...active].filter((k) => k.startsWith(`${project.id}:`)).map((k) => k.split(":")[1] ?? ""),
    );
    return healStaleScenes(project, activeScenes);
  });
}


export async function saveProject(project: VideoProject): Promise<void> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error("Nejsi přihlášený.");

  const { error } = await supabase.from("projects").upsert(
    {
      id: project.id,
      user_id: userData.user.id,
      title: project.title,
      word_count: project.wordCount ?? 0,
      total_seconds: project.totalSeconds,
      data: JSON.parse(JSON.stringify(project)),
    },
    { onConflict: "id" },
  );
  if (error) throw error;
}

export async function removeProject(id: string): Promise<void> {
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw error;
}
