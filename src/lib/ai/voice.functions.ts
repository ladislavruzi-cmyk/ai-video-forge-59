import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { synthesizeNarration } from "./tts.server";

export const AUDIO_BUCKET = "scene-audio";

const inputSchema = z.object({
  projectId: z.string().min(1),
  sceneId: z.string().min(1),
  narration: z.string().min(3),
  voice: z.string().min(1),
  language: z.string().min(1),
});

/**
 * Vygeneruje dabing pro jednu scénu a uloží WAV do privátního úložiště
 * pod složku přihlášeného uživatele. Vrací cestu a délku audia.
 */
export const generateSceneVoiceFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { wav, seconds } = await synthesizeNarration(data.narration, data.voice, data.language);

    const path = `${userId}/${data.projectId}/${data.sceneId}-${Date.now().toString(36)}.wav`;
    const { error } = await supabase.storage
      .from(AUDIO_BUCKET)
      .upload(path, wav, { contentType: "audio/wav", upsert: true });

    if (error) throw new Error(`Audio se nepodařilo uložit do úložiště: ${error.message}`);

    return { path, seconds };
  });
