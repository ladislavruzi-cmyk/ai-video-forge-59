import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { VISUALS_BUCKET } from "@/lib/ai/visuals.functions";

interface SceneImageProps {
  path: string | null | undefined;
  alt: string;
}

/** Náhled obrázku scény z privátního úložiště (podepsaná URL na 1 hodinu). */
export function SceneImage({ path, alt }: SceneImageProps) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!path) {
      setUrl(null);
      return () => {
        active = false;
      };
    }
    void supabase.storage
      .from(VISUALS_BUCKET)
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (active) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      active = false;
    };
  }, [path]);

  if (!url) {
    return (
      <div className="grid aspect-video w-full place-items-center bg-surface-2">
        <ImageOff className="size-6 text-muted-foreground" aria-hidden />
        <span className="sr-only">{alt}</span>
      </div>
    );
  }

  return (
    <img src={url} alt={alt} loading="lazy" className="aspect-video w-full object-cover" />
  );
}
