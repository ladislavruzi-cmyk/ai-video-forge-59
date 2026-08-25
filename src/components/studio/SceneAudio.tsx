import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AUDIO_BUCKET } from "@/lib/ai/voice.functions";

interface SceneAudioProps {
  path: string | null | undefined;
  label: string;
}

/** Přehrávač dabingu scény z privátního úložiště (podepsaná URL na 1 hodinu). */
export function SceneAudio({ path, label }: SceneAudioProps) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setUrl(null);
    if (!path) return () => { active = false; };
    void supabase.storage
      .from(AUDIO_BUCKET)
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (active) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      active = false;
    };
  }, [path]);

  if (!url) return null;

  return (
    <audio controls preload="none" src={url} aria-label={label} className="w-full" />
  );
}
