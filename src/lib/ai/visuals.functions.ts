import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { base64ToBytes, generateSceneImage } from "./image.server";

export const VISUALS_BUCKET = "scene-visuals";

const inputSchema = z.object({
  projectId: z.string().min(1),
  sceneId: z.string().min(1),
  prompt: z.string().min(3),
  aspectRatio: z.string().min(3),
});

/**
 * Vygeneruje obrázek pro jednu scénu a uloží ho do privátního úložiště
 * pod složku přihlášeného uživatele. Vrací cestu k souboru.
 */
export const generateSceneVisualFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const b64 = await generateSceneImage(data.prompt, data.aspectRatio);
    const bytes = base64ToBytes(b64);

    const path = `${userId}/${data.projectId}/${data.sceneId}-${Date.now().toString(36)}.png`;
    const { error } = await supabase.storage
      .from(VISUALS_BUCKET)
      .upload(path, bytes, { contentType: "image/png", upsert: true });

    if (error) throw new Error(`Obrázek se nepodařilo uložit do úložiště: ${error.message}`);

    return { path };
  });
