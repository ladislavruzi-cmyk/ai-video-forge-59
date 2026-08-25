import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { readWavInfo } from "./wav.server";

export const AUDIO_BUCKET = "scene-audio";
export const VISUALS_BUCKET = "scene-visuals";

const inputSchema = z.object({
  projectId: z.string().min(1),
  scenes: z
    .array(
      z.object({
        sceneId: z.string().min(1),
        audioPath: z.string().nullable().optional(),
        imagePath: z.string().nullable().optional(),
      }),
    )
    .min(1),
});

export interface SceneMediaResult {
  sceneId: string;
  ok: boolean;
  audioSeconds: number | null;
  audioBytes: number | null;
  imageBytes: number | null;
  error: string | null;
}

/**
 * Přečte skutečné uložené soubory scén (obrázek + dabing) z privátního úložiště
 * a vrátí jejich reálné parametry — hlavně skutečnou délku audia z WAV hlavičky.
 * Nic negeneruje ani nemaže. Chyba jedné scény neovlivní ostatní.
 */
export const inspectSceneMediaFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ results: SceneMediaResult[] }> => {
    const { supabase } = context;

    const results = await Promise.all(
      data.scenes.map(async (scene): Promise<SceneMediaResult> => {
        const out: SceneMediaResult = {
          sceneId: scene.sceneId,
          ok: false,
          audioSeconds: null,
          audioBytes: null,
          imageBytes: null,
          error: null,
        };

        if (!scene.imagePath) {
          out.error = "Scéna nemá vygenerovaný vizuál.";
          return out;
        }
        if (!scene.audioPath) {
          out.error = "Scéna nemá vygenerovaný dabing.";
          return out;
        }

        try {
          const image = await supabase.storage.from(VISUALS_BUCKET).download(scene.imagePath);
          if (image.error || !image.data) {
            out.error = `Vizuál se nepodařilo načíst z úložiště: ${image.error?.message ?? "soubor nenalezen"}`;
            return out;
          }
          const imageBuf = await image.data.arrayBuffer();
          if (imageBuf.byteLength < 1024) {
            out.error = "Uložený vizuál je poškozený nebo prázdný.";
            return out;
          }
          out.imageBytes = imageBuf.byteLength;

          const audio = await supabase.storage.from(AUDIO_BUCKET).download(scene.audioPath);
          if (audio.error || !audio.data) {
            out.error = `Dabing se nepodařilo načíst z úložiště: ${audio.error?.message ?? "soubor nenalezen"}`;
            return out;
          }
          const audioBuf = await audio.data.arrayBuffer();
          const info = readWavInfo(audioBuf);
          if (info.seconds <= 0) {
            out.error = "Dabing má nulovou délku — vygeneruj ho prosím znovu.";
            return out;
          }
          out.audioSeconds = info.seconds;
          out.audioBytes = info.bytes;
          out.ok = true;
          return out;
        } catch (err) {
          out.error = err instanceof Error ? err.message : "Neznámá chyba při čtení souborů scény.";
          return out;
        }
      }),
    );

    return { results };
  });
