CREATE TABLE public.render_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  project_id TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'creatomate',
  provider_render_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  stage TEXT,
  progress INTEGER,
  output_url TEXT,
  storage_path TEXT,
  duration_seconds NUMERIC,
  scene_count INTEGER,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  finished_at TIMESTAMP WITH TIME ZONE
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.render_jobs TO authenticated;
GRANT ALL ON public.render_jobs TO service_role;

ALTER TABLE public.render_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own render jobs"
  ON public.render_jobs FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX render_jobs_project_idx ON public.render_jobs (project_id, created_at DESC);

CREATE TRIGGER update_render_jobs_updated_at
  BEFORE UPDATE ON public.render_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Users can read their own renders"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'project-renders' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can upload their own renders"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'project-renders' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update their own renders"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'project-renders' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete their own renders"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'project-renders' AND (storage.foldername(name))[1] = auth.uid()::text);