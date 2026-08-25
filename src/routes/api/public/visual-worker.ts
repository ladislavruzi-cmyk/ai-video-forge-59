import { createFileRoute } from "@tanstack/react-router";

/**
 * Serverový worker fronty vizuálů. Volá ho naplánovaná úloha každou minutu,
 * takže generování pokračuje i se zavřeným prohlížečem.
 * Přístup je chráněný tajným tokenem uloženým v interní tabulce worker_config.
 */
const MAX_JOBS_PER_RUN = 2;

async function handle(request: Request): Promise<Response> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const token = /^Bearer ([^\s,]+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!token) return new Response("Unauthorized", { status: 401 });

  const { data: config } = await supabaseAdmin
    .from("worker_config")
    .select("value")
    .eq("key", "visual_worker_token")
    .maybeSingle();
  const expected = (config?.value ?? "") as string;
  if (!expected || token !== expected) return new Response("Unauthorized", { status: 401 });

  const { processNextVisualJob, releaseStaleJobs } = await import("@/lib/ai/visualQueue.server");
  await releaseStaleJobs(supabaseAdmin as never);

  let processed = 0;
  for (let i = 0; i < MAX_JOBS_PER_RUN; i += 1) {
    const did = await processNextVisualJob(supabaseAdmin as never);
    if (!did) break;
    processed += 1;
  }

  return Response.json({ processed });
}

export const Route = createFileRoute("/api/public/visual-worker")({
  server: {
    handlers: {
      POST: ({ request }) => handle(request),
      GET: ({ request }) => handle(request),
    },
  },
});
