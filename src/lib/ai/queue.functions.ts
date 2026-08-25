import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const enqueueSchema = z.object({
  projectId: z.string().min(1),
  scenes: z
    .array(
      z.object({
        sceneId: z.string().min(1),
        index: z.number().int().nonnegative(),
        prompt: z.string().min(3),
      }),
    )
    .min(1),
  aspectRatio: z.string().min(3),
});

/** Zařadí scény do serverové fronty. Hotové scény sem vůbec neposíláme. */
export const enqueueVisualJobsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => enqueueSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: active } = await supabase
      .from("visual_jobs")
      .select("scene_id")
      .eq("project_id", data.projectId)
      .in("status", ["pending", "running"]);
    const busy = new Set(((active ?? []) as { scene_id: string }[]).map((r) => r.scene_id));

    const rows = data.scenes
      .filter((s) => !busy.has(s.sceneId))
      .map((s) => ({
        user_id: userId,
        project_id: data.projectId,
        scene_id: s.sceneId,
        scene_index: s.index,
        prompt: s.prompt,
        aspect_ratio: data.aspectRatio,
        status: "pending",
      }));

    if (rows.length > 0) {
      const { error } = await supabase.from("visual_jobs").insert(rows);
      if (error) throw new Error(`Úlohy se nepodařilo zařadit do fronty: ${error.message}`);
    }

    return { queued: rows.length, alreadyQueued: busy.size };
  });

/**
 * Posune frontu o jednu scénu dopředu (jen úlohy přihlášeného uživatele).
 * Aplikace to volá pro okamžitý start; naplánovaná serverová úloha dělá
 * totéž každou minutu, takže fronta doběhne i se zavřenou stránkou.
 */
export const processVisualQueueFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { processNextVisualJob, releaseStaleJobs } = await import("./visualQueue.server");
    await releaseStaleJobs(supabaseAdmin as never);
    const processed = await processNextVisualJob(supabaseAdmin as never, context.userId);
    return { processed };
  });

const cancelSchema = z.object({ projectId: z.string().min(1) });

/** Zruší čekající úlohy projektu. Právě běžící scéna se ještě dokončí. */
export const cancelVisualJobsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => cancelSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("visual_jobs")
      .delete()
      .eq("project_id", data.projectId)
      .eq("status", "pending");
    if (error) throw new Error(`Frontu se nepodařilo zrušit: ${error.message}`);
    return { ok: true };
  });
