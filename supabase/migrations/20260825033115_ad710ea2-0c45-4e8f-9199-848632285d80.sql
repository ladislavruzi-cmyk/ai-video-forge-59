ALTER TABLE public.render_jobs
  ADD COLUMN IF NOT EXISTS width integer,
  ADD COLUMN IF NOT EXISTS height integer,
  ADD COLUMN IF NOT EXISTS video_codec text,
  ADD COLUMN IF NOT EXISTS audio_codec text,
  ADD COLUMN IF NOT EXISTS file_bytes bigint;