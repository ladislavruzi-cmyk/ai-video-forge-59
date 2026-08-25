CREATE TABLE public.worker_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON public.worker_config FROM anon, authenticated;
GRANT ALL ON public.worker_config TO service_role;
ALTER TABLE public.worker_config ENABLE ROW LEVEL SECURITY;

INSERT INTO public.worker_config (key, value)
VALUES ('visual_worker_token', encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (key) DO NOTHING;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'visual-queue-worker',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--882a71f3-e4f5-444d-bd54-08a8de741175-dev.lovable.app/api/public/visual-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT value FROM public.worker_config WHERE key = 'visual_worker_token')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 8000
  );
  $$
);