CREATE TABLE public.visual_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  scene_id text NOT NULL,
  scene_index integer NOT NULL DEFAULT 0,
  prompt text NOT NULL,
  aspect_ratio text NOT NULL DEFAULT '16:9',
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  image_path text,
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX visual_jobs_pending_idx ON public.visual_jobs (status, created_at);
CREATE INDEX visual_jobs_project_idx ON public.visual_jobs (project_id);
CREATE UNIQUE INDEX visual_jobs_active_scene_idx ON public.visual_jobs (project_id, scene_id) WHERE status IN ('pending','running');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.visual_jobs TO authenticated;
GRANT ALL ON public.visual_jobs TO service_role;

ALTER TABLE public.visual_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own visual jobs" ON public.visual_jobs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own visual jobs" ON public.visual_jobs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own visual jobs" ON public.visual_jobs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own visual jobs" ON public.visual_jobs FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_visual_jobs_updated_at BEFORE UPDATE ON public.visual_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();