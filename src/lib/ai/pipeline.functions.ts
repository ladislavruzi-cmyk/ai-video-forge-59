import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { readIntegrationStatus } from "./providers.server";
import { generateScript, regenerateSceneRaw, splitIntoScenes } from "./script.server";

const briefSchema = z.object({
  topic: z.string().min(1),
  length: z.string(),
  customMinutes: z.number(),
  language: z.string(),
  style: z.string(),
  voice: z.string(),
  aspectRatio: z.string(),
  music: z.string(),
});

const rawSceneSchema = z.object({
  scene_number: z.number(),
  title: z.string(),
  narration: z.string(),
  visual_prompt: z.string(),
  estimated_duration: z.number(),
  transition: z.string(),
  mood: z.string(),
});

const minutes = z.number().min(1).max(180);

/**
 * Serverové funkce pro AI pipeline. Klient volá pouze je, nikdy externí API.
 */
export const getIntegrationStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
  return readIntegrationStatus();
});

export const generateScriptFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ brief: briefSchema, minutes }).parse(input))
  .handler(async ({ data }) => {
    const script = await generateScript(data.brief as never, data.minutes);
    return { script };
  });

export const generateScenesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ brief: briefSchema, minutes, script: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data }) => {
    const scenes = await splitIntoScenes(data.brief as never, data.minutes, data.script);
    return { scenes };
  });

export const regenerateSceneFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ brief: briefSchema, minutes, scene: rawSceneSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const scene = await regenerateSceneRaw(data.brief as never, data.minutes, data.scene);
    return { scene };
  });
