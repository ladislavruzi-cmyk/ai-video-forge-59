import { supabase } from "@/integrations/supabase/client";
import type { VideoProject } from "./types";

/**
 * Projekty jsou v databázi vázané na ID přihlášeného uživatele.
 * Row Level Security zajišťuje, že uživatel vidí a mění pouze své projekty.
 */

export async function fetchProjects(): Promise<VideoProject[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("id, data")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({ ...(row.data as unknown as VideoProject), id: row.id }));
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
      data: project as unknown as Record<string, unknown>,
    },
    { onConflict: "id" },
  );
  if (error) throw error;
}

export async function removeProject(id: string): Promise<void> {
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw error;
}
